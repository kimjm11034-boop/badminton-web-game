import {copyFile, mkdir, readFile, rm} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.cache/playtest-public');
async function publish(source, destination = source) {
  const name = resolve(output, destination);
  await mkdir(dirname(name), {recursive: true});
  await copyFile(resolve(root, source), name);
}
// Photos listed in credits.json are the only ones published; clear withdrawn ones from earlier builds.
await rm(resolve(output, 'lobby/photos'), {recursive: true, force: true});
const gallery=JSON.parse(await readFile(resolve(root,'lobby/photos/credits.json'),'utf8'));
for (const name of ['index.html', 'play/index.html','lobby/home.js','lobby/home.css','lobby/progress.js','lobby/spotlight.js','lobby/catalog.js','lobby/photos/credits.json',...[gallery.backdrop,...gallery.players].map(p=>'lobby/photos/'+p.file),'doubles/ranks.js','vendor/lucide/lobby.svg','physics.js', 'doubles/arena.js', 'doubles/impact-audio.js', 'vendor/lucide/court.svg',
  ...['touch','drive','power'].map(n=>'doubles/assets/audio/'+n+'.wav'), 'doubles/match.js', 'doubles/simulation.js', 'doubles/court.css',
  'vendor/three.module.js', 'vendor/three.core.js', 'doubles/assets/racket.glb', 'doubles/assets/shuttle.glb', 'doubles/assets/player.glb']) {
  await publish(name);
}
for (const module of ['loaders/GLTFLoader.js', 'utils/SkeletonUtils.js', 'utils/BufferGeometryUtils.js']) {
  await publish('vendor/jsm/' + module);
}
await publish('doubles/court.js');
await publish('court-studio/build/ATTRIBUTION.txt', 'licenses/athlete.txt');
await publish('vendor/THREE-LICENSE', 'licenses/three.txt');
await publish('vendor/lucide/LICENSE','licenses/lucide.txt');
await publish('doubles/assets/audio/SOURCE.txt','licenses/impact-audio.txt');
console.log(output);
