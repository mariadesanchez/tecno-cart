// Tecno Cart · busca productos de tecnología y electro en tiendas online (por código de barras, por nombre o por modelo):
// Naldo, Cetrogar, On City, Samsung y Motorola (plataforma VTEX) y Rodó (Magento, ver lib/magento.js).
// Usa el buscador público de cada tienda. No son APIs oficiales. Todas devuelven el mismo formato.
// Uso: /api/vtex?tienda=naldo&ean=7798186921234   o   /api/vtex?tienda=rodo&q=heladera drean

const TIENDAS = {
  naldo:    { nombre: 'Naldo',    host: 'https://www.naldo.com.ar' },
  cetrogar: { nombre: 'Cetrogar', host: 'https://www.cetrogar.com.ar' },
  oncity:   { nombre: 'On City',  host: 'https://www.oncity.com' },
  samsung:  { nombre: 'Samsung',  host: 'https://shop.samsung.com/ar' },
  motorola: { nombre: 'Motorola', host: 'https://www.motorola.com.ar' },
  rodo:     { nombre: 'Rodó',     host: 'https://www.rodo.com.ar', magento: true },
  ipoint:   { nombre: 'iPoint',   host: 'https://ipoint.com.ar', prestashop: true },
  macstation: { nombre: 'MacStation', host: 'https://www.macstation.com.ar', odoo: true },
};
const magento = require('../lib/magento.js');
const otras = require('../lib/otras.js');

// Productos Apple: los nombres no traen un modelo ("iPhone 17 Pro 256GB Negro"), así que se reconocen por
// familia + variante + capacidad (sin el color, que no cambia el precio). Los accesorios quedan afuera.
function claveApple(nombre, sinCapacidad) {
  const n = String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (/FUNDA|CASE|CABLE|CARGADOR|ADAPTADOR|VIDRIO|PROTECTOR|FILM|SOPORTE|CORREA|MALLA|PENCIL|TECLADO|MOUSE|BATERIA|ESTUCHE|LAMINA|CRISTAL/.test(n)) return '';
  const cap = [...n.matchAll(/(\d+)\s*(GB|TB)\b/g)].map(m => +m[1] * (m[2] === 'TB' ? 1024 : 1)).sort((a, b) => b - a)[0];
  let m;
  if ((m = /IPHONE\s*(\d{1,2})\s*(E\b)?/.exec(n))) {
    const v = ['PRO', 'MAX', 'PLUS', 'MINI', 'AIR'].filter(x => new RegExp('\\b' + x + '\\b').test(n)).join(' ');
    const base = 'APPLE IPHONE ' + m[1] + (m[2] ? 'E' : '') + (v ? ' ' + v : '');
    return cap ? base + ' ' + cap + 'GB' : (sinCapacidad ? base : '');
  }
  if ((m = /AIRPODS\s*(PRO|MAX)?\s*(\d)?/.exec(n))) return 'APPLE AIRPODS' + (m[1] ? ' ' + m[1] : '') + (m[2] ? ' ' + m[2] : '');
  return '';
}

// Modelo del producto: palabras con letras y números (HDR370F50B, SM-A165M, 55UT8000), sin medidas ni capacidades
const MEDIDA = /^\d+(?:[.,]\d+)?(GB|TB|MB|MAH|W|HZ|LT|L|KG|CM|MM|MP|FPS|V|BTU|FRIGORIAS|PULG|P)$/;
function modelos(nombre) {
  const a = claveApple(nombre);
  return new Set((a ? [a] : []).concat([...modelosSin(nombre)]));
}
function modelosSin(nombre) {
  return new Set(String(nombre || '').toUpperCase().replace(/[^A-Z0-9\-\/ ]/g, ' ').split(/[\s\/]+/)
    .map(t => t.replace(/^-+|-+$/g, ''))
    .filter(t => t.length >= 5 && /[A-Z]/.test(t) && /\d/.test(t) && !MEDIDA.test(t) && !/^\dG$/.test(t)));
}
// Si no se encontró por código de barras, el producto con el mismo modelo que el nombre buscado es "el mismo"
function marcarPorModelo(productos, q) {
  const buscado = modelos(q);
  if (!buscado.size || productos.some(p => p.exacto)) return productos;
  const p = productos.find(x => [...modelos(x.nombre)].some(m => buscado.has(m) || buscado.has(m.replace(/-/g, ''))));
  if (p) { p.exacto = true; p.por_modelo = true; return productos; }
  // Tiendas que publican el iPhone sin la capacidad (MacStation: "iPhone 17", con el precio de la versión más chica)
  const base = claveApple(q, true).replace(/ \d+GB$/, '');
  if (base) {
    const b = productos.find(x => !/\d+\s*(GB|TB)/i.test(x.nombre) && claveApple(x.nombre, true) === base);
    if (b) { b.exacto = true; b.por_modelo = true; b.nota = ['Precio desde (la versión de menor capacidad)', b.nota].filter(Boolean).join('. '); }
  }
  return productos;
}

