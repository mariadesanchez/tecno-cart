// Tus Carts · historial de precios de un producto (compartido por todas las apps, como nav-carts.js).
// tcHistorial.boton(ean, nombre, img) → botoncito "📈" que abre el modal.
// tcHistorial.abrir(ean, nombre, img) → modal con el gráfico del precio en cada tienda y el resumen.
// Lee la tabla historial_precios de Supabase con la sesión de la app (window.tcSb).
// Links desde el mail: ?hist=<código de barras> abre el modal al entrar (aunque haya que iniciar sesión antes).
(function(){
  if (window.tcHistorial) return;
  const DIAS = 90;
  const NOMBRES = {
    coto: 'Coto', carrefour: 'Carrefour', dia: 'Día', changomas: 'ChangoMás', jumbo: 'Jumbo', vea: 'Vea', disco: 'Disco',
    farmacity: 'Farmacity', farmaonline: 'Farmaonline', simplicity: 'Simplicity', pigmento: 'Pigmento', gpsfarma: 'GPS Farma',
    juleriaque: 'Juleriaque', rouge: 'Rouge', andromaco: 'Andrómaco', bago: 'Nutricia Bagó',
    naldo: 'Naldo', cetrogar: 'Cetrogar', oncity: 'On City', fravega: 'Frávega', samsung: 'Samsung', motorola: 'Motorola', rodo: 'Rodó', ipoint: 'iPoint', macstation: 'MacStation',
    cebra: 'Cebra', kinderland: 'Kinderland', brickstore: 'Brickstore', sporting: 'Sporting', grid: 'Grid', dexter: 'Dexter', moov: 'Moov', stockcenter: 'Stock Center',
  };
  const PALETA = ['#E2367F', '#1E9BFF', '#16A34A', '#F59E0B', '#7C3AED', '#0D9488', '#DC2626', '#64748B', '#DB2777', '#2563EB'];
  const nom = k => NOMBRES[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : '');
  const fmt = n => '$ ' + Math.round(n).toLocaleString('es-AR');
  const ddmm = iso => { const [, m, d] = String(iso).split('-'); return d + '/' + m; };
  const dia = iso => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5);
  const hoyIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  const css = `
  .tch-btn{appearance:none;border:1.5px solid var(--line,#e5e0ea);background:var(--card,#fff);color:var(--ink,#1b2140);font:inherit;font-size:12.5px;font-weight:700;
    border-radius:999px;padding:3px 10px 3px 8px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;margin-top:6px;line-height:1.3;white-space:nowrap}
  .tch-btn svg{width:15px;height:15px;fill:none;stroke:var(--sec2,#E2367F);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
  .tch-btn:hover{border-color:var(--sec2,#E2367F)}
  .ln .tch-ln{grid-column:1 / -1;justify-self:start;margin-top:2px}
  .tch-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(20,12,24,.55);display:flex;align-items:center;justify-content:center;padding:16px;animation:tchIn .15s ease}
  @keyframes tchIn{from{opacity:0}to{opacity:1}}
  .tch-m{position:relative;width:min(560px,100%);max-height:min(88vh,760px);overflow:auto;background:var(--card,#fff);color:var(--ink,#1b2140);border-radius:22px;
    box-shadow:0 20px 60px rgba(0,0,0,.35);padding:18px 18px 16px}
  .tch-x{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:0;background:var(--line,#eee);color:var(--ink,#222);font-size:17px;cursor:pointer}
  .tch-hd{display:flex;gap:12px;align-items:center;padding-right:36px}
  .tch-ph{flex:none;width:64px;height:64px;border-radius:12px;background:#fff;border:1px solid var(--line,#eee);display:grid;place-items:center;overflow:hidden}
  .tch-ph img{max-width:90%;max-height:90%;object-fit:contain}
  .tch-t{font-weight:800;font-size:16.5px;line-height:1.25}
  .tch-s{color:var(--muted,#777);font-size:13px;margin-top:2px}
  .tch-res{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0 6px}
  .tch-k{background:var(--bg,#f7f4fa);border-radius:14px;padding:9px 6px;text-align:center;min-width:0}
  .tch-k small{display:block;white-space:nowrap;color:var(--muted,#777);font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
  .tch-k b{display:block;font-size:16px;margin-top:2px;white-space:nowrap}
  .tch-k em{display:block;font-style:normal;color:var(--muted,#777);font-size:11.5px}
  .tch-k.low b{color:#15803d}
  .tch-k.high b{color:#be185d}
  .tch-g{margin-top:8px;width:100%;height:auto;display:block;overflow:visible}
  .tch-g text{font:12px system-ui,sans-serif;fill:var(--muted,#777)}
  .tch-ley{display:flex;flex-wrap:wrap;gap:6px 12px;margin:6px 0 4px;font-size:13px}
  .tch-ley span{display:inline-flex;align-items:center;gap:6px}
  .tch-ley i{width:12px;height:12px;border-radius:50%;display:inline-block}
  .tch-tab{width:100%;border-collapse:collapse;margin-top:10px;font-size:13.5px}
  .tch-tab th{text-align:left;color:var(--muted,#777);font-weight:600;font-size:12px;padding:6px 4px;border-bottom:1px solid var(--line,#eee)}
  .tch-tab td{padding:7px 4px;border-bottom:1px solid var(--line,#eee)}
  .tch-tab td:not(:first-child){white-space:nowrap}
  .tch-tab td:not(:first-child),.tch-tab th:not(:first-child){text-align:right}
  .tch-tab .of{color:#be185d;font-size:11.5px;font-weight:700}
  .tch-n{color:var(--muted,#777);font-size:12.5px;margin-top:10px;line-height:1.4}
  .tch-msg{padding:26px 10px;text-align:center;color:var(--muted,#777)}
  .tch-voz{appearance:none;border:0;cursor:pointer;margin:12px 0 2px;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;
    background:linear-gradient(180deg,#F25C9B,#E2367F);color:#fff;font:inherit;font-weight:800;font-size:15px;border-radius:14px;padding:11px 14px;box-shadow:0 3px 0 #b3165d}
  .tch-voz:active{transform:translateY(2px);box-shadow:0 1px 0 #b3165d}
  .tch-voz.on{background:linear-gradient(180deg,#6b6878,#4b4858);box-shadow:0 3px 0 #33313d}
  .tch-voz svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
  .tch-exp{background:var(--bg,#f7f4fa);border-radius:14px;padding:12px 14px;margin-top:8px;font-size:14.5px;line-height:1.55}
  .tch-exp p{margin:0 0 8px}.tch-exp p:last-child{margin:0}
  .tch-exp p.rec{font-weight:700;color:var(--ink,#1b2140);border-top:1px dashed var(--line,#ddd);padding-top:8px}
  .tch-exp p.hab{background:color-mix(in srgb,#E2367F 14%,transparent);border-radius:8px;padding:2px 6px;margin-left:-6px;margin-right:-6px}
  .tch-tip{position:absolute;pointer-events:none;background:var(--ink,#222);color:var(--card,#fff);font-size:12px;border-radius:8px;padding:5px 8px;white-space:nowrap;transform:translate(-50%,-110%)}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>';
  function boton(ean, nombre, img){
    if (!ean || !/^\d{6,14}$/.test(String(ean))) return document.createDocumentFragment();
    const b = el('button', 'tch-btn'); b.type = 'button'; b.innerHTML = ICO + '<span>Historial</span>';
    b.title = 'Ver el historial de precios'; b.setAttribute('aria-label', 'Historial de precios de ' + (nombre || 'este producto'));
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); abrir(ean, nombre, img); });
    return b;
  }

  async function sesion(){
    const sb = window.tcSb; if (!sb) return null;
    try { const { data } = await sb.auth.getSession(); return data && data.session ? sb : null; } catch (e) { return null; }
  }

  let abierto = null;
  function cerrar(){ callar(); if (abierto) { abierto.remove(); abierto = null; document.removeEventListener('keydown', esc); } }
  function esc(e){ if (e.key === 'Escape') cerrar(); }

  async function abrir(ean, nombre, img){
    cerrar();
    const ov = el('div', 'tch-ov'), m = el('div', 'tch-m'); m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    const x = el('button', 'tch-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar'); x.addEventListener('click', cerrar);
    const hd = el('div', 'tch-hd'), ph = el('div', 'tch-ph'), tx = el('div');
    if (img) { const i = el('img'); i.src = img; i.alt = ''; i.onerror = () => { ph.textContent = '🛒'; }; ph.appendChild(i); } else ph.textContent = '🛒';
    const t = el('div', 'tch-t', nombre || 'Producto'), s = el('div', 'tch-s', 'Historial de precios · código ' + ean);
    tx.append(t, s); hd.append(ph, tx);
    const cuerpo = el('div'); cuerpo.appendChild(el('div', 'tch-msg', 'Buscando el historial…'));
    m.append(x, hd, cuerpo); ov.appendChild(m);
    ov.addEventListener('click', e => { if (e.target === ov) cerrar(); });
    document.addEventListener('keydown', esc);
    document.body.appendChild(ov); abierto = ov; x.focus();

    const sb = await sesion();
    if (!sb) { cuerpo.innerHTML = ''; cuerpo.appendChild(el('div', 'tch-msg', 'Ingresá a tu cuenta para ver el historial de precios.')); return; }
    const desde = new Date(Date.now() - DIAS * 864e5).toISOString().slice(0, 10);
    const { data, error } = await sb.from('historial_precios').select('super,fecha,hasta,precio,precio_promo,promo,nombre')
      .eq('ean', String(ean)).gte('hasta', desde).order('fecha', { ascending: true }).limit(2000);
    if (abierto !== ov) return;
    cuerpo.innerHTML = '';
    if (error) { cuerpo.appendChild(el('div', 'tch-msg', 'No se pudo leer el historial. Probá de nuevo en un rato.')); return; }
    const filas = (data || []).filter(r => (r.precio_promo || r.precio) > 0);
    if (!filas.length) { cuerpo.appendChild(el('div', 'tch-msg', 'Todavía no hay historial de este producto. Se empieza a guardar todos los días desde que está en una lista.')); return; }
    if (!nombre || nombre === 'Producto') { const n = filas[filas.length - 1].nombre; if (n) t.textContent = n; }
    pintar(cuerpo, filas, desde);
  }

  function pintar(cuerpo, filas, desde){
    const hoy = hoyIso();
    const porT = new Map();
    filas.forEach(r => { if (!porT.has(r.super)) porT.set(r.super, []); porT.get(r.super).push(r); });
    const tiendas = [...porT.keys()];
    const v = r => (r.precio_promo && r.precio_promo < r.precio - 0.5 ? r.precio_promo : r.precio);
    // Resumen: hoy (lo último visto, el más barato), mínimo y máximo del período
    let min = null, max = null;
    filas.forEach(r => { const p = v(r); if (!min || p < min.p) min = { p, r }; if (!max || p > max.p) max = { p, r }; });
    const ultimos = tiendas.map(k => { const rs = porT.get(k); return { k, r: rs[rs.length - 1] }; });
    const fin = ultimos.reduce((a, b) => (a > b.r.hasta ? a : b.r.hasta), '');
    const actuales = ultimos.filter(u => u.r.hasta === fin).sort((a, b) => v(a.r) - v(b.r));
    const act = actuales[0];
    const res = el('div', 'tch-res');
    const kpi = (cls, tit, val, sub) => { const k = el('div', 'tch-k ' + cls); k.append(el('small', '', tit), el('b', '', val), el('em', '', sub)); res.appendChild(k); };
    kpi('', fin === hoy ? 'Hoy' : 'Último (' + ddmm(fin) + ')', fmt(v(act.r)), nom(act.k));
    kpi('low', 'Más bajo', fmt(min.p), nom(min.r.super) + ' · ' + ddmm(min.r.fecha));
    kpi('high', 'Más alto', fmt(max.p), nom(max.r.super) + ' · ' + ddmm(max.r.fecha));
    cuerpo.appendChild(res);
    const ini0 = filas.reduce((a, r) => (r.fecha < a ? r.fecha : a), filas[0].fecha);
    const partes = explicar(filas, porT, v, fin, ini0 < desde ? desde : ini0, act, min, max);
    if (partes.length) {
      const vb = el('button', 'tch-voz'); vb.type = 'button';
      const exp = el('div', 'tch-exp'); exp.hidden = true;
      partes.forEach(pt => { const p = el('p', pt.rec ? 'rec' : '', pt.txt); exp.appendChild(p); });
      const icoOn = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
      const icoOff = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
      const pintarB = on => { vb.classList.toggle('on', on); vb.innerHTML = (on ? icoOff : icoOn) + '<span>' + (on ? 'Detener' : 'Escuchar la explicación') + '</span>'; };
      pintarB(false);
      vb.addEventListener('click', () => {
        exp.hidden = false;
        if (hablando()) { callar(); pintarB(false); return; }
        const ok = decir(partes, exp, () => pintarB(false));
        pintarB(ok);
      });
      cuerpo.append(vb, exp);
    }

    // Gráfico: un escalón por tienda (el precio se mantiene desde "fecha" hasta "hasta"; si no se vio, la línea se corta)
    const ini = filas.reduce((a, r) => (r.fecha < a ? r.fecha : a), filas[0].fecha), d0 = dia(ini < desde ? desde : ini), d1 = Math.max(dia(fin), d0 + 1);
    const W = 380, H = 210, L = 54, R = 8, T = 10, B = 24;
    const span = max.p - min.p || max.p * .1 || 1, ymin = Math.max(0, min.p - span * .12), ymax = max.p + span * .12;
    const X = d => L + (d - d0) / (d1 - d0) * (W - L - R), Y = p => T + (1 - (p - ymin) / (ymax - ymin)) * (H - T - B);
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'tch-g'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Gráfico del precio en cada tienda desde el ' + ddmm(ini));
    const add = (tag, at, txt) => { const e = document.createElementNS(NS, tag); Object.entries(at).forEach(([a, b]) => e.setAttribute(a, b)); if (txt != null) e.textContent = txt; svg.appendChild(e); return e; };
    for (let i = 0; i <= 3; i++) {
      const p = ymin + (ymax - ymin) * i / 3, y = Y(p);
      add('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: 'currentColor', 'stroke-opacity': .12 });
      add('text', { x: L - 6, y: y + 4, 'text-anchor': 'end' }, fmt(p).replace('$ ', '$'));
    }
    const nT = Math.min(4, d1 - d0);
    for (let i = 0; i <= nT; i++) {
      const d = Math.round(d0 + (d1 - d0) * i / nT), iso = new Date(d * 864e5).toISOString().slice(0, 10);
      add('text', { x: X(d), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === nT ? 'end' : 'middle' }, ddmm(iso));
    }
    const ley = el('div', 'tch-ley');
    tiendas.forEach((k, i) => {
      const c = PALETA[i % PALETA.length], rs = porT.get(k);
      let dpath = '', prevFin = null;
      rs.forEach(r => {
        const a = Math.max(dia(r.fecha), d0), b = r.hasta === fin ? dia(fin) : dia(r.hasta) + 1, y = Y(v(r));
        if (b < d0) return;
        const xa = X(a), xb = X(Math.min(Math.max(b, a), d1));
        dpath += (prevFin !== null && prevFin >= a - 1 ? ` L${xa.toFixed(1)},${y.toFixed(1)}` : ` M${xa.toFixed(1)},${y.toFixed(1)}`) + ` L${Math.max(xb, xa + 3).toFixed(1)},${y.toFixed(1)}`;
        prevFin = dia(r.hasta);
        if (r.precio_promo && r.precio_promo < r.precio - 0.5) add('circle', { cx: xa, cy: y, r: 3.2, fill: c });
      });
      add('path', { d: dpath, fill: 'none', stroke: c, 'stroke-width': 2.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
      const s = el('span'); const dot = el('i'); dot.style.background = c; s.append(dot, nom(k)); ley.appendChild(s);
    });
    cuerpo.append(ley, svg);

    // Tabla por tienda: precio actual, el más bajo y cuántas veces estuvo en oferta
    const tab = el('table', 'tch-tab'), th = el('tr');
    ['Tienda', 'Último', 'Más bajo', 'Ofertas'].forEach(h => th.appendChild(el('th', '', h)));
    const thead = el('thead'); thead.appendChild(th); tab.appendChild(thead);
    const tb = el('tbody');
    ultimos.sort((a, b) => v(a.r) - v(b.r)).forEach(u => {
      const rs = porT.get(u.k), mn = rs.reduce((a, r) => (v(r) < v(a) ? r : a), rs[0]);
      const tr = el('tr'), td1 = el('td'); td1.appendChild(el('b', '', nom(u.k)));
      if (u.r.hasta !== fin) td1.appendChild(el('div', 'tch-s', 'visto hasta el ' + ddmm(u.r.hasta)));
      const td2 = el('td', '', fmt(v(u.r)));
      if (u.r.precio_promo && u.r.precio_promo < u.r.precio - 0.5) { td2.appendChild(document.createElement('br')); td2.appendChild(el('span', 'of', String(u.r.promo || 'oferta').split(' · ')[0])); }
      const td3 = el('td', '', fmt(v(mn))); td3.appendChild(el('div', 'tch-s', ddmm(mn.fecha)));
      tr.append(td1, td2, td3, el('td', '', String(rs.filter(r => r.precio_promo && r.precio_promo < r.precio - 0.5).length)));
      tb.appendChild(tr);
    });
    tab.appendChild(tb); cuerpo.appendChild(tab);
    const desdeTxt = ddmm(ini);
    cuerpo.appendChild(el('div', 'tch-n', `Precios online guardados todos los días desde el ${desdeTxt}. Los puntos marcan los días con oferta. Precio con la oferta aplicada (en promos de “llevando N”, el precio por unidad llevando N).`));
  }

  // ---------- Explicación en palabras (y en voz alta) de lo que pasó con el precio ----------
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fechaL = iso => +iso.slice(8, 10) + ' de ' + MESES[+iso.slice(5, 7) - 1];
  const isoDe = d => new Date(d * 864e5).toISOString().slice(0, 10);
  const pct = (a, b) => Math.round((a / b - 1) * 100);
  const lista = xs => xs.length <= 1 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
  function rango(a, b){
    if (a === b) return 'el ' + fechaL(a);
    if (a.slice(5, 7) === b.slice(5, 7)) return 'del ' + (+a.slice(8, 10)) + ' al ' + fechaL(b);
    return 'del ' + fechaL(a) + ' al ' + fechaL(b);
  }
  function explicar(filas, porT, v, fin, ini, act, min, max){
    const out = [], tiendas = [...porT.keys()];
    const dIni = dia(ini), dFin = dia(fin);
    out.push({ txt: `Desde el ${fechaL(ini)} seguimos este producto en ${tiendas.length === 1 ? nom(tiendas[0]) : tiendas.length + ' tiendas: ' + lista(tiendas.map(nom))}.` });
    // Hoy
    const vAct = v(act.r), conOf = act.r.precio_promo && act.r.precio_promo < act.r.precio - 0.5;
    out.push({ txt: `${dia(fin) >= dia(hoyIso()) - 1 ? 'Hoy' : 'Lo último que vimos, el ' + fechaL(fin) + ','} el más barato está en ${nom(act.k)}, a ${fmt(vAct)}` + (conOf ? `, con oferta (${String(act.r.promo || 'descuento').split(' · ')[0]}).` : '.') });
    // Quién fue el más barato cada día, agrupado en tramos
    const tramos = [];
    for (let d = dIni; d <= dFin; d++) {
      let mejor = null;
      tiendas.forEach(k => { const r = porT.get(k).find(x => dia(x.fecha) <= d && d <= dia(x.hasta)); if (r && (!mejor || v(r) < mejor.p - 0.5)) mejor = { k, p: v(r) }; });
      if (!mejor) continue;
      const u = tramos[tramos.length - 1];
      if (u && u.k === mejor.k && u.b === d - 1) u.b = d; else tramos.push({ k: mejor.k, a: d, b: d });
    }
    if (tiendas.length > 1 && tramos.length) {
      if (tramos.length === 1) out.push({ txt: `${nom(tramos[0].k)} fue siempre el más barato, todos los días.` });
      else {
        const frases = tramos.slice(0, 5).map(t => `${nom(t.k)} ${rango(isoDe(t.a), isoDe(t.b))}`);
        out.push({ txt: `El más barato fue cambiando: ${lista(frases)}${tramos.length > 5 ? ', entre otros cambios' : ''}.` });
      }
      // La tienda que más días lo tuvo más barato
      const dias = {}; tramos.forEach(t => { dias[t.k] = (dias[t.k] || 0) + t.b - t.a + 1; });
      const tot = Object.values(dias).reduce((a, b) => a + b, 0), top = Object.entries(dias).sort((a, b) => b[1] - a[1])[0];
      if (tramos.length > 1 && top && tot >= 4) out.push({ txt: `${nom(top[0])} fue la tienda que más días lo tuvo más barato: ${top[1]} de ${tot}.`, top: top[0], share: top[1] / tot });
    }
    // Qué pasó en cada tienda
    tiendas.forEach(k => {
      const rs = porT.get(k), a = v(rs[0]), b = v(rs[rs.length - 1]), nOf = rs.filter(r => r.precio_promo && r.precio_promo < r.precio - 0.5).length;
      const mn = Math.min(...rs.map(v)), mx = Math.max(...rs.map(v));
      let t;
      if (mx - mn < Math.max(1, mn * 0.01)) t = `En ${nom(k)} se mantuvo en ${fmt(b)}`;
      else if (b > a * 1.02) t = `En ${nom(k)} subió de ${fmt(a)} a ${fmt(b)}, un ${pct(b, a)}% más`;
      else if (b < a * 0.98) t = `En ${nom(k)} bajó de ${fmt(a)} a ${fmt(b)}, un ${-pct(b, a)}% menos`;
      else t = `En ${nom(k)} varió entre ${fmt(mn)} y ${fmt(mx)}, y hoy está en ${fmt(b)}`;
      if (nOf && nOf === rs.length) t += ', siempre con oferta'; else if (nOf) t += nOf === 1 ? ', con una oferta en el período' : `, con ${nOf} ofertas en el período`;
      if (rs[rs.length - 1].hasta !== fin) t += `. No lo vemos desde el ${fechaL(rs[rs.length - 1].hasta)}`;
      out.push({ txt: t + '.' });
    });
    // Recomendación
    const sobreMin = vAct / min.p - 1;
    let rec;
    if (sobreMin <= 0.02) rec = `Buen momento para comprar: ${fmt(vAct)} es el precio más bajo que vimos desde el ${fechaL(ini)}.`;
    else if (sobreMin <= 0.08) rec = `Está cerca de su mínimo (${fmt(min.p)}, en ${nom(min.r.super)} el ${fechaL(min.r.fecha)}): comprarlo hoy en ${nom(act.k)} es razonable.`;
    else {
      rec = `Hoy está un ${Math.round(sobreMin * 100)}% arriba del precio más bajo que vimos (${fmt(min.p)}, en ${nom(min.r.super)} el ${fechaL(min.r.fecha)}).`;
      const ofs = filas.filter(r => r.precio_promo && r.precio_promo < r.precio - 0.5).length;
      rec += ofs >= 2 ? ' Si no lo necesitás ya, conviene esperar: suele entrar en oferta.' : ' Si podés esperar unos días, quizás baje.';
    }
    const top = out.find(x => x.top);
    if (top && top.share >= 0.6 && top.top !== act.k) rec += ` Para tener en cuenta: ${nom(top.top)} suele ser la más barata para este producto.`;
    out.push({ txt: rec, rec: true });
    return out;
  }
  // Voz: la del celular o la compu (Web Speech), en español. Los precios se dicen como números enteros.
  const voz = () => window.speechSynthesis;
  const hablando = () => !!(voz() && (voz().speaking || voz().pending));
  function callar(){ try { if (voz()) voz().cancel(); } catch (e) {} if (abierto) abierto.querySelectorAll('.tch-exp p.hab').forEach(p => p.classList.remove('hab')); }
  function vozEs(){
    const vs = (voz() && voz().getVoices()) || [];
    return vs.find(x => /^es[-_]AR/i.test(x.lang)) || vs.find(x => /^es[-_](419|US|MX|UY|CL|CO)/i.test(x.lang)) || vs.find(x => /^es/i.test(x.lang)) || null;
  }
  const paraDecir = t => t.replace(/\$ ?([\d.]+)/g, (m, n) => n.replace(/\./g, '') + ' pesos').replace(/(\d+)%/g, '$1 por ciento').replace(/\boff\b/gi, 'de descuento').replace(/\bDto\b/g, ' de descuento');
  function decir(partes, exp, alTerminar){
    if (!voz() || typeof SpeechSynthesisUtterance === 'undefined') { alTerminar(); return false; }
    callar();
    const ps = [...exp.querySelectorAll('p')], vz = vozEs();
    partes.forEach((pt, i) => {
      const u = new SpeechSynthesisUtterance(paraDecir(pt.txt));
      u.lang = vz ? vz.lang : 'es-AR'; if (vz) u.voice = vz; u.rate = 1.02;
      u.onstart = () => { ps.forEach(p => p.classList.remove('hab')); if (ps[i]) { ps[i].classList.add('hab'); ps[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } };
      if (i === partes.length - 1) u.onend = u.onerror = () => { ps.forEach(p => p.classList.remove('hab')); alTerminar(); };
      voz().speak(u);
    });
    return true;
  }
  try { if (voz()) { voz().getVoices(); voz().onvoiceschanged = () => voz().getVoices(); } } catch (e) {}

  // Link desde el mail: ?hist=<ean>&hn=<nombre>. Se guarda por si hay que iniciar sesión, y se abre cuando la sesión está lista.
  try {
    const q = new URLSearchParams(location.search), h = (q.get('hist') || '').replace(/\D/g, '');
    if (h) {
      sessionStorage.setItem('tc-hist', JSON.stringify({ ean: h, n: q.get('hn') || '' }));
      q.delete('hist'); q.delete('hn');
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    }
  } catch (e) {}
  let intentos = 0;
  const pendiente = setInterval(async () => {
    let p = null; try { p = JSON.parse(sessionStorage.getItem('tc-hist') || 'null'); } catch (e) {}
    if (!p || ++intentos > 60) { clearInterval(pendiente); return; }
    if (await sesion()) { clearInterval(pendiente); sessionStorage.removeItem('tc-hist'); abrir(p.ean, p.n || 'Producto'); }
  }, 1000);

  window.tcHistorial = { boton, abrir, cerrar };
})();
