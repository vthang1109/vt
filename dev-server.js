// Tiny static file server for local testing of the VTWorld app (dev only)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PORT = 8123;
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.ogg':'audio/ogg',
  '.mp3':'audio/mpeg', '.mpeg':'audio/mpeg', '.ico':'image/x-icon', '.woff':'font/woff',
  '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8', '.webmanifest':'application/manifest+json'
};

http.createServer((req,res)=>{
  try{
    let url = decodeURIComponent(req.url.split('?')[0]);
    if(url==='/') url='/index.html';
    let fp = path.join(ROOT, url);
    if(!fp.startsWith(ROOT)){ res.writeHead(403); res.end('forbidden'); return; }
    fs.stat(fp,(err,st)=>{
      if(err||st.isDirectory()){
        res.writeHead(404); res.end('not found: '+url); return;
      }
      const ext = path.extname(fp).toLowerCase();
      res.writeHead(200, {'Content-Type': MIME[ext]||'application/octet-stream', 'Cache-Control':'no-store'});
      fs.createReadStream(fp).pipe(res);
    });
  }catch(e){
    res.writeHead(500); res.end('err');
  }
}).listen(PORT, ()=>console.log('serving',ROOT,'on',PORT));
