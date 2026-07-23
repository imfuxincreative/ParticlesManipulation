const fs = require('fs');
const path = require('path');
const THREE = require('three');

const glbPath = path.join(__dirname, '..', 'public', 'SCENE.glb');
const buffer = fs.readFileSync(glbPath);
const jsonLength = buffer.readUInt32LE(12);
const jsonBuffer = buffer.subarray(20, 20 + jsonLength);
const gltfJson = JSON.parse(jsonBuffer.toString('utf8'));

console.log('Nodes matching "floor" or "plane":\n');

// Build a parent mapping for nodes
const parentMap = new Map();
gltfJson.nodes.forEach((node, index) => {
  if (node.children) {
    node.children.forEach(childIndex => {
      parentMap.set(childIndex, index);
    });
  }
});

function getParentPath(index) {
  const path = [];
  let current = index;
  while (parentMap.has(current)) {
    const parentIndex = parentMap.get(current);
    const parentNode = gltfJson.nodes[parentIndex];
    path.push(`${parentNode.name || 'unnamed'} [Node ${parentIndex}]`);
    current = parentIndex;
  }
  return path.reverse().join(' -> ');
}

gltfJson.nodes.forEach((node, index) => {
  const name = node.name || '';
  if (name.toLowerCase().includes('floor') || name.toLowerCase().includes('plane')) {
    console.log(`Node [${index}]: "${name}"`);
    console.log(`  Parent path: ${getParentPath(index) || 'None (Root)'}`);
    console.log(`  Mesh index: ${node.mesh !== undefined ? node.mesh : 'none'}`);
    console.log(`  Translation: ${node.translation ? JSON.stringify(node.translation) : '[0,0,0]'}`);
    console.log(`  Scale: ${node.scale ? JSON.stringify(node.scale) : '[1,1,1]'}`);
    console.log(`  Rotation (Quaternion): ${node.rotation ? JSON.stringify(node.rotation) : '[0,0,0,1]'}`);
    console.log('--------------------------------------------------');
  }
});
