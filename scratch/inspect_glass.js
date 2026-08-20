const fs = require('fs');

const buffer = fs.readFileSync('./public/SCENE.glb');
const magic = buffer.readUInt32LE(0);
if (magic !== 0x46546C67) process.exit(1);

const length = buffer.readUInt32LE(8);
const jsonChunkLen = buffer.readUInt32LE(12);
const jsonStr = buffer.toString('utf8', 20, 20 + jsonChunkLen);
const gltf = JSON.parse(jsonStr);

console.log("=== ALL MATERIALS IN GLTF ===");
if (gltf.materials) {
  gltf.materials.forEach((mat, i) => {
    console.log(`Material [${i}]: "${mat.name}"`);
  });
}
