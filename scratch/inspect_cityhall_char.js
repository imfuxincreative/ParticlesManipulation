const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, '..', 'public', 'cityhall.glb');
if (!fs.existsSync(glbPath)) {
  console.error("File not found:", glbPath);
  process.exit(1);
}

const buffer = fs.readFileSync(glbPath);
const chunkLength = buffer.readUInt32LE(12);
const jsonString = buffer.toString('utf8', 20, 20 + chunkLength);
const gltf = JSON.parse(jsonString);

console.log('--- CITYHALL CHARACTER NODE REPORT ---');
let matches = [];
gltf.nodes.forEach((node, idx) => {
  const name = node.name || '';
  if (name.toLowerCase().includes('simon') || name.toLowerCase().includes('body') || name.toLowerCase().includes('mixamo') || name.toLowerCase().includes('armature')) {
    matches.push({ index: idx, node: node });
  }
});

console.log(`Found ${matches.length} matching character nodes in cityhall.glb.`);
matches.slice(0, 50).forEach(m => {
  console.log(`Node ${m.index}: name="${m.node.name}" meshIndex=${m.node.mesh} skinIndex=${m.node.skin}`);
});

console.log('--- CITYHALL ROOT NODES ---');
if (gltf.scenes && gltf.scenes[0]) {
  gltf.scenes[0].nodes.forEach(nodeIdx => {
    const node = gltf.nodes[nodeIdx];
    console.log(`Root Node ${nodeIdx}: name="${node.name}"`);
  });
}
