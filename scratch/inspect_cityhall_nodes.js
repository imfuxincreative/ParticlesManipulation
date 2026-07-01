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

console.log('--- CITYHALL NODE SEARCH ---');
let simonNodes = [];
gltf.nodes.forEach((node, idx) => {
  const name = node.name || '';
  if (name.toLowerCase().includes('simon') || name.toLowerCase().includes('body') || name.toLowerCase().includes('mixamo') || name.toLowerCase().includes('armature')) {
    simonNodes.push({ index: idx, name: name, mesh: node.mesh, skin: node.skin });
  }
});

console.log(`Found ${simonNodes.length} nodes matching character patterns:`);
simonNodes.forEach(n => {
  console.log(`Node ${n.index}: name="${n.name}" meshIndex=${n.mesh} skinIndex=${n.skin}`);
});

console.log('--- ALL ANIMATIONS IN GLTF ---');
if (gltf.animations) {
  gltf.animations.forEach((anim, idx) => {
    console.log(`Animation ${idx}: name="${anim.name}" channelsCount=${anim.channels ? anim.channels.length : 0}`);
    if (anim.channels) {
      anim.channels.slice(0, 5).forEach((channel, cIdx) => {
        const targetNode = gltf.nodes[channel.target.node];
        console.log(`  Channel ${cIdx}: targetNodeName="${targetNode ? targetNode.name : 'unknown'}" path="${channel.target.path}"`);
      });
    }
  });
} else {
  console.log('No animations property in GLTF.');
}
