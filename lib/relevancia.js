// Filtra resultados que no tienen que ver con lo buscado.
// Algunos buscadores (iPoint, MacStation, Kinderland) devuelven cualquier cosa cuando no encuentran nada,
// y otros mezclan productos parecidos (buscando "horno eléctrico" traen hornos a gas).
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'en', 'un', 'una', 'por', 'sin', 'y', 'o']);
// Palabras que la tienda no pone en el nombre pero significan lo mismo
const SINONIMOS = {
  celular: ['iphone', 'smartphone', 'galaxy', 'moto', 'telefono'], celulares: ['iphone', 'smartphone', 'galaxy', 'moto'],
  notebook: ['macbook', 'laptop'], notebooks: ['macbook', 'laptop'], tablet: ['ipad'], tablets: ['ipad'],
  auricular: ['airpods', 'headphones', 'buds'], auriculares: ['airpods', 'headphones', 'buds'],
  reloj: ['watch'], smartwatch: ['watch'], computadora: ['imac', 'mac', 'pc'], tele: ['tv', 'smart'], televisor: ['tv', 'smart'],
  bici: ['bicicleta'], bicicleta: ['bici'], zapatilla: ['zapatillas'], botines: ['botin'],
};
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Raíz: "eléctrico" también encuentra "eléctrica", "horno" encuentra "hornito"
const raiz = t => /\d/.test(t) ? t : t.slice(0, Math.max(4, t.length - 2));

function relevantes(productos, q) {
  const toks = norm(q).split(/[^a-z0-9]+/).filter(t => t.length >= 3 && !VACIAS.has(t));
  if (!toks.length || !productos.length) return productos;
  const coincide = (t, palabras) => [t].concat(SINONIMOS[t] || []).some(x => {
    const r = raiz(x);
    return palabras.some(w => w.startsWith(r) || (w.length >= 4 && !/\d/.test(t) && t.startsWith(w)));
  });
  const puntaje = p => {
    const palabras = norm([p.nombre, p.marca, p.rubro, p.modelo].join(' ')).split(/[^a-z0-9]+/).filter(Boolean);
    return toks.filter(t => coincide(t, palabras)).length;
  };
  const con = productos.map(p => [p, puntaje(p)]);
  const todas = con.filter(([, n]) => n === toks.length).map(([p]) => p);
  if (todas.length) return todas;                       // los que tienen todas las palabras
  return con.filter(([, n]) => n > 0).map(([p]) => p);  // si ninguno las tiene todas, los que tienen alguna
}

// Códigos internos de la tienda que no son el modelo del fabricante (Frávega: "fravegasellerprod511:FLO00005")
const modeloLimpio = r => /sellerprod/i.test(String(r || '')) ? '' : String(r || '');

module.exports = { relevantes, modeloLimpio, norm };
