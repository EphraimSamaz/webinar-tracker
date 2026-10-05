const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const handler = require('./lib/webinars.cjs');

const root = __dirname;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.otf': 'font/otf', '.ttf': 'font/ttf' };
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/webinars') return handler(req, res);
  const file = path.resolve(root, `.${decodeURIComponent(pathname === '/' ? '/index.html' : pathname)}`);
  if (!file.startsWith(`${root}${path.sep}`) || /(^|\/)\./.test(path.relative(root, file)) || !mime[path.extname(file)]) {
    res.writeHead(404).end();
    return;
  }
  fs.createReadStream(file).on('error', () => res.writeHead(404).end()).pipe(res);
  res.setHeader('Content-Type', mime[path.extname(file)]);
}).listen(Number(process.env.PORT) || 3000, '127.0.0.1', () => console.log(`Webinar tracker: http://localhost:${process.env.PORT || 3000}`));