// Cuotas sin interés (la mayor cantidad): "12 cuotas sin interés de $ 55.000"
function cuotasSinInteres(co) {
  const sin = [];
  ((co && co.Installments) || []).forEach(i => { if (i.InterestRate === 0 && i.NumberOfInstallments > 1) sin.push(i); });
  const m = sin.sort((a, b) => b.NumberOfInstallments - a.NumberOfInstallments)[0];
  return m ? m.NumberOfInstallments + ' cuotas sin interés de $ ' + Math.round(m.Value).toLocaleString('es-AR') : '';
}

async function buscar(host, params) {
  const url = host + '/api/catalog_system/pub/products/search?' + params;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok && r.status !== 206) throw new Error('La tienda respondió ' + r.status);
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } finally {
    clearTimeout(t);
  }
}

const first = v => (Array.isArray(v) ? v[0] : v);

// Interpreta las promociones de VTEX (y las etiquetas de promo de GPS Farma) y calcula el precio por unidad con la promo.
function leerPromos(precio, teasers) {
  let mejor = null;
  const notas = [];
  for (const t of teasers || []) {
    const name = String(t.Name || '');
    const params = [...((t.Conditions && t.Conditions.Parameters) || []), ...((t.Effects && t.Effects.Parameters) || [])];
    const esTarjeta = /tarjeta|banco|bins|cr[eé]dito|d[eé]bito|prepaga/i.test(name) || params.some(p => /RestrictionsBins|PaymentMethod/i.test(p.Name));
    if (esTarjeta) {
      const pct = params.find(p => p.Name === 'PercentualDiscount');
      notas.push(pct ? `${pct.Value}% con ${name.replace(/\s*\d+\s*%.*/, '').trim() || 'tarjeta'}` : name);
      continue;
    }
    let cand = null;
    let m;
    if ((m = /(\d+)\s*x\s*(\d+)/i.exec(name)) && +m[1] > +m[2]) {
      const a = +m[1], b = +m[2];
      cand = { precio: precio * b / a, texto: `${a}x${b} · Llevando ${a}` };
    } else if ((m = /(\d)\s*(?:do|da|°|º)?\s*al\s*(\d+)\s*%/i.exec(name))) {
      const n = +m[1] || 2, x = +m[2];
      cand = { precio: ((n - 1) * precio + precio * (1 - x / 100)) / n, texto: `${n}° al ${x}% · Llevando ${n}` };
    } else {
      const pct = params.find(p => p.Name === 'PercentualDiscount');
      const minQ = (t.Conditions && t.Conditions.MinimumQuantity) || 0;
      if (pct && +pct.Value > 0) {
        cand = { precio: precio * (1 - pct.Value / 100), texto: `${pct.Value}% off` + (minQ > 1 ? ` · Llevando ${minQ}` : '') };
      }
    }
    if (cand && (!mejor || cand.precio < mejor.precio)) {
      const max = /max(?:imo)?\s*(\d+)\s*u/i.exec(name);
      cand.condicion = max ? `Máximo ${max[1]} unidades` : '';
      mejor = cand;
    }
  }
  return { mejor, notas };
}


