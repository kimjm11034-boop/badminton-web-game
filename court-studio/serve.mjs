import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const local=new URL('./',import.meta.url),lib=new URL('../node_modules/three/',local);
const files=new Map();
for(const n of ['index.html','studio.css','studio.js','athlete.glb','Astra-Court.blend','catalog.json','reference-frames.json','SOURCES.md','evidence/verification.json','evidence/smash-rotation.webp','evidence/smash-rotation.png','build/ATTRIBUTION.txt'])files.set('/'+n,new URL(n,local));
for(const n of ['build/three.module.js','build/three.core.js','examples/jsm/loaders/GLTFLoader.js','examples/jsm/utils/BufferGeometryUtils.js','examples/jsm/utils/SkeletonUtils.js','examples/jsm/controls/OrbitControls.js'])files.set('/three/'+n,new URL(n,lib));
const types={html:'text/html; charset=utf-8',js:'text/javascript',css:'text/css',json:'application/json',glb:'model/gltf-binary',blend:'application/octet-stream',md:'text/plain; charset=utf-8',txt:'text/plain; charset=utf-8',png:'image/png',webp:'image/webp'};
http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/') {res.writeHead(302,{Location:'/court-studio/'});return res.end();}
 const tail=path.startsWith('/court-studio/')?path.slice('/court-studio/'.length):path;
 const url=files.get(!tail?'/'+'index.html':'/'+tail.replace(/^\//,''));
 if(!url||!['GET','HEAD'].includes(req.method)){res.writeHead(404);return res.end();}
 try{const file=fileURLToPath(url),s=await stat(file);
 res.writeHead(200,{'Content-Type':types[file.split('.').at(-1)],'Content-Length':s.size,'Cache-Control':'no-cache'});
 if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(404);res.end();}
}).listen(Number(process.env.COURT_STUDIO_PORT)||5188,'127.0.0.1',()=>console.log('Astra Court • http://localhost:'+(process.env.COURT_STUDIO_PORT||5188)+'/court-studio/'));
