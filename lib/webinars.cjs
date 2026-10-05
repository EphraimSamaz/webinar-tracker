const { createHash, timingSafeEqual } = require('node:crypto');
const { Pool } = require('pg');

let pool;
function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 10000 });
  return pool;
}

const fields = `id, name, host,
  to_char(date_time AT TIME ZONE 'Africa/Johannesburg', 'YYYY-MM-DD"T"HH24:MI') AS date_time,
  duration, registrants, attendees`;

function validRow(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 160) return false;
  if (typeof body.host !== 'string' || !body.host.trim() || body.host.length > 100) return false;
  if (typeof body.date_time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(body.date_time)) return false;
  if (Number.isNaN(Date.parse(`${body.date_time}+02:00`))) return false;
  if (!Number.isInteger(body.duration) || body.duration < 1 || body.duration > 1440) return false;
  if (!Number.isInteger(body.registrants) || body.registrants < 0 || body.registrants > 1000000) return false;
  if (!Number.isInteger(body.attendees) || body.attendees < 0 || body.attendees > 1000000) return false;
  return true;
}

function allowedKey(value) {
  const expected = process.env.WEBINAR_ACCESS_KEY;
  if (!expected || expected.length < 24 || typeof value !== 'string' || !value.startsWith('Bearer ')) return false;
  const supplied = value.slice(7);
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined) return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16384) throw new Error('Request too large');
  }
  return JSON.parse(raw || '{}');
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  if (origin) {
    const requestOrigin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
    if (origin !== allowedOrigin && origin !== requestOrigin) return send(res, 403, { error: 'Origin is not allowed' });
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (!allowedKey(req.headers.authorization)) return send(res, 401, { error: 'Access key is missing or incorrect' });
  if (!process.env.DATABASE_URL) return send(res, 503, { error: 'Database is not configured' });

  try {
    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id');
    if (req.method === 'GET') {
      const result = await database().query(`SELECT ${fields} FROM public.webinars ORDER BY date_time DESC`);
      return send(res, 200, result.rows);
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      if (req.method === 'PUT' && !/^[-\da-f]{36}$/i.test(id || '')) return send(res, 400, { error: 'Invalid webinar ID' });
      const body = await readBody(req);
      if (!validRow(body)) return send(res, 400, { error: 'Enter valid webinar details and audience totals' });
      const values = [body.name.trim(), body.host.trim(), body.date_time, body.duration, body.registrants, body.attendees];
      const result = req.method === 'POST'
        ? await database().query(`INSERT INTO public.webinars (name, host, date_time, duration, registrants, attendees)
            VALUES ($1, $2, $3::timestamp AT TIME ZONE 'Africa/Johannesburg', $4, $5, $6) RETURNING ${fields}`, values)
        : await database().query(`UPDATE public.webinars SET name=$1, host=$2,
            date_time=$3::timestamp AT TIME ZONE 'Africa/Johannesburg', duration=$4, registrants=$5, attendees=$6
            WHERE id=$7 RETURNING ${fields}`, [...values, id]);
      return result.rows.length ? send(res, req.method === 'POST' ? 201 : 200, result.rows[0]) : send(res, 404, { error: 'Webinar not found' });
    }
    if (req.method === 'DELETE') {
      if (!/^[-\da-f]{36}$/i.test(id || '')) return send(res, 400, { error: 'Invalid webinar ID' });
      const result = await database().query('DELETE FROM public.webinars WHERE id=$1 RETURNING id', [id]);
      return result.rows.length ? send(res, 200, { id }) : send(res, 404, { error: 'Webinar not found' });
    }
    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Webinar API error:', error);
    return send(res, 500, { error: 'Database request failed' });
  }
};
