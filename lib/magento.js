// Tiendas en Magento 2 (por ahora Rodó): se consulta su GraphQL público.
// Devuelve los productos con el mismo formato que la API de las tiendas VTEX.
// En electro casi nunca publican el código de barras: se busca por nombre y se reconoce el producto por el modelo.

const CAMPOS = `sku name url_key url_suffix stock_status small_image { url }
  categories { name level url_path }
  price_range { minimum_price { regular_price { value } final_price { value } } }`;

async function gql(host, query, variables, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 12000);
  try {
    const r = await fetch(host + '/graphql', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ query, variables }),
    });
    const j = await r.json();
    if (j.errors && !j.data) throw new Error(j.errors[0].message);
    return j.data;
  } finally { clearTimeout(t); }
}

function lindo(s) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (s === s.toUpperCase() || s === s.toLowerCase()) s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Rubro: la primera categoría debajo de la raíz ("Productos" en Rodó)
function rubro(p) {
  const c = (p.categories || []).filter(x => x.level === 3).sort((a, b) => a.url_path.length - b.url_path.length)[0];
  return c ? lindo(c.name) : '';
}

function mapear(host, items) {
  return (items || []).map(p => {
    const mp = (p.price_range || {}).minimum_price || {};
    const regular = (mp.regular_price || {}).value || 0, final = (mp.final_price || {}).value || regular;
    if (!(final > 0)) return null;
    return {
      nombre: p.name || '',
      marca: '',
      ean: '',
      precio: final,
      precio_lista: regular > final + 0.5 ? regular : null,
      precio_promo: null,
      promo: regular > final + 0.5 ? Math.round((1 - final / regular) * 100) + '% off' : '',
      promo_condicion: '',
      nota: '',
      imagen: ((p.small_image || {}).url || '').split('?')[0],
      exacto: false,
      sin_stock: p.stock_status === 'OUT_OF_STOCK',
      rubro: rubro(p),
      link: p.url_key ? host + '/' + p.url_key + (p.url_suffix || '.html') : '',
      sku: String(p.sku || ''),
      seller: '1',
    };
  }).filter(Boolean);
}

async function buscar(host, { q, limite }) {
  if (!q) return [];
  const d = await gql(host, `query($q:String!,$n:Int!){ products(search:$q, pageSize:$n){ items { ${CAMPOS} } } }`, { q, n: Math.min(limite || 24, 40) });
  return mapear(host, ((d || {}).products || {}).items);
}

module.exports = { buscar, mapear };