// Rubro legible: "ALMACEN" -> "Almacen", "almacén" -> "Almacén"
function lindo(s) {
  s = String(s || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s === s.toUpperCase() || s === s.toLowerCase()) s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const GENERICO = /^(all|category|categor[ií]as?|todos?|cat[aá]logo|root|home|inicio|productos?|ofertas?|promociones?|integraciones)$/i;

// categories viene como ["/Almacén/Aceites/", "/Almacén/"]: el primer nivel es el rubro
function rubroVtex(p) {
  for (const c of (p.categories || [])) {
    const top = String(c).split('/').map(x => x.trim()).filter(x => x && !GENERICO.test(x))[0];
    if (top) return lindo(top);
  }
  return '';
}

function mapear(products, ean) {
  const out = [];
  for (const p of products || []) {
    const items = p.items || [];
    const item = (ean && items.find(i => i.ean === ean)) || items[0];
    if (!item) continue;
    const seller = (item.sellers || []).find(s => s.sellerDefault) || (item.sellers || [])[0];
    const co = seller && seller.commertialOffer;
    if (!co || !co.Price || co.Price <= 0) continue;
    // Sin stock online: el catálogo conserva el último precio, que puede tener años.
    // Se devuelve marcado como sin_stock para que la web no lo tome como precio actual.
    const sinStock = co.IsAvailable === false || !(co.AvailableQuantity > 0);
    const precio = co.Price;
    const { mejor, notas } = leerPromos(precio, co.PromotionTeasers);
    // Precio por kilo/litro: viene armado (Carrefour, Día) o se calcula con el gramaje (ChangoMás)
    const legend = String(first(p['Gramaje leyenda de conversión']) || first(p.UnidaddeMedida) || '');
    const medida = /k|gr/i.test(legend) ? 'Kilo' : /l|ml|cc/i.test(legend) ? 'Litro' : '';
    let ppu = parseFloat(String(first(p.pricePerUnit) || first(p.PrecioPorUnd) || '').replace(/[^\d.]/g, ''));
    if (!(ppu > 0)) {
      const cons = parseFloat(first(p['Gramaje de unidad de consumo'])), fac = parseFloat(first(p['Gramaje factor de conversión']));
      if (cons > 0 && fac > 0) ppu = Math.round(precio / (cons * fac) * 100) / 100;
    }
    out.push({
      nombre: p.productName || item.nameComplete || '',
      marca: p.brand || '',
      ean: item.ean || '',
      precio,
      precio_lista: co.ListPrice && co.ListPrice > precio && co.ListPrice < precio * 4 ? co.ListPrice : null,   // x10 = error de carga
      precio_promo: mejor && !sinStock ? Math.round(mejor.precio * 100) / 100 : null,
      promo: mejor ? mejor.texto : '',
      promo_condicion: mejor ? mejor.condicion : '',
      nota: [cuotasSinInteres(co)].concat(notas).filter(Boolean).join('. '),
      por_peso: item.measurementUnit === 'kg',
      precio_por_medida: isFinite(ppu) && ppu > 0 && medida ? ppu : null,
      medida,
      imagen: (item.images && item.images[0] && item.images[0].imageUrl) || '',
      exacto: !!(ean && item.ean === ean),
      sin_stock: sinStock,
      rubro: rubroVtex(p),
      link: p.link || '',
      sku: String(item.itemId || ''),
      seller: String((seller && seller.sellerId) || '1'),
    });
  }
  return out;
}

async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'Método no permitido' }));
  }
  const query = req.query || {};
  const tienda = TIENDAS[String(query.tienda || '').toLowerCase()];
  if (!tienda) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'Tienda desconocida', tiendas: Object.keys(TIENDAS) }));
  }
  let q = String(query.q || '').trim().slice(0, 80);
  // Algunas tiendas (Cetrogar) usan el modelo como "código": si no es un código de barras, se busca por el modelo
  const codigo = String(query.ean || '').trim().slice(0, 30);
  const ean = /^\d{8,14}$/.test(codigo) ? codigo : '';
  if (!ean && codigo && modelos(codigo).size && !q.toUpperCase().includes(codigo.toUpperCase())) q = (q + ' ' + codigo).trim().slice(0, 100);
  const buscaModelo = !ean && codigo ? codigo : '';
  const limite = Math.min(Math.max(parseInt(query.limite, 10) || 48, 1), 50);
  if (!q && !ean) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'Falta qué buscar' }));
  }
  try {
    let productos = [];
    let buscadoPor = '';
    if (tienda.magento) {
      productos = await magento.buscar(tienda.host, { q, limite });
      buscadoPor = 'nombre';
    } else if (tienda.prestashop) {
      productos = await otras.prestashop(tienda.host, { ean, q, limite });
      buscadoPor = productos.some(p => p.exacto) ? 'codigo' : 'nombre';
    } else if (tienda.odoo) {
      productos = await otras.odoo(tienda.host, { q, limite });
      buscadoPor = 'nombre';
    }
    else if (ean && !tienda.prestashop && !tienda.odoo) {
      productos = mapear(await buscar(tienda.host, 'fq=alternateIds_Ean:' + encodeURIComponent(ean)), ean);
      buscadoPor = 'codigo';
    }
    if (!tienda.magento && !tienda.prestashop && !tienda.odoo && !productos.length && q) {
      productos = mapear(await buscar(tienda.host, `ft=${encodeURIComponent(q)}&_from=0&_to=${limite - 1}`), ean);
      buscadoPor = 'nombre';
    }
    if ((ean || buscaModelo) && q) marcarPorModelo(productos, q);
    if (buscadoPor === 'nombre' && productos.some(p => p.por_modelo)) buscadoPor = 'modelo';
    productos.sort((a, b) => (Number(b.exacto) - Number(a.exacto)) || (Number(a.sin_stock) - Number(b.sin_stock)));
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, super: tienda.nombre, buscado_por: buscadoPor, total: productos.length, productos }));
  } catch (err) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: 'No se pudo consultar a ' + tienda.nombre }));
  }
}

module.exports = handler;
module.exports._test = { leerPromos, mapear, TIENDAS, rubroVtex, lindo, modelos, marcarPorModelo, cuotasSinInteres };
