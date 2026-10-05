import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../api/romtech.js';
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.xml':'application/xml' };
export function serve(handler = app, port = Number(process.env.PORT) || 4173) {
  const server = http.createServer(async (req,res) => {
    try {
      const url = new URL(req.url,'http://local');
      if(url.pathname==='/api/romtech') {
        if(req.method==='POST') {
          let bytes=0,parts=[];
          for await(const chunk of req){bytes+=chunk.length;if(bytes>3000000){res.writeHead(413);res.end();return}parts.push(chunk)}
          try{req.body=JSON.parse(Buffer.concat(parts).toString('utf8')||'{}')}catch{res.writeHead(400);res.end();return}
        }
        await handler(req,res);return;
      }
      let file=resolve(root,'.'+decodeURIComponent(url.pathname));
      if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
      if((await stat(file)).isDirectory())file=resolve(file,'index.html');
      res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');
      res.end(await readFile(file));
    }catch{res.writeHead(404);res.end('Not found')}
  });
  return server.listen(port,'127.0.0.1',()=>console.log(`RomTech running at http://127.0.0.1:${server.address().port}`));
}
if(process.argv[1]===fileURLToPath(import.meta.url))serve();
