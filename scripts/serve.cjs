const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server = http.createServer((req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const filename = path.resolve(root,'.' + (pathname === '/' ? '/index.html' : pathname));
    if (!filename.startsWith(root + path.sep) || pathname.split('/').some(part => part.startsWith('.'))) { res.writeHead(403).end(); return; }
    fs.readFile(filename,(error,data) => {
      if (error) { res.writeHead(404).end('Not found'); return; }
      res.writeHead(200,{'Content-Type':types[path.extname(filename)] || 'application/octet-stream','Cache-Control':'no-store'}); res.end(data);
    });
  } catch (_) { res.writeHead(400).end('Bad request'); }
});
const port = Number(process.env.PORT) || 8766;
server.listen(port,'127.0.0.1',() => console.log(`Local: http://127.0.0.1:${port}`));
