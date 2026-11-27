import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function readGlb(path) {
  const bytes = readFileSync(new URL(path, import.meta.url));
  const length = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.toString('utf8', 20, 20 + length));
  const binary = bytes.subarray(28 + length);
  function payload(index) {
    const accessor = doc.accessors[index];
    const view = doc.bufferViews[accessor.bufferView];
    return binary.subarray(view.byteOffset, view.byteOffset + view.byteLength);
  }
  return {doc, payload};
}

test('the reconstructed player uses the original joint names, bind matrices and body/racket animation samples', () => {
  const source = readGlb('../court-studio/athlete.glb');
  const player = readGlb('../doubles/assets/player.glb');
  const bones = ({doc}) => doc.skins[0].joints.map(j => doc.nodes[j].name);
  assert.deepEqual(bones(player), bones(source));
  assert.deepEqual(player.payload(player.doc.skins[0].inverseBindMatrices), source.payload(source.doc.skins[0].inverseBindMatrices));
  assert.equal(player.doc.animations.length, 67);
  for (const [i, clip] of player.doc.animations.entries()) {
    const old = source.doc.animations[i];
    assert.equal(clip.name, old.name);
    assert.deepEqual(clip.channels, old.channels);
    for (const [j, sampler] of clip.samplers.entries()) {
      for (const key of ['input', 'output']) {
        assert.ok(player.payload(sampler[key]).equals(source.payload(old.samplers[j][key])), clip.name);
      }
    }
  }
  const skin = player.doc.nodes.find(node => node.name === 'Tripo Court Athlete');
  assert.equal(skin.skin, 0);
  const primitives = player.doc.meshes[skin.mesh].primitives;
  assert.ok(primitives.some(p => player.doc.materials[p.material].name === 'Match jersey front'));
  for (const primitive of primitives) {
    const attrs = primitive.attributes;
    const count = player.doc.accessors[attrs.POSITION].count;
    for (const key of ['JOINTS_0','WEIGHTS_0']) assert.equal(player.doc.accessors[attrs[key]].count, count);
  }
});
