// Tiendas Apple (Premium Reseller) que no usan VTEX ni Magento:
//  · iPoint (PrestaShop): su buscador devuelve JSON. El código de barras viene al final del link del producto.
//  · MacStation (Odoo): el autocompletar de la tienda devuelve nombre, precio, foto y link (sin código de barras).
// Devuelven el mismo formato que la API de las tiendas VTEX.

async function pedir(url, opciones, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 12000);
  try {
    const r = await fetch(url, Object.assign({ signal: ctrl.signal }, opciones || {}));
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const sinEtiquetas = s => String(s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const pesosAr = s => { const m = /([\d.]+(?:,\d+)?)/.exec(sinEtiquetas(s)); return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : 0; };
const ean13 = c => /^\d{12}$/.test(c) ? '0' + c : c;   // UPC de 12 dígitos -> EAN-13

function base(o) {
  return Object.assign({ marca: '', precio_lista: null, precio_promo: null, promo: '', promo_condicion: '', nota: '', exacto: false, sin_stock: false, rubro: '', sku: '', seller: '1' }, o);
}

// ---------- iPoint (PrestaShop) ----------
async function prestashop(host, { ean, q, limite }) {
  const buscar = async s => {
    const d = await pedir(host + '/busqueda?controller=search&resultsPerPage=' + Math.min(limite || 24, 36) + '&s=' + encodeURIComponent(s),
      { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': UA } });
    return (d.products || []).map(p => {
      const precio = Number(p.price_amount) || 0, regular = Number(p.regular_price_amount) || precio;
      if (!(precio > 0)) return null;
      const cod = (/-(\d{12,13})\.html/.exec(p.url || '') || [])[1] || '';
      return base({
        nombre: sinEtiquetas(p.name), marca: 'Apple', ean: ean13(cod), precio,
        precio_lista: regular > precio + 0.5 ? regular : null,
        promo: regular > precio + 0.5 ? Math.round((1 - precio / regular) * 100) + '% off' : '',
        imagen: ((p.cover && p.cover.bySize && (p.cover.bySize.home_default || p.cover.bySize.medium_default)) || {}).url || '',
        link: p.url || '', sku: String(p.id_product || ''), modelo: String(p.reference || ''), rubro: '',
      });
    }).filter(Boolean);
  };
  let out = [];
  if (ean) {
    out = await buscar(ean.replace(/^0(\d{12})$/, '$1'));   // la tienda busca por el UPC de 12 dígitos
    out.forEach(p => { if (p.ean === ean13(ean)) p.exacto = true; });
    if (!out.some(p => p.exacto)) out = [];
  }
  if (!out.length && q) out = await buscar(q);
  return out;
}

// ---------- MacStation (Odoo) ----------
async function odoo(host, { q, limite }) {
  if (!q) return [];
  let res = await odooBuscar(host, q, limite);
  // El buscador no encuentra "iPhone 17 256GB - Black": se reintenta sin la capacidad ni el color
  const corto = q.replace(/\s+-\s+.*$/, '').replace(/\b\d+\s*(GB|TB)\b.*$/i, '').trim();
  if (!res.length && corto && corto !== q) res = await odooBuscar(host, corto, limite);
  return res;
}
async function odooBuscar(host, q, limite) {
  const d = await pedir(host + '/website/snippet/autocomplete', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { search_type: 'products_only', term: q, order: 'list_price desc', limit: Math.min(limite || 24, 30), max_nb_chars: 200,
      options: { displayImage: true, displayDescription: false, displayExtraLink: false, displayDetail: true, allowFuzzy: true } } }),
  });
  const res = ((d && d.result) || {}).results || [];
  return res.map(r => {
    const precio = pesosAr(r.detail), regular = pesosAr(r.detail_strike) || precio;
    if (!(precio > 0)) return null;
    return base({
      nombre: sinEtiquetas(r.name), marca: 'Apple', ean: '', precio,
      precio_lista: regular > precio + 0.5 ? regular : null,
      promo: regular > precio + 0.5 ? Math.round((1 - precio / regular) * 100) + '% off' : '',
      imagen: r.image_url ? host + String(r.image_url).replace(/image_128$/, 'image_256') : '',
      link: r.website_url ? host + r.website_url : '', modelo: String(r.default_code || ''),
    });
  }).filter(Boolean);
}

module.exports = { prestashop, odoo };
