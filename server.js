const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  'html': 'text/html; charset=utf-8',
  'css': 'text/css',
  'js': 'application/javascript',
  'json': 'application/json',
  'svg': 'image/svg+xml',
  'woff2': 'font/woff2',
  'webmanifest': 'application/manifest+json',
  'txt': 'text/plain',
};

http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/' || url === '') url = '/index.html';

  const filePath = path.join(ROOT, url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + url);
      return;
    }
    const ext = filePath.split('.').pop().toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });

}).listen(PORT, '127.0.0.1', () => {
  console.log('✅ بوابة الفرص ٢ — الخادم المحلي يعمل');
  console.log('🌐 افتح المتصفح على: http://localhost:' + PORT);
});
