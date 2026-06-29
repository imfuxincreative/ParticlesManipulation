const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, '..', 'public', 'cityhall.glb');
const buffer = fs.readFileSync(glbPath);

const chunkLength = buffer.readUInt32LE(12);
const jsonString = buffer.toString('utf8', 20, 20 + chunkLength);
const gltf = JSON.parse(jsonString);

console.log('--- MESH NAMES ---');
gltf.meshes.forEach((mesh, idx) => {
  console.log(`Mesh ${idx}: name="${mesh.name || ''}"`);
});

console.log('--- NODES WITH MESHES ---');
gltf.nodes.forEach((node, idx) => {
  if (node.mesh !== undefined) {
    console.log(`Node ${idx}: name="${node.name || ''}" meshIndex=${node.mesh}`);
  }
});
