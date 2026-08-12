// ════════════════════════════════════════════════════════════
// Generador de PDF del JSA — replica el formato oficial SPIE.
// Uso (navegador):  const doc = await generarJSAPDF(detail);  doc.save('JSA.pdf')
//   detail = { head, risks[], epp[], activities[], crew[], approvals[] }
//   (mismo shape que devuelve la acción jsa-detail de la Edge Function)
//   Las firmas (crew[].signature_url, approvals[].signature_dataurl) deben venir
//   ya como dataURL PNG; en el navegador se pre-cargan con precargarFirmas().
// Depende de jsPDF (window.jspdf) — o require('jspdf') en Node.
// ════════════════════════════════════════════════════════════
(function (root) {

  // Catálogos completos (para pintar TODAS las opciones marcadas/no marcadas, como el formato)
  const RIESGOS_PDF = {
    'Mecánico': ['Golpe, contusión','Atrapamiento','Mecanismos en movimiento','Proyección de partículas','Choque (con / contra)','Espacio reducido','Corte por herramienta','Vibraciones','Resbalones, tropiezos'],
    'Ergonómico': ['Sobre esfuerzo (carga)','Diseño inadecuado','Posturas incómodas'],
    'Ambiental': ['Contaminación agua, suelo, aire','Generación de residuos','Derrame de químicos','Emisiones','Ruido'],
    'Biológico': ['Bacterias, virus, hongos','Ofidio (serpiente)','Picadura / Mordedura'],
    'Químico': ['Aerosoles','Vapores / Atmósfera inadecuada','Polvos'],
    'Físico': ['Radiación solar','Frío / Humedad / Calor','Viento alto','Iluminación deficiente','Tormenta eléctrica'],
    'Eléctrico': ['Alta / Media / Baja tensión','Arco eléctrico / Quemaduras','Electricidad estática','Explosión','Incendio'],
    'Alturas': ['Caída al mismo nivel','Caída a distinto nivel','Caída de objetos'],
    'Locativo': ['Derrumbe / Hundimiento','Interferencia con otra tarea','Atropello'],
    'Flora y Fauna': ['Alergias / intoxicación por contacto con plantas','Lesiones por contacto con plantas','Caída de ramas o árboles','Picaduras de fauna nociva y ponzoñosa','Ramas o arbustos que obstruyan la zona de trabajo','Área con mucha vegetación','Terreno irregular (huecos, piedras, desniveles)'],
  };
  const EPP_PDF = ['Casco','Gafas de seguridad','Protección auditiva','Equipo de protección respiratoria','Calzado de seguridad','Guantes','Ropa de protección','Equipo LOTO','Bandejas para contención de derrames','Arnés / Cabos con absorbedor de energía','Botiquín PA','Extintores','Puntos fijos / De anclaje','Señalización móvil','Uso de polainas'];

  const DECL_TRABAJADOR = 'Entiendo y cumpliré los pasos, peligros y controles descritos en este AST. Entiendo que realizar un trabajo que no sea como se describe o fuera de secuencia puede representar una amenaza significativa y, por lo tanto, realizar el trabajo de esta manera no está autorizado. Me pondré en contacto con mi supervisor antes de continuar con el trabajo, si el alcance del trabajo cambia o se introducen nuevos peligros. Entiendo que tengo la autoridad y la obligación de detener el trabajo que considero inseguro.';
  const AUTOR_RESPONSABLE = 'He revisado la actividad y los pasos de trabajo, y los riesgos y controles descritos en este JSA con todos los trabajadores mencionados anteriormente y los autorizo a realizar el trabajo. Los trabajadores son competentes (capacitados, conocedores y con experiencia) y aptos para el trabajo (física, mental y socialmente) para realizar esta actividad.';

  // Paleta
  const NAVY = [15, 30, 90];
  const CYAN = [0, 168, 232];
  const GRAY = [95, 102, 128];
  const LIGHT = [238, 242, 250];
  const LINE = [180, 190, 210];

  function getJsPDF() {
    if (root.jspdf && root.jspdf.jsPDF) return root.jspdf.jsPDF;      // navegador (UMD)
    if (typeof require === 'function') { try { return require('jspdf').jsPDF; } catch (_e) {} }
    throw new Error('jsPDF no disponible');
  }

  function estadoLabel(s) {
    return ({ borrador: 'BORRADOR', enviado: 'ENVIADO', aprobado: 'APROBADO', rechazado: 'RECHAZADO' })[s] || (s || '').toUpperCase();
  }

  function generarJSAPDF(detail) {
    const jsPDF = getJsPDF();
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const PW = 210, PH = 297, M = 8;              // página y márgenes
    const R = PW - M;                              // borde derecho
    const W = R - M;                               // ancho útil
    let y = M;

    const h = detail.head || {};
    const risks = detail.risks || [];
    const epp = detail.epp || [];
    const acts = (detail.activities || []).filter(a => !a.during_execution);
    const actsE = (detail.activities || []).filter(a => a.during_execution);
    const crew = detail.crew || [];
    const approvals = detail.approvals || [];
    const site = (h.jsa_sites && h.jsa_sites.site) || detail.site || '';

    const checkedRisks = new Set(risks.map(r => r.category + '|' + r.risk));
    const otherRisk = {}; risks.forEach(r => { if (r.risk === 'Otro' && r.other_text) otherRisk[r.category] = r.other_text; });
    const checkedEpp = new Set(epp.map(e => e.epp));
    const otherEpp = (epp.find(e => e.epp === 'Otro') || {}).other_text || '';

    // ── helpers ──
    function ensure(hgt) {
      if (y + hgt > PH - M) { doc.addPage(); y = M; }
    }
    function setFill(c) { doc.setFillColor(c[0], c[1], c[2]); }
    function setDraw(c) { doc.setDrawColor(c[0], c[1], c[2]); }
    function setText(c) { doc.setTextColor(c[0], c[1], c[2]); }

    function sectionBar(txt) {
      ensure(9);
      setFill(NAVY); doc.rect(M, y, W, 6.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); setText([255, 255, 255]);
      doc.text(txt, M + 2, y + 4.5);
      y += 6.5;
    }

    function checkbox(x, cy, checked) {
      setDraw(GRAY); doc.setLineWidth(0.3);
      doc.rect(x, cy - 2.6, 3, 3);
      if (checked) {
        doc.setLineWidth(0.6); setDraw(NAVY);
        doc.line(x + 0.5, cy - 1.1, x + 1.2, cy - 0.2);
        doc.line(x + 1.2, cy - 0.2, x + 2.6, cy - 2.3);
        doc.setLineWidth(0.3);
      }
    }

    // Rejilla de casillas en columnas, agrupada por "bloques" con título.
    // blocks = [{title, items:[{label, checked}]}]
    function checkboxColumns(blocks, cols) {
      const colW = W / cols;
      const lineH = 4.0;
      const titleH = 4.6;
      // Reparte bloques por columnas balanceando por altura estimada
      const colItems = Array.from({ length: cols }, () => []);
      const colH = new Array(cols).fill(0);
      blocks.forEach(b => {
        let ci = colH.indexOf(Math.min(...colH));
        colItems[ci].push(b);
        colH[ci] += titleH + b.items.length * lineH + 1.5;
      });
      const startY = y;
      let maxY = y;
      for (let c = 0; c < cols; c++) {
        let cy = startY;
        const cx = M + c * colW;
        colItems[c].forEach(b => {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setText(NAVY);
          doc.text(b.title, cx + 1, cy + 3);
          cy += titleH;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); setText([20, 20, 30]);
          b.items.forEach(it => {
            checkbox(cx + 2, cy + 2.4, it.checked);
            const label = doc.splitTextToSize(it.label, colW - 8);
            doc.text(label[0], cx + 6, cy + 3.2);
            cy += lineH;
          });
          cy += 1.5;
        });
        if (cy > maxY) maxY = cy;
      }
      y = maxY;
    }

    // Tabla simple con encabezado navy. cols = [{h, w, key, align}]
    function table(cols, rows, opts) {
      opts = opts || {};
      const hH = 6;
      ensure(hH + 6);
      // header
      setFill(NAVY); doc.rect(M, y, W, hH, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setText([255, 255, 255]);
      let x = M;
      cols.forEach(c => { doc.text(c.h, x + 1.5, y + 4); x += c.w; });
      y += hH;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); setText([20, 20, 30]);
      rows.forEach((row, i) => {
        // altura de fila según contenido
        let rowH = opts.rowH || 6;
        const cells = cols.map(c => {
          const v = (row[c.key] != null ? String(row[c.key]) : '');
          return doc.splitTextToSize(v, c.w - 3);
        });
        const need = Math.max(rowH, ...cells.map(cl => cl.length * 3.6 + 2.4));
        ensure(need);
        if (i % 2 === 1) { setFill(LIGHT); doc.rect(M, y, W, need, 'F'); }
        setDraw(LINE); doc.setLineWidth(0.2); doc.rect(M, y, W, need);
        x = M;
        cols.forEach((c, ci) => {
          if (ci > 0) { doc.line(x, y, x, y + need); }
          const cl = cells[ci];
          doc.text(cl, x + 1.5, y + 3.8);
          x += c.w;
        });
        y += need;
      });
    }

    function paragraph(txt, italic) {
      doc.setFont('helvetica', italic ? 'italic' : 'normal'); doc.setFontSize(7.5); setText(GRAY);
      const lines = doc.splitTextToSize(txt, W - 4);
      ensure(lines.length * 3.5 + 3);
      setFill([247, 249, 253]); setDraw(LINE); doc.setLineWidth(0.2);
      doc.rect(M, y, W, lines.length * 3.5 + 3, 'FD');
      doc.text(lines, M + 2, y + 3.5);
      y += lines.length * 3.5 + 3 + 1.5;
    }

    function kvBox(pairs) {
      // pairs: [[label, value], ...] en 2 columnas, altura de fila adaptable
      const half = W / 2;
      setDraw(LINE); doc.setLineWidth(0.2);
      for (let i = 0; i < pairs.length; i += 2) {
        const left = pairs[i], right = pairs[i + 1];
        const lLines = doc.splitTextToSize(left[1] || '—', half - 4).slice(0, 3);
        const rLines = right ? doc.splitTextToSize(right[1] || '—', half - 4).slice(0, 3) : [];
        const rowH = Math.max(8, 4.6 + Math.max(lLines.length, rLines.length) * 3.6);
        ensure(rowH);
        const cell = (x, label, lines) => {
          doc.rect(x, y, half, rowH);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7); setText(GRAY);
          doc.text(label.toUpperCase(), x + 1.5, y + 3);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); setText([20, 20, 30]);
          doc.text(lines, x + 1.5, y + 6.4);
        };
        cell(M, left[0], lLines);
        if (right) cell(M + half, right[0], rLines);
        else doc.rect(M + half, y, half, rowH);
        y += rowH;
      }
    }

    // ══════════ ENCABEZADO ══════════
    setFill(NAVY); doc.rect(M, y, W, 15, 'F');
    // recuadro SPIE
    setFill([255, 255, 255]); doc.rect(M + 2, y + 2.5, 22, 10, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); setText(NAVY);
    doc.text('SPIE', M + 4.5, y + 9);
    // título
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); setText([255, 255, 255]);
    doc.text('ANÁLISIS DE SEGURIDAD EN EL TRABAJO', M + 28, y + 6.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text('JSA · Job Safety Analysis', M + 28, y + 11);
    // folio / estado
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); setText(CYAN);
    doc.text(h.folio || '', R - 2, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); setText([255, 255, 255]);
    doc.text(estadoLabel(h.status), R - 2, y + 11, { align: 'right' });
    y += 15 + 2;

    // ══════════ DATOS GENERALES ══════════
    kvBox([
      ['Fecha', h.work_date || ''],
      ['Trabajo por realizar', h.work_description || ''],
      ['Hora', h.work_time || ''],
      ['Proyecto / Instalación', h.project || ''],
      ['Permiso de trabajo', h.work_permit || ''],
      ['Área donde se realiza', h.work_area || ''],
      ['Sitio / Parque', site],
      ['Creado por (nómina)', h.created_by_payroll_no || ''],
    ]);
    y += 2;

    // ══════════ 1. RIESGOS ══════════
    sectionBar('1.  RIESGOS GENERALES Y POTENCIALES  ·  Riesgos asociados a la tarea');
    y += 1;
    const riskBlocks = Object.keys(RIESGOS_PDF).map(cat => {
      const items = RIESGOS_PDF[cat].map(r => ({ label: r, checked: checkedRisks.has(cat + '|' + r) }));
      if (otherRisk[cat]) items.push({ label: 'Otro: ' + otherRisk[cat], checked: true });
      else items.push({ label: 'Otro', checked: checkedRisks.has(cat + '|Otro') });
      return { title: cat, items };
    });
    checkboxColumns(riskBlocks, 3);
    y += 1.5;
    if (h.extra_risk) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); setText(NAVY);
      ensure(6); doc.text('Riesgo extra identificado:', M + 1, y + 3);
      doc.setFont('helvetica', 'normal'); setText([20, 20, 30]);
      const el = doc.splitTextToSize(h.extra_risk, W - 45);
      doc.text(el, M + 40, y + 3); y += Math.max(5, el.length * 3.4);
    }
    y += 1;

    // ══════════ 2 y 3 ══════════
    sectionBar('2.  ZONA DE TRABAJO PREVIO AL INICIO DE ACTIVIDADES');
    paragraph('Condiciones del área donde se desarrollará la actividad:  ' + (h.area_conditions || '—'), false);
    sectionBar('3.  ¿HA IDENTIFICADO RIESGOS DISTINTOS A LA JORNADA ANTERIOR?');
    ensure(7);
    doc.setFontSize(8.5); setText([20, 20, 30]);
    const dr = h.distinct_risks;
    let dx = M + 2; const dcy = y + 4;
    [['SI', 'Sí'], ['NO', 'No'], ['NA', 'No aplica']].forEach(([v, lbl]) => {
      checkbox(dx, dcy, dr === v); doc.setFont('helvetica', 'normal'); doc.text(lbl, dx + 4.5, dcy + 0.8);
      dx += 28;
    });
    if (dr === 'SI' && h.distinct_risks_detail) {
      doc.setFont('helvetica', 'italic'); setText(GRAY);
      const dl = doc.splitTextToSize('Cuáles: ' + h.distinct_risks_detail, R - dx - 2);
      doc.text(dl[0], dx + 2, dcy + 0.8);
    }
    y += 7;

    // ══════════ 4. EPP ══════════
    sectionBar('4.  BARRERAS DE PROTECCIÓN  ·  Equipos de protección personal y colectiva');
    y += 1;
    const eppItems = EPP_PDF.map(e => ({ label: e, checked: checkedEpp.has(e) }));
    if (otherEpp) eppItems.push({ label: 'Otro: ' + otherEpp, checked: true });
    else eppItems.push({ label: 'Otro', checked: checkedEpp.has('Otro') });
    checkboxColumns([{ title: '', items: eppItems }], 3);
    y += 2;

    // ══════════ 5. ACTIVIDADES ══════════
    sectionBar('5.  LISTADO DE ACTIVIDADES A REALIZAR');
    const actCols = [
      { h: 'No.', w: 10, key: 'no' },
      { h: 'Listado de tareas', w: 55, key: 'task' },
      { h: 'Identificación de riesgos', w: 64, key: 'risk' },
      { h: 'Medidas de control', w: W - 10 - 55 - 64, key: 'control' },
    ];
    table(actCols, acts.map((a, i) => ({ no: (i + 1) + '.-', task: a.task, risk: a.risk, control: a.control })));
    if (actsE.length) {
      y += 1;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); setText(NAVY);
      ensure(5); doc.text('Riesgos específicos identificados durante la ejecución de la tarea', M + 1, y + 3); y += 4;
      table(actCols, actsE.map((a, i) => ({ no: (i + 1) + '.-', task: a.task, risk: a.risk, control: a.control })));
    }
    y += 1;
    paragraph(DECL_TRABAJADOR, true);

    // ══════════ 6. PERSONAL ══════════
    sectionBar('6.  LISTA DEL PERSONAL INVOLUCRADO');
    // tabla de 2 columnas de personas: Nombre | Nº | Firma
    const colW = W / 2;
    const rowH = 12;
    const perCol = Math.ceil(crew.length / 2) || 1;
    ensure(perCol * rowH + 2);
    // encabezados
    setFill(LIGHT); doc.rect(M, y, W, 5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); setText(GRAY);
    [0, 1].forEach(c => {
      const bx = M + c * colW;
      doc.text('NOMBRE COMPLETO', bx + 1.5, y + 3.3);
      doc.text('NÓMINA', bx + colW * 0.52, y + 3.3);
      doc.text('FIRMA', bx + colW * 0.72, y + 3.3);
    });
    y += 5;
    setDraw(LINE); doc.setLineWidth(0.2);
    for (let i = 0; i < perCol; i++) {
      for (let c = 0; c < 2; c++) {
        const idx = c * perCol + i;
        const bx = M + c * colW;
        doc.rect(bx, y, colW, rowH);
        doc.line(bx + colW * 0.7, y, bx + colW * 0.7, y + rowH); // separador firma
        const p = crew[idx];
        if (p) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); setText([20, 20, 30]);
          const nm = doc.splitTextToSize(p.employee_name || '', colW * 0.5 - 3);
          doc.text(nm.slice(0, 3), bx + 1.5, y + 4);
          doc.setFontSize(7); setText(GRAY);
          doc.text(String(p.payroll_no || '—'), bx + colW * 0.52, y + 4);
          if (p.signature_url && String(p.signature_url).startsWith('data:image')) {
            try { doc.addImage(p.signature_url, 'PNG', bx + colW * 0.71, y + 1.5, colW * 0.27, rowH - 3); } catch (_e) {}
          }
        }
      }
      y += rowH;
    }
    y += 1;
    paragraph(AUTOR_RESPONSABLE, true);

    // ══════════ 7. APROBACIÓN ══════════
    sectionBar('7.  REVISIÓN Y APROBACIÓN DEL DOCUMENTO');
    const apRowH = 14;
    const ac = [
      { w: W * 0.34, h: 'NOMBRE COMPLETO' },
      { w: W * 0.20, h: 'CARGO' },
      { w: W * 0.28, h: 'FIRMA' },
      { w: W * 0.18, h: 'FECHA' },
    ];
    ensure(5 + apRowH + apRowH);
    setFill(LIGHT); doc.rect(M, y, W, 5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); setText(GRAY);
    let ax = M; ac.forEach(c => { doc.text(c.h, ax + 1.5, y + 3.3); ax += c.w; });
    y += 5;
    const apRows = approvals.length ? approvals : [{}, {}];
    setDraw(LINE); doc.setLineWidth(0.2);
    apRows.forEach(ap => {
      ensure(apRowH);
      ax = M;
      ac.forEach((c, ci) => { doc.rect(ax, y, c.w, apRowH); ax += c.w; });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setText([20, 20, 30]);
      doc.text(ap.approver_name || '', M + 1.5, y + 5);
      doc.text(ap.approver_role || '', M + W * 0.34 + 1.5, y + 5);
      if (ap.signature_dataurl && String(ap.signature_dataurl).startsWith('data:image')) {
        try { doc.addImage(ap.signature_dataurl, 'PNG', M + W * 0.54 + 1, y + 1.5, W * 0.26, apRowH - 3); } catch (_e) {}
      }
      if (ap.created_at) { doc.setFontSize(7.5); doc.text(String(ap.created_at).slice(0, 10), M + W * 0.82 + 1.5, y + 5); }
      if (ap.result) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setText(ap.result === 'aprobado' ? [30, 122, 52] : [200, 40, 40]);
        doc.text(ap.result === 'aprobado' ? 'APROBADO' : 'RECHAZADO', M + W * 0.34 + 1.5, y + 10);
        if (ap.comment) { doc.setFont('helvetica', 'italic'); doc.setFontSize(6.8); setText(GRAY); doc.text(doc.splitTextToSize(ap.comment, W * 0.32 - 3).slice(0, 2), M + 1.5, y + 10.5); }
      }
      y += apRowH;
    });

    // ── pie de página en todas las hojas ──
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); setText(GRAY);
      doc.text('SPIE · HSE · Documento generado desde la app JSA' + (h.folio ? ('  ·  ' + h.folio) : ''), M, PH - 3);
      doc.text('Página ' + p + ' de ' + total, R, PH - 3, { align: 'right' });
    }

    return doc;
  }

  // Pre-carga firmas (URL → dataURL) para poder embeberlas. Navegador.
  async function precargarFirmas(detail) {
    async function toDataURL(url) {
      if (!url) return null;
      if (String(url).startsWith('data:image')) return url;
      try {
        const r = await fetch(url); const b = await r.blob();
        return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(b); });
      } catch (_e) { return null; }
    }
    for (const c of (detail.crew || [])) { c.signature_url = await toDataURL(c.signature_url); }
    for (const a of (detail.approvals || [])) { a.signature_dataurl = await toDataURL(a.signature_url || a.signature_dataurl); }
    return detail;
  }

  root.generarJSAPDF = generarJSAPDF;
  root.precargarFirmasJSA = precargarFirmas;
  if (typeof module !== 'undefined' && module.exports) module.exports = { generarJSAPDF, precargarFirmas };

})(typeof window !== 'undefined' ? window : globalThis);
