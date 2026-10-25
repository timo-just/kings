import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('./',import.meta.url);
http.createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.includes('..'))throw Error();const file=new URL('.'+(path==='/'?'/index.html':path),root);if(!file.href.startsWith(root.href))throw Error();const body=await readFile(fileURLToPath(file));res.setHeader('Content-Type',file.pathname.endsWith('.mjs')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.png')?'image/png':'text/html; charset=utf-8');res.end(body);}catch{res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'));
