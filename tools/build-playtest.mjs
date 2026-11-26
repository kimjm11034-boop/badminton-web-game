import {copyFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.cache/playtest-public');
async function publish(source, destination = source) {
  const name = resolve(output, destination);
  await mkdir(dirname(name), {recursive: true});
  await copyFile(resolve(root, source), name);
}
for (const name of ['index.html', 'physics.js', 'doubles/match.js', 'doubles/simulation.js', 'doubles/court.css',
  'vendor/three.module.js', 'vendor/three.core.js', 'doubles/assets/racket.glb', 'doubles/assets/shuttle.glb', 'court-studio/athlete.glb']) {
  await publish(name);
}
for (const module of ['loaders/GLTFLoader.js', 'utils/SkeletonUtils.js', 'utils/BufferGeometryUtils.js']) {
  await publish('vendor/jsm/' + module);
}
await publish('doubles/court.js');
await publish('court-studio/build/ATTRIBUTION.txt', 'licenses/athlete.txt');
await publish('vendor/THREE-LICENSE', 'licenses/three.txt');
console.log(output);
