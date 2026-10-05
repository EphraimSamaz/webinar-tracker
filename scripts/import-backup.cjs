const fs = require('node:fs');
const zlib = require('node:zlib');
const { Client } = require('pg');

const file = process.argv[2];
if (!file || !process.env.DATABASE_URL) {
  console.error('Usage: node --env-file=.env scripts/import-backup.cjs path/to/backup.gz');
  process.exit(1);
}

const dump = zlib.gunzipSync(fs.readFileSync(file)).toString('utf8');
const header = 'COPY public.webinars (id, name, date_time, duration, registrants, attendees, created_at, host) FROM stdin;\n';
const section = dump.split(header)[1]?.split('\n\\.\n')[0];
if (!section) throw new Error('Webinars data was not found in the backup');

function decode(value) {
  if (value === '\\N') return null;
  return value.replace(/\\([0-7]{3}|.)/g, (_, code) => {
    if (/^[0-7]{3}$/.test(code)) return String.fromCharCode(parseInt(code, 8));
    return ({ b:'\b', f:'\f', n:'\n', r:'\r', t:'\t', v:'\v' })[code] ?? code;
  });
}

const rows = section.split('\n').map((line) => line.split('\t').map(decode));
if (rows.some((row) => row.length !== 8)) throw new Error('Unexpected webinar backup format');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    let imported = 0;
    for (const row of rows) {
      const result = await client.query(`INSERT INTO public.webinars
        (id, name, date_time, duration, registrants, attendees, created_at, host)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`, row);
      imported += result.rowCount;
    }
    await client.query('COMMIT');
    console.log(`Imported ${imported} of ${rows.length} webinars`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
