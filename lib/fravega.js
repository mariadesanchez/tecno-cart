// Frávega: se lee del mismo buscador que usa su web (www.fravega.com/api/v2), no del catálogo VTEX viejo.
// El catálogo viejo mostraba productos que ya no se venden y precios desactualizados
// (ej. Telefunken TFE250: $ 91.870 en el catálogo, $ 193.408 en la web).
const HOST = 'https://www.fravega.com';
const IMG = 'https://images.fravega.com/f300/';
const QUERY = `query items($filters: Filters, $pagination: Pagination, $sorting: SortOption) {
  items(filters: $filters, pagination: $pagination, sorting: $sorting) {
    total
    results { code images item { id title slug brand { name } } seller { commercialName } pricing { salePrice listPrice discount } }
  }
}`;

async function pedir(variables) {
  const r = await fetch(HOST + '/api/v2', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', accept: 'application/json',
      origin: HOST, referer: HOST + '/',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36',
    },
    body: JSON.stringify({ operationName: 'items', query: QUERY, variables }),
  });
  if (!r.ok) throw new Error('Frávega ' + r.status);
  const j = await r.json();
  if (j.errors && !(j.data && j.data.items)) throw new Error('Frávega: ' + (j.errors[0] && j.errors[0].message));
  return (j.data && j.data.items && j.data.items.results) || [];
}

async function buscar({ q, limite }) {
  if (!q) return [];
  const variables = { filters: { keywords: q, zones: [] }, pagination: { size: Math.min(limite || 24, 50), from: 0 }, sorting: 'RELEVANCE' };
  let res;
  try { res = await pedir(variables); } catch (e) { delete variables.sorting; res = await pedir(variables); }
  return res.map(x => {
    const it = x.item || {}, pr = x.pricing || {}, precio = Number(pr.salePrice) || 0;
    if (!(precio > 0) || !x.code) return null;
    const lista = Number(pr.listPrice) || 0, vendedor = String((x.seller && x.seller.commercialName) || '').trim();
    return {
      nombre: String(it.title || '').replace(/\s+/g, ' ').trim(),
      marca: (it.brand && it.brand.name) || '',
      ean: '',
      precio,
      precio_lista: lista > precio && lista < precio * 4 ? lista : null,
      precio_promo: null,
      promo: pr.discount > 0 ? pr.discount + '% OFF' : '',
      promo_condicion: '',
      nota: vendedor && !/^fr[aá]vega$/i.test(vendedor) ? 'Vendido por ' + vendedor : '',
      por_peso: false, precio_por_medida: null, medida: '',
      imagen: x.images && x.images[0] ? IMG + x.images[0] : '',
      exacto: false,
      sin_stock: false,
      rubro: '',
      link: HOST + '/p/' + String(it.slug || 'producto') + '-' + x.code + '/',
      modelo: '',
      sku: String(x.code),
      seller: '1',
    };
  }).filter(Boolean);
}

module.exports = { buscar };
