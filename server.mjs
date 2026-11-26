import http from 'node:http';
import { readFile, watch } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {createReviewService} from './motion-lab/review/service.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const clients = new Set();
const review=createReviewService();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg':'image/jpeg', '.glb':'model/gltf-binary' };
const doublesFiles=new Set(['doubles/match.js','doubles/simulation.js','doubles/court.js','doubles/court.css','doubles/assets/racket.glb','doubles/assets/shuttle.glb','court-studio/athlete.glb',
  ...['loaders/GLTFLoader','utils/BufferGeometryUtils','utils/SkeletonUtils'].map(s=>'node_modules/three/examples/jsm/'+s+'.js')]);
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if(url.pathname.startsWith('/motion-lab/review/api/'))return review(req,res,url);
  if(url.pathname==='/motion-lab/review'){res.writeHead(308,{Location:'/motion-lab/review/'});res.end();return;}
  if(url.pathname==='/motion-lab/review/')url.pathname+='index.html';
  if (url.pathname === '/__live') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 1500\ndata: connected\n\n'); clients.add(res);
    req.on('close', () => clients.delete(res)); return;
  }
  try {
    if (url.pathname === '/motion-lab') { res.writeHead(308, { Location: '/motion-lab/' }); res.end(); return; }
    const name = url.pathname === '/' ? 'index.html' : url.pathname === '/motion-lab/' ? 'motion-lab/index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(root, name);
    // 개발 서버에서는 게임에 필요한 정적 파일만 제공합니다.
    const catalogFile = /^motion-lab\/catalog\/(?:manifest|patterns|(?:pose|motion)-\d+-index|[A-Z]{3}-[A-Z]{3}-R[1-8]-(?:index|patterns|similar|\d+))\.json$/.test(name)
      || doublesFiles.has(name) || ['motion-lab/review/index.html','motion-lab/review/editor.js','motion-lab/review/editor.css','motion-lab/review/shared.js'].includes(name);
    if (name === 'motion-lab/catalog/motion-library.jsonl.gz') {
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': 'application/gzip', 'Content-Disposition': 'attachment; filename="motion-library.jsonl.gz"', 'Content-Length': data.length }); res.end(data); return;
    }
    if ((!catalogFile && !['index.html', 'style.css', 'game.js', 'physics.js', 'motion.js', 'footwork-clips.js', 'renderer3d.js', 'vendor/three.module.js', 'vendor/three.core.js', 'data/player-motion-bank.js', 'data/footwork-reference.json', 'data/pose-contact-sheet.jpg', 'motion-lab/index.html', 'motion-lab/lab.css', 'motion-lab/lab.js', 'motion-lab/catalog-ui.js', 'motion-lab/clips.js', 'motion-lab/rig.js', 'motion-lab/athlete.js', 'motion-lab/stage.js', 'motion-lab/learned-model.js', 'motion-lab/learned-samples.js', 'motion-lab/learned-rig.js'].includes(name)) || !file.startsWith(root)) throw new Error('not allowed');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const port=Number(process.env.MOTION_LAB_PORT)||5173;
server.listen(port, '0.0.0.0', () => console.log('SHUTTLE LAB live: http://localhost:'+port));
let timer;
(async () => {
  for await (const event of watch(root)) {
    if (!/\.(html|css|js)$/.test(event.filename || '')) continue;
    clearTimeout(timer); timer = setTimeout(() => {
      for (const res of clients) res.write('data: reload\n\n');
    }, 200);
  }
})();
setInterval(() => { for (const res of clients) res.write(': heartbeat\n\n'); }, 15000).unref();
