// ════════════════════════════════════════════════════════════
// Generador de PDF del JSA — REPLICA EXACTA del formato oficial SPIE
// (R24.U01.11.03 V5.2), 3 páginas, orientación horizontal.
// Uso (navegador):  const doc = await (async()=>{ await precargarFirmasJSA(detail); return generarJSAPDF(detail); })()
//   detail = { head, risks[], epp[], activities[], crew[], approvals[] }  (shape de la acción jsa-detail)
// Depende de jsPDF (window.jspdf) y de JSA_PDF_ASSETS (pdf-assets.js).
// ════════════════════════════════════════════════════════════
(function (root) {

  function getJsPDF() {
    if (root.jspdf && root.jspdf.jsPDF) return root.jspdf.jsPDF;
    if (typeof require === 'function') { try { return require('jspdf').jsPDF; } catch (_e) {} }
    throw new Error('jsPDF no disponible');
  }
  function assets() { return root.JSA_PDF_ASSETS || (typeof require === 'function' ? require('./pdf-assets.js') : {}); }

  const NAVY = [31, 56, 100];      // azul del formato (barras/título)
  const BLACK = [20, 20, 20];
  const GRAY = [90, 90, 90];

  // Quita acentos/espacios para comparar etiquetas del formato con lo capturado
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[_]+/g, '').replace(/\s+/g, ' ').trim();
  }

  // ── Matriz de riesgos, EXACTA como el formato (2 mega-columnas, 12 filas) ──
  const LEFT_MATRIX = [
    { cat: 'Mecánico', rows: [['Golpe, contusión', 'Atrapamiento'], ['Mecanismos en movimiento', 'Proyección de partículas'], ['Choque (con / contra)', 'Espacio reducido'], ['Corte por herramienta', 'Vibraciones'], ['Resbalones, Tropiezos', 'Otro']] },
    { cat: 'Biológico', rows: [['Bacterias, virus, hongos', 'Ofidio (serpiente)'], ['Picadura / Mordedura', 'Otro']] },
    { cat: 'Físico', rows: [['Radiación solar', 'Frio / Humedad / Calor'], ['Viento alto', 'Iluminación deficiente'], ['Tormenta eléctrica', 'Otro']] },
    { cat: 'Alturas', rows: [['Caída al mismo nivel', 'Caída de objetos'], ['Caída a distinto nivel', 'Otro']] },
  ];
  const RIGHT_MATRIX = [
    { cat: 'Ergonómico', rows: [['Sobre esfuerzo (carga)', 'Diseño inadecuado'], ['Posturas incomodas', 'Otro']] },
    { cat: 'Ambiental', rows: [['Contaminación agua, suelo, aire', 'Generación de residuos'], ['Derrame de químicos', 'Emisiones'], ['Ruido', 'Otro']] },
    { cat: 'Químico', rows: [['Aerosoles', 'Vapores / Atmosfera inadecuada'], ['Polvos', 'Otro']] },
    { cat: 'Eléctrico', rows: [['Alta / Media / Baja tensión', 'Arco eléctrico / Quemaduras'], ['Electricidad estática', 'Explosión'], ['Incendio', 'Otro']] },
    { cat: 'Locativo', rows: [['Derrumbe / Hundimiento', 'Interferencia con otra tarea'], ['Atropello', '']] },
  ];
  // Flora y Fauna (bloque inferior, 3 filas): [colA, colB, colC(terreno/otro)]
  const FLORA = {
    cat: 'Flora y Fauna',
    a: ['Alergias /intoxicación por contacto con plantas', 'Lesiones por contacto con plantas', 'Caída de ramas o arboles'],
    b: ['Picaduras de fauna nociva y ponzoñosa', 'Ramas o arbustos que obstruyan la zona de trabajo', 'Área con mucha vegetación'],
    c: ['Terreno irregular (huecos, piedras, desniveles)', 'Otro', ''],
  };
  const EPP_GRID = [
    ['Casco', 'Gafas de seguridad', 'Protección auditiva', 'Equipo de protección respiratoria', 'Calzado de seguridad'],
    ['Guantes', 'Ropa de protección', 'Equipo LOTO', 'Bandejas para contención de derrames', 'Arnés / Cabos con Absorbedor de energía'],
    ['Botiquín PA', 'Extintores', 'Puntos fijos / De anclaje', 'Señalización móvil', 'Otro'],
    ['Uso de polainas', '', '', '', ''],
  ];
  const DECL = '"Entiendo y cumpliré los pasos, peligros y controles descritos en este AST.  Entiendo que realizar un trabajo que no sea como se describe o fuera de secuencia puede representar una amenaza significativa y, por lo tanto, realizar el trabajo de esta manera no está autorizado. Me pondré en contacto con mi supervisor antes de continuar con el trabajo, si el alcance del trabajo cambia o se introducen nuevos peligros.  Entiendo que tengo la autoridad y la obligación de detener el trabajo que considero inseguro".';
  const AUTOR = 'He revisado la actividad y los pasos de trabajo, y los riesgos y controles descritos en este JSA con todos los trabajadores mencionados anteriormente y los autorizo a realizar el trabajo.  Los trabajadores son competentes (capacitados, conocedores y con experiencia) y aptos para el trabajo (física, mental y socialmente) para realizar esta actividad.';

  function generarJSAPDF(detail) {
    const jsPDF = getJsPDF();
    const A = assets();
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
    const PW = 297, PH = 210, M = 8, R = PW - M, W = R - M;

    const h = detail.head || {};
    const risks = detail.risks || [];
    const epp = detail.epp || [];
    const acts = (detail.activities || []).filter(a => !a.during_execution);
    const actsE = (detail.activities || []).filter(a => a.during_execution);
    const crew = detail.crew || [];
    const approvals = detail.approvals || [];
    const site = (h.jsa_sites && h.jsa_sites.site) || detail.site || '';

    // conjuntos normalizados de lo marcado
    const rSet = new Set(risks.map(r => norm(r.category) + '||' + norm(r.risk)));
    const rOther = {}; risks.forEach(r => { if (r.risk === 'Otro' && r.other_text) rOther[norm(r.category)] = r.other_text; });
    const eSet = new Set(epp.map(e => norm(e.epp)));
    const eOther = (epp.find(e => e.epp === 'Otro') || {}).other_text || '';

    const setFill = c => doc.setFillColor(c[0], c[1], c[2]);
    const setDraw = c => doc.setDrawColor(c[0], c[1], c[2]);
    const setText = c => doc.setTextColor(c[0], c[1], c[2]);

    function chk(x, cy, on) {
      setDraw([70, 70, 70]); doc.setLineWidth(0.25); setFill([255, 255, 255]);
      doc.rect(x, cy - 1.6, 3, 3, 'FD');
      if (on) {
        setDraw(NAVY); doc.setLineWidth(0.7);
        doc.line(x + 0.5, cy + 0.1, x + 1.2, cy + 0.9);
        doc.line(x + 1.2, cy + 0.9, x + 2.7, cy - 1.4);
        doc.setLineWidth(0.25);
      }
    }
    function cell(x, y, w, hh) { setDraw([120, 130, 150]); doc.setLineWidth(0.2); doc.rect(x, y, w, hh); }
    function navBar(y, txt, hh, center) {
      hh = hh || 6; setFill(NAVY); doc.rect(M, y, W, hh, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); setText([255, 255, 255]);
      if (center) doc.text(txt, PW / 2, y + hh / 2 + 1.4, { align: 'center' });
      else doc.text(txt, M + 2, y + hh / 2 + 1.4);
    }
    function txt(s, x, y, size, bold, color, maxw) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); setText(color || BLACK);
      const lines = maxw ? doc.splitTextToSize(String(s == null ? '' : s), maxw) : [String(s == null ? '' : s)];
      doc.text(lines, x, y);
      return lines.length;
    }

    // ── Encabezado y pie (en cada página) ──
    function header() {
      if (A.spieWind) { try { doc.addImage(A.spieWind, 'PNG', M, 7, 42, 8.3); } catch (_e) {} }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); setText(NAVY);
      doc.text('ANÁLISIS DE SEGURIDAD EN EL TRABAJO (JSA)', PW / 2, 13, { align: 'center' });
      if (A.spie) { try { doc.addImage(A.spie, 'JPEG', R - 30, 5, 30, 14.7); } catch (_e) {} }
    }
    function footer(pageNo) {
      const fy = PH - 8;
      setDraw([120, 130, 150]); doc.setLineWidth(0.3); doc.line(M, fy, R, fy);
      if (A.icons) { try { doc.addImage(A.icons, 'PNG', M, fy + 1.5, 42, 7); } catch (_e) {} }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setText(BLACK);
      doc.text('R24.U01.11.03 V5.2', PW / 2, fy + 5.5, { align: 'center' });
      doc.text('Página ' + pageNo + ' de 3', R, fy + 5.5, { align: 'right' });
    }

    // draw una celda de riesgo: [chk][texto], marca si corresponde
    function riskCell(x, y, w, hh, cat, label) {
      cell(x, y, w, hh);
      if (!label) return;
      const isOtro = label === 'Otro';
      const on = rSet.has(norm(cat) + '||' + norm(label));
      chk(x + 1.5, y + hh / 2, on);
      let show = label;
      if (isOtro) { const ot = rOther[norm(cat)]; show = ot ? ('Otro: ' + ot) : 'Otro__________'; }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4); setText(BLACK);
      const lines = doc.splitTextToSize(show, w - 6).slice(0, 2);
      const oy = y + hh / 2 - (lines.length - 1) * 1.5 + 1;
      doc.text(lines, x + 5, oy);
    }

    // ════════════════ PÁGINA 1 ════════════════
    header();
    let y = 22;
    navBar(y, 'Análisis de Seguridad en el Trabajo', 7, true); y += 7;

    // Datos generales (3 filas × [labelL | valL | labelR | valR])
    const c1 = 40, c2 = 34, c3 = 56, c4 = W - 40 - 34 - 56;
    const genRows = [
      ['Fecha :', h.work_date || '', 'Trabajo Por Realizar :', h.work_description || ''],
      ['Hora:', h.work_time || '', 'Proyecto / Instalación:', h.project || ''],
      ['Permiso de trabajo :', h.work_permit || '', 'Área donde se realiza la tarea :', h.work_area || ''],
    ];
    const grH = 8;
    genRows.forEach((r, i) => {
      const yy = y + i * grH;
      let x = M;
      cell(x, yy, c1, grH); txt(r[0], x + 1.5, yy + 5, 8, false, BLACK, c1 - 2); x += c1;
      cell(x, yy, c2, grH); txt(r[1], x + 1.5, yy + 5, 8.5, false, BLACK, c2 - 2); x += c2;
      cell(x, yy, c3, grH); txt(r[2], x + 1.5, yy + 5, 8, false, BLACK, c3 - 2); x += c3;
      cell(x, yy, c4, grH); txt(r[3], x + 1.5, yy + 3.4, 8, false, BLACK, c4 - 3);
    });
    y += 3 * grH;

    navBar(y, '1._  RIESGOS GENERALES Y POTENCIALES:', 6); y += 6;
    // subencabezado
    cell(M, y, W, 5); txt('Riesgos Asociados a la Tarea', PW / 2 - 22, y + 3.4, 8.5, true, BLACK); y += 5;

    // Matriz 12 filas
    const rowH = 5.4;
    const mcW = W / 2;                 // ancho de una mega-columna
    const catW = 26, chkRiskW = (mcW - catW) / 2;
    function drawMega(x0, groups) {
      let ry = y;
      groups.forEach(g => {
        const gH = g.rows.length * rowH;
        // etiqueta de categoría (rowspan)
        cell(x0, ry, catW, gH);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); setText(BLACK);
        doc.text(g.cat, x0 + catW / 2, ry + gH / 2 + 1, { align: 'center' });
        g.rows.forEach((pair, i) => {
          const yy = ry + i * rowH;
          riskCell(x0 + catW, yy, chkRiskW, rowH, g.cat, pair[0]);
          riskCell(x0 + catW + chkRiskW, yy, chkRiskW, rowH, g.cat, pair[1]);
        });
        ry += gH;
      });
      return ry;
    }
    const yL = drawMega(M, LEFT_MATRIX);
    const yR = drawMega(M + mcW, RIGHT_MATRIX);
    y = Math.max(yL, yR);

    // Bloque Flora y Fauna (3 filas) — ancho completo con caja de "riesgo extra"
    const fRows = 3, fH = fRows * rowH;
    const fColW = 52, fCW = 40;         // ancho de colA/colB (52) y colC terreno/otro (40)
    const extraX = M + catW + fColW * 2 + fCW;
    const extraW = R - extraX;
    // etiqueta
    cell(M, y, catW, fH);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); setText(BLACK);
    doc.text('Flora y', M + catW / 2, y + fH / 2 - 1, { align: 'center' });
    doc.text('Fauna', M + catW / 2, y + fH / 2 + 3, { align: 'center' });
    for (let i = 0; i < 3; i++) {
      const yy = y + i * rowH;
      riskCell(M + catW, yy, fColW, rowH, 'Flora y Fauna', FLORA.a[i]);
      riskCell(M + catW + fColW, yy, fColW, rowH, 'Flora y Fauna', FLORA.b[i]);
      riskCell(M + catW + fColW * 2, yy, fCW, rowH, 'Flora y Fauna', FLORA.c[i]);
    }
    // caja riesgo extra
    cell(extraX, y, extraW, fH);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); setText(BLACK);
    doc.text(doc.splitTextToSize('Si se detectó algún riesgo extra a la actividad descríbalo:', extraW - 4), extraX + 2, y + 3.5);
    if (h.extra_risk) { doc.setFontSize(7.5); doc.text(doc.splitTextToSize(h.extra_risk, extraW - 4).slice(0, 3), extraX + 2, y + 9.5); }
    y += fH;

    footer(1);

    // ════════════════ PÁGINA 2 ════════════════
    doc.addPage(); header();
    y = 22;
    // Secciones 2 y 3 (lado a lado)
    const halfW = W / 2;
    setFill(NAVY); doc.rect(M, y, halfW, 6, 'F'); doc.rect(M + halfW, y, halfW, 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setText([255, 255, 255]);
    doc.text('2._  ZONA DE TRABAJO PREVIO AL INICIO DE ACTIVIDADES:', M + 2, y + 4);
    doc.text('3._  HA IDENTIFICADO RIESGOS DISTINTOS A LA JORNADA ANTERIOR:', M + halfW + 2, y + 4);
    y += 6;
    const s2H = 9;
    cell(M, y, 62, s2H); txt('Condiciones del área donde se', M + 1.5, y + 3.6, 7.5, true, BLACK); txt('desarrollará la actividad.', M + 1.5, y + 6.6, 7.5, true, BLACK);
    cell(M + 62, y, halfW - 62, s2H); txt(h.area_conditions || '', M + 63.5, y + 3.4, 7.5, false, BLACK, halfW - 62 - 3);
    // sección 3: SI ( ) Cuales: ___ No ( ) No Aplica ( )
    cell(M + halfW, y, halfW, s2H);
    const dr = h.distinct_risks;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); setText(BLACK);
    let sx = M + halfW + 3, sy = y + 5.4;
    const paren = (label, on) => {
      doc.setFont('helvetica', 'bold'); doc.text(label + ' (', sx, sy);
      const pw = doc.getTextWidth(label + ' (');
      if (on) { setText([200, 0, 0]); doc.text('X', sx + pw + 0.6, sy); setText(BLACK); }
      doc.text(')', sx + pw + 3, sy);
      sx += pw + 5.5;
    };
    paren('SI', dr === 'SI');
    doc.setFont('helvetica', 'normal'); doc.text('Cuales: ' + (dr === 'SI' && h.distinct_risks_detail ? h.distinct_risks_detail : '______________________'), sx, sy);
    sx += 62; paren('No', dr === 'NO'); sx += 2; paren('No Aplica', dr === 'NA');
    y += s2H + 3;

    navBar(y, '4._  BARRERAS DE PROTECCIÓN:', 6); y += 6;
    // EPP: etiqueta (col izq, rowspan) + grilla 5 columnas × 4 filas
    const eppLabelW = 60, eppRowH = 7.2, eppColW = (W - eppLabelW) / 5;
    cell(M, y, eppLabelW, eppRowH * 4);
    txt('Equipos de protección personal y', M + 1.5, y + 3.4 + eppRowH * 1.4, 8, true, BLACK, eppLabelW - 3);
    txt('colectiva:', M + 1.5, y + 6.6 + eppRowH * 1.4, 8, true, BLACK);
    EPP_GRID.forEach((rw, ri) => {
      rw.forEach((item, ci) => {
        const x = M + eppLabelW + ci * eppColW, yy = y + ri * eppRowH;
        cell(x, yy, eppColW, eppRowH);
        if (!item) return;
        const on = eSet.has(norm(item));
        chk(x + 1.8, yy + eppRowH / 2, on);
        let show = item; if (item === 'Otro') show = eOther ? ('Otro: ' + eOther) : 'Otro______________';
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); setText(BLACK);
        doc.text(doc.splitTextToSize(show, eppColW - 8).slice(0, 2), x + 5.5, yy + eppRowH / 2 - 0.5 + 1);
      });
    });
    y += eppRowH * 4;

    navBar(y, '5._  LISTADO DE ACTIVIDADES A REALIZAR:', 6); y += 6;
    y = drawActTable(20, acts);
    footer(2);

    // ════════════════ PÁGINA 3 ════════════════
    doc.addPage(); header();
    y = 22;
    navBar(y, '(RIESGOS ESPECÍFICOS IDENTIFICADOS DURANTE LA EJECUCIÓN DE LA TAREA)', 6, true); y += 6;
    y = drawActTable(2, actsE);
    y += 1;
    // declaración
    doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(8); setText(BLACK);
    doc.text(doc.splitTextToSize(DECL, W - 8), PW / 2, y + 4, { align: 'center' });
    y += doc.splitTextToSize(DECL, W - 8).length * 3.6 + 3;

    navBar(y, '6._  LISTA DEL PERSONAL INVOLUCRADO:', 6); y += 6;
    // encabezado personal (2 columnas de 3: Nombre | Nº Empleado | Firma)
    const pNom = 62, pNum = 26, pFir = W / 2 - pNom - pNum;
    const pHead = ['Nombre Completo', 'Numero de Empleado', 'Firma'];
    const pw2 = [pNom, pNum, pFir];
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setText(BLACK);
    let hx = M;
    for (let c = 0; c < 2; c++) {
      const base = M + c * (W / 2);
      hx = base;
      pHead.forEach((hh2, i) => { cell(hx, y, pw2[i], 7); doc.text(hh2, hx + pw2[i] / 2, y + 4.4, { align: 'center' }); hx += pw2[i]; });
    }
    y += 7;
    const pRowH = 8;
    for (let i = 0; i < 6; i++) {
      for (let c = 0; c < 2; c++) {
        const base = M + c * (W / 2);
        const idx = c * 6 + i;
        let x = base;
        cell(x, y, pNom, pRowH); cell(x + pNom, y, pNum, pRowH); cell(x + pNom + pNum, y, pFir, pRowH);
        const p = crew[idx];
        if (p) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); setText(BLACK);
          doc.text(doc.splitTextToSize(p.employee_name || '', pNom - 3).slice(0, 2), x + 1.5, y + 4.5);
          doc.text(String(p.payroll_no || ''), x + pNom + pNum / 2, y + 5, { align: 'center' });
          if (p.signature_url && String(p.signature_url).startsWith('data:image')) {
            try { doc.addImage(p.signature_url, 'PNG', x + pNom + pNum + 1, y + 1, pFir - 2, pRowH - 2); } catch (_e) {}
          }
        }
      }
      y += pRowH;
    }
    y += 1;
    doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(8); setText(BLACK);
    doc.text(doc.splitTextToSize(AUTOR, W - 8), PW / 2, y + 4, { align: 'center' });
    y += doc.splitTextToSize(AUTOR, W - 8).length * 3.6 + 3;

    navBar(y, '7._  REVISIÓN Y APROBACIÓN DEL DOCUMENTO:', 6); y += 6;
    const aNom = W * 0.42, aCar = W * 0.28, aFir = W * 0.16, aFec = W - aNom - aCar - aFir;
    const aHead = [['Nombre Completo', aNom], ['Cargo', aCar], ['Firma', aFir], ['Fecha', aFec]];
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setText(BLACK);
    let ax = M; aHead.forEach(([hh2, w]) => { cell(ax, y, w, 7); doc.text(hh2, ax + w / 2, y + 4.4, { align: 'center' }); ax += w; });
    y += 7;
    const aRowH = 9;
    const aRows = approvals.length ? approvals : [{}, {}];
    for (let i = 0; i < Math.max(2, aRows.length); i++) {
      const ap = aRows[i] || {};
      ax = M;
      cell(ax, y, aNom, aRowH); cell(ax + aNom, y, aCar, aRowH); cell(ax + aNom + aCar, y, aFir, aRowH); cell(ax + aNom + aCar + aFir, y, aFec, aRowH);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setText(BLACK);
      if (ap.approver_name) doc.text(doc.splitTextToSize(ap.approver_name, aNom - 3).slice(0, 2), ax + 1.5, y + 5);
      if (ap.approver_role) doc.text(String(ap.approver_role), ax + aNom + 1.5, y + 5);
      if (ap.result) { doc.setFont('helvetica', 'bold'); setText(ap.result === 'aprobado' ? [30, 122, 52] : [200, 40, 40]); doc.setFontSize(7); doc.text(ap.result.toUpperCase(), ax + aNom + 1.5, y + 8); }
      if (ap.signature_dataurl && String(ap.signature_dataurl).startsWith('data:image')) { try { doc.addImage(ap.signature_dataurl, 'PNG', ax + aNom + aCar + 1, y + 1, aFir - 2, aRowH - 2); } catch (_e) {} }
      if (ap.created_at) { doc.setFont('helvetica', 'normal'); setText(BLACK); doc.setFontSize(8); doc.text(String(ap.created_at).slice(0, 10), ax + aNom + aCar + aFir + 1.5, y + 5); }
      y += aRowH;
    }
    footer(3);

    // ── tabla de actividades (usada en pág 2 y 3) ──
    function drawActTable(nRows, data) {
      const cNo = 12, cTa = 62, cRi = (W - 12) * 0.42, cCo = W - cNo - cTa - cRi;
      // encabezado
      setFill([235, 238, 245]); doc.rect(M, y, W, 6, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); setText(BLACK);
      let x = M;
      [['No.', cNo], ['Listado de Tareas', cTa], ['Identificación de Riesgos', cRi], ['Medidas de Control', cCo]].forEach(([t, w], i) => {
        cell(x, y, w, 6); doc.text(t, i === 0 ? x + w / 2 : x + 1.8, y + 4, i === 0 ? { align: 'center' } : undefined); x += w;
      });
      y += 6;
      const arH = nRows >= 15 ? 5.5 : (nRows > 5 ? 6.4 : 8);
      for (let i = 0; i < nRows; i++) {
        const d = data[i];
        let xx = M;
        [cNo, cTa, cRi, cCo].forEach(w => { cell(xx, y, w, arH); xx += w; });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); setText(BLACK);
        doc.text((i + 1) + '.-', M + 2, y + arH / 2 + 1);
        if (d) {
          doc.setFontSize(7.2);
          doc.text(doc.splitTextToSize(d.task || '', cTa - 3).slice(0, 2), M + cNo + 1.5, y + 3.4);
          doc.text(doc.splitTextToSize(d.risk || '', cRi - 3).slice(0, 2), M + cNo + cTa + 1.5, y + 3.4);
          doc.text(doc.splitTextToSize(d.control || '', cCo - 3).slice(0, 2), M + cNo + cTa + cRi + 1.5, y + 3.4);
        }
        y += arH;
      }
      return y;
    }

    return doc;
  }

  async function precargarFirmas(detail) {
    async function toDataURL(url) {
      if (!url) return null;
      if (String(url).startsWith('data:image')) return url;
      try { const r = await fetch(url); const b = await r.blob(); return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(b); }); } catch (_e) { return null; }
    }
    for (const c of (detail.crew || [])) c.signature_url = await toDataURL(c.signature_url);
    for (const a of (detail.approvals || [])) a.signature_dataurl = await toDataURL(a.signature_url || a.signature_dataurl);
    return detail;
  }

  root.generarJSAPDF = generarJSAPDF;
  root.precargarFirmasJSA = precargarFirmas;
  if (typeof module !== 'undefined' && module.exports) module.exports = { generarJSAPDF, precargarFirmas };

})(typeof window !== 'undefined' ? window : globalThis);
