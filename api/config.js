// Datos públicos para que la app se conecte a Supabase (la clave pública es segura: la seguridad la dan las reglas RLS).
// Se cargan desde las variables de entorno de Vercel (SUPABASE_URL y SUPABASE_ANON_KEY); si faltan, se usan los datos públicos del proyecto.
// Protección: nunca se entrega una clave secreta, aunque por error esté cargada en alguna de las dos variables.

function esUrlSupabase(v) {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(v || '');
}

function esClavePublica(v) {
  v = String(v || '');
  if (/^sb_publishable_/.test(v)) return true;
  if (/^eyJ/.test(v)) {   // clave vieja (JWT): solo si es la "anon", nunca la "service_role"
    try { return JSON.parse(Buffer.from(v.split('.')[1], 'base64').toString()).role === 'anon'; } catch (_) { return false; }
  }
  return false;
}

const URL_PUBLICA = 'https://kjfuhbsnysrpawhegikj.supabase.co';
const CLAVE_PUBLICA = 'sb_publishable_Uxs5cP658Sp2h9PQjwaVjw_0POOgnHm';

module.exports = (req, res) => {
  let url = (process.env.SUPABASE_URL || '').trim();
  let anon = (process.env.SUPABASE_ANON_KEY || '').trim();
  if (!esUrlSupabase(url) || !esClavePublica(anon)) { url = URL_PUBLICA; anon = CLAVE_PUBLICA; }
  const ok = esUrlSupabase(url) && esClavePublica(anon);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(ok ? { url: url.replace(/\/+$/, ''), anon } : { url: '', anon: '', error: 'config' }));
};
