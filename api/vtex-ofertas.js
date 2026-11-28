// Tecno Cart · ofertas por rubro, con mayor descuento primero: Naldo, Cetrogar, Samsung y Motorola (VTEX).
// Rodó (Magento) todavía no tiene listado de ofertas.
// Usa el buscador público de cada tienda online. No son APIs oficiales.
//   /api/vtex-ofertas?tienda=farmacity&rubros=1          -> rubros con su cantidad de ofertas
//   /api/vtex-ofertas?tienda=farmacity&rubro=123&page=1  -> 50 productos por página, con descuento primero

const { mapear, TIENDAS, leerPromos } = require('./vtex.js')._test;

const POR_PAGINA = 50;
const MAX_DESDE = 2450;   // VTEX no deja paginar más allá de 2500 productos
const MAX_PAGINAS = MAX_DESDE / 50 + 1;
const GENERICO = /^(integraciones|category|regaler|regalos|moda|m[aá]s categor|test|gift|garant|sin categor|felices fiestas|huevos de pascua|luces|ofertas?|promociones?|novedades|destacados|todos?|cat[aá]logo|marcas?|outlet|black|hot ?sale|cyber|navidad|d[ií]a del|vuelta|liquidaci[oó]n|especial|exclusivo)/i;

async function pedir(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok && r.status !== 206) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

function lindo(s) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (s === s.toUpperCase() || s === s.toLowerCase()) s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Producto VTEX -> oferta con el formato de /api/coto-ofertas
function aOferta(p, rubro) {
  const regular = p.precio_lista && p.precio_lista > p.precio ? p.precio_lista : p.precio;
  const oferta = p.precio_promo || (regular > p.precio ? p.precio : null);
  if (!oferta || oferta >= regular - 0.5 || p.sin_stock) return null;
  const pct = Math.round((1 - oferta / regular) * 100);
  if (pct < 5) return null;   // diferencias mínimas entre precio de lista y precio no son una oferta
  return {
    id: p.ean || p.nombre, ean: p.ean, producto: p.nombre, marca: p.marca, rubro: p.rubro || rubro || '',
    regular, oferta: Math.round(oferta * 100) / 100, descuento: pct,
    promo: p.promo || (pct + '% off'), condicion: [p.promo_condicion, p.nota].filter(Boolean).join('. '),
    imagen: p.imagen, link: p.link || '',
  };
}

// Productos con descuento en una página del rubro (vienen ordenados por mayor descuento)
async function ofertasDePagina(host, rubro, page) {
  const desde = (page - 1) * POR_PAGINA;
  const lista = await pedir(host + '/api/catalog_system/pub/products/search?fq=C:/' + rubro + '/&O=OrderByBestDiscountDESC&_from=' + desde + '&_to=' + (desde + POR_PAGINA - 1));
  const productos = Array.isArray(lista) ? lista : [];
  return { productos, ofertas: mapear(productos).map(p => aOferta(p)).filter(Boolean) };
}

// Cuántas ofertas muestra la lista de un rubro: recorre sus páginas (de a 8 en paralelo) hasta la última, con el mismo criterio de fin
async function contar(host, rubro, hasta) {
  let total = 0;
  for (let p = 1; p <= MAX_PAGINAS; p += 8) {
    if (Date.now() > hasta) return null;
    const lote = [];
    for (let k = p; k < p + 8 && k <= MAX_PAGINAS; k++) lote.push(k);
    const res = await Promise.all(lote.map(k => ofertasDePagina(host, rubro, k).catch(() => null)));
    for (let i = 0; i < res.length; i++) {
      const r = res[i];
      if (!r) return null;
      total += r.ofertas.length;
      if (esFin(r, lote[i])) return total;
    }
  }
  return total;
}
const esFin = (r, page) => r.productos.length < POR_PAGINA || r.ofertas.length < 3 || page >= MAX_PAGINAS;

const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const q = req.query || {};
  const clave = String(q.tienda || '').toLowerCase();
  const tienda = TIENDAS[clave];
  if (!tienda) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Tienda desconocida' })); }
  try {
    if (tienda.magento) {
      // Rodó: sin listado de ofertas por ahora (sus precios sí se comparan en la búsqueda y en las listas)
      if (q.todas) return res.end(JSON.stringify({ ok: true, super: tienda.nombre, total: 0, completo: true, ofertas: [] }));
      if (q.rubros) return res.end(JSON.stringify({ ok: true, super: tienda.nombre, total: 0, rubros: [] }));
      return res.end(JSON.stringify({ ok: true, super: tienda.nombre, page: 1, ofertas: [], fin: true }));
    }
    if (q.rubros) {
      const arbol = await pedir(tienda.host + '/api/catalog_system/pub/category/tree/1');
      const rubros = (Array.isArray(arbol) ? arbol : [])
        .filter(c => c && c.id && c.name && !GENERICO.test(c.name))
        .map(c => ({ id: String(c.id), nombre: lindo(c.name), ofertas: null, paginas: null }));
      // Contar las ofertas de cada rubro (en paralelo, con un tope de tiempo para no colgar la página)
      const hasta = Date.now() + 25000;
      const cuentas = await Promise.all(rubros.map(r => contar(tienda.host, r.id, hasta).catch(() => null)));
      rubros.forEach((r, i) => { if (cuentas[i] != null) r.ofertas = cuentas[i]; });
      const completo = cuentas.every(c => c != null);
      const conOfertas = rubros.filter(r => r.ofertas !== 0);
      const total = conOfertas.reduce((a, r) => a + (r.ofertas || 0), 0) || null;   // si algún rubro no se llegó a contar, es la suma de los contados
      res.setHeader('Cache-Control', completo ? 's-maxage=21600, stale-while-revalidate=86400' : 's-maxage=300');
      return res.end(JSON.stringify({ ok: true, super: tienda.nombre, total, parcial: !completo, rubros: conOfertas }));
    }
    const rubro = String(q.rubro || '').replace(/\D/g, '');
    if (!rubro) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Falta el rubro' })); }
    const page = Math.max(parseInt(q.page, 10) || 1, 1);
    if (page > MAX_PAGINAS) return res.end(JSON.stringify({ ok: true, ofertas: [], fin: true }));
    const r = await ofertasDePagina(tienda.host, rubro, page);
    const ofertas = r.ofertas.map(o => Object.assign(o, { rubro: o.rubro || q.nombre || '' }));
    const fin = esFin(r, page);
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.end(JSON.stringify({ ok: true, super: tienda.nombre, page, ofertas, fin }));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: 'No se pudo consultar a ' + tienda.nombre }));
  }
}

module.exports = handler;
