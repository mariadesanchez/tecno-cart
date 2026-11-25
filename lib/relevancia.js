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
  horno: ['hornito'], hornito: ['horno'], hornitos: ['horno'], heladera: ['refrigerador'], heladeras: ['refrigerador'], lavarropa: ['lavarropas'],
  electrico: ['electrica'], electrica: ['electrico'],
};
const EXCLUYE = { celular: ['book', 'notebook', 'tab', 'tablet', 'watch', 'buds', 'ventilador'], celulares: ['book', 'notebook', 'tab', 'tablet', 'watch', 'buds'], horno: ['microondas'], hornito: ['microondas'], heladera: ['exhibidora', 'portatil'], lavarropas: ['secarropas'] };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Raíz: "eléctrico" también encuentra "eléctrica", "horno" encuentra "hornito"
// "Galaxy A 16" / "S 24" / "Moto G 85": la letra suelta va pegada al número, como lo escriben las tiendas (A16, S24, G85)
const juntar = q => String(q || '').replace(/(^|[\s(])([A-Za-z])\s+(\d{1,4})(?=$|[\s),.])/g, '$1$2$3');
const raiz = t => /\d/.test(t) ? t : t.slice(0, Math.max(4, t.length - 2));

function relevantes(productos, q) {
  q = juntar(q);
  // Un número suelto también encuentra el modelo que lo lleva con una letra adelante: "galaxy 16" -> "Galaxy A16"
  const tieneNum = (palabras, t) => palabras.includes(t) || (/^\d+$/.test(t) && palabras.some(w => /^[a-z]{1,3}\d+$/.test(w) && w.replace(/^[a-z]+/, '') === t));
  const toks = norm(q).split(/[^a-z0-9]+/).filter(t => (t.length >= 3 || /^\d{2,}$/.test(t)) && !VACIAS.has(t));
  if (!toks.length || !productos.length) return productos;
  const coincide = (t, palabras) => /^\d+$/.test(t) ? tieneNum(palabras, t) : [t].concat(SINONIMOS[t] || []).some(x => {
    const r = raiz(x);
    return palabras.some(w => w.startsWith(r) || (w.length >= 4 && !/\d/.test(t) && t.startsWith(w)));
  });
  const puntaje = p => {
    const palabras = norm(juntar([p.nombre, p.marca, p.rubro, p.modelo, p.categorias].join(' '))).split(/[^a-z0-9]+/).filter(Boolean);
    return toks.filter(t => coincide(t, palabras)).length;
  };
  // Números y modelos ("16", "a16", "s24") tienen que estar sí o sí: "Galaxy A16" no trae la Galaxy Book de 16"
  const nums = toks.filter(t => /^\d+$/.test(t) || (/\d/.test(t) && /[a-z]/.test(t)));
  const palabrasDe = p => norm(juntar([p.nombre, p.marca, p.rubro, p.modelo].join(' '))).split(/[^a-z0-9]+/);
  // Productos parecidos que no son lo buscado: "horno" no es "horno microondas" (salvo que se pida)
  const qn = norm(q), excl = Object.entries(EXCLUYE).filter(([w]) => new RegExp('\\b' + w).test(qn)).flatMap(([, xs]) => xs).filter(x => !qn.includes(x));
  productos = productos.filter(p => !excl.some(x => new RegExp('\\b' + x).test(norm(p.nombre))));
  const con = productos.map(p => [p, puntaje(p)]).filter(([p]) => nums.every(t => tieneNum(palabrasDe(p), t)));   // "iPhone 15" no trae el 16e
  const todas = con.filter(([, n]) => n === toks.length).map(([p]) => p);
  // los que tienen todas las palabras; si ninguno las tiene todas, los que tienen alguna
  return alFinalAccesorios(todas.length ? todas : con.filter(([, n]) => n > 0).map(([p]) => p), q);
}

// Accesorios ("Funda para iPhone 16", "Bolsa para lavarropas") van al final, salvo que se busque un accesorio
const ACCESORIO = /^(funda|bolsa|mouse|cable|cargador|soporte|protector|vidrio|film|estuche|adaptador|repuesto|filtro|manguera|control|tapa|kit|malla|correa|lamina|templado|cobertor|cubre|organizador)\b/;
function alFinalAccesorios(ps, q) {
  if (ACCESORIO.test(norm(q).trim()) || new RegExp('\\b' + ACCESORIO.source.slice(2, -3) + '\\b').test(norm(q))) return ps;
  const acc = p => ACCESORIO.test(norm(p.nombre).trim());
  return ps.filter(p => !acc(p)).concat(ps.filter(acc));
}

// Códigos internos de la tienda que no son el modelo del fabricante (Frávega: "fravegasellerprod511:FLO00005")
const modeloLimpio = r => /sellerprod/i.test(String(r || '')) ? '' : String(r || '');


// ---------- Medidas: "horno eléctrico 20 L" trae solo los de 20 litros ----------
// Unidad escrita como sea -> una sola forma
const UNIDADES = [
  [/^(l|lt|lts|ltr|ltrs|litro|litros)$/, 'L'], [/^(gb)$/, 'GB'], [/^(tb)$/, 'TB'], [/^(w|watt|watts)$/, 'W'],
  [/^(kg|kgs|kilo|kilos)$/, 'KG'], [/^("|''|pulg|pulgada|pulgadas|in)$/, 'PULG'], [/^(cm)$/, 'CM'], [/^(mm)$/, 'MM'],
  [/^(piezas|pzs|pzas|pcs)$/, 'PIEZAS'], [/^(mah)$/, 'MAH'], [/^(hz)$/, 'HZ'], [/^(btu)$/, 'BTU'], [/^(frigorias|fg)$/, 'FRIGORIAS'],
  [/^(rodado|r)$/, 'RODADO'],
];
const RE_MED = /(?:\b(rodado)\s*(\d{2})\b)|(\d+(?:[.,]\d+)?)\s*("|''|\u201d|[a-z]+)/g;
function unidad(u) { u = norm(u).replace('\u201d', '"'); for (const [re, k] of UNIDADES) if (re.test(u)) return k; return ''; }
function medidas(texto) {
  const t = norm(texto).replace(/\u201d/g, '"'), out = new Set();
  for (const m of t.matchAll(RE_MED)) {
    if (m[1]) { out.add('RODADO' + Number(m[2])); continue; }
    if (/^r$/.test(m[4] || '') ) continue;
    const u = unidad(m[4]); if (!u) continue;
    out.add(u + Number(m[3].replace(',', '.')));
  }
  for (const m of t.matchAll(/\br\s?(\d{2})\b/g)) out.add('RODADO' + Number(m[1]));   // bicicletas "R29"
  return [...out];
}
// Texto de un producto VTEX para buscar medidas: nombre, descripción y ficha técnica
// (en la ficha la unidad suele estar en el nombre del campo: "Capacidad (litros)": ["20"])
function textoMedidas(p) {
  const ficha = (p.allSpecifications || []).map(k => {
    const v = [].concat(p[k] || []).join(' ');
    const u = /litro|\blts?\b|\(l\)/i.test(k) ? ' L' : /pulgada/i.test(k) ? ' pulgadas' : /\(kg\)|kilo/i.test(k) ? ' kg' : /\(gb\)/i.test(k) ? ' GB' : '';
    return u && /^\s*\d+(?:[.,]\d+)?\s*$/.test(v) ? v + u : k + ' ' + v;
  });
  return [p.productName, String(p.description || '').replace(/<[^>]+>/g, ' ').slice(0, 2000)].concat(ficha).join(' . ');
}
// La búsqueda sin las medidas (para que la tienda devuelva todos los tamaños y después se filtra)
function sinMedidas(q) {
  return norm(q).replace(/\u201d/g, '"').replace(RE_MED, (all, r, rn, n, u) => (r || unidad(u)) ? ' ' : all).replace(/\s+/g, ' ').trim();
}
function conMedidas(productos, pedidas) {
  if (!pedidas.length) return productos;
  const unidadDe = m => m.replace(/[\d.]+$/, '');
  return productos.filter(p => {
    const delNombre = medidas(p.nombre), otras = p.medidas || [];
    // Si el nombre trae esa unidad, manda el nombre (la descripción suele nombrar otros tamaños)
    return pedidas.every(m => delNombre.some(x => unidadDe(x) === unidadDe(m)) ? delNombre.includes(m) : otras.includes(m));
  });
}

// Para buscar más amplio en las tiendas cuando no te acordás el modelo entero:
// sin el número suelto ("celular galaxy 16" -> "celular galaxy") y sin la palabra genérica ("galaxy 16")
const sinNumeros = q => String(q || '').replace(/(^|\s)\d{1,3}(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
const sinGenericos = q => String(q || '').split(/\s+/).filter(w => !SINONIMOS[norm(w)]).join(' ').trim();
module.exports = { sinNumeros, sinGenericos, juntar, relevantes, modeloLimpio, norm, medidas, sinMedidas, conMedidas, textoMedidas };
