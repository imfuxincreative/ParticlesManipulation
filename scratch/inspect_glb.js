const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, '..', 'public', 'SCENE.glb');

if (!fs.existsSync(glbPath)) {
  console.error(`File not found: ${glbPath}`);
  process.exit(1);
}

const buffer = fs.readFileSync(glbPath);

// Validate magic
const magic = buffer.toString('utf8', 0, 4);
if (magic !== 'glTF') {
  console.error('Invalid GLB file: magic is not glTF');
  process.exit(1);
}

const version = buffer.readUInt32LE(4);
const length = buffer.readUInt32LE(8);
console.log(`GLB Version: ${version}, Total Length: ${length} bytes`);

// Read Chunk 0
const chunkLength = buffer.readUInt32LE(12);
const chunkType = buffer.toString('utf8', 16, 20);

if (chunkType !== 'JSON') {
  console.error(`Chunk 0 is not JSON: ${chunkType}`);
  process.exit(1);
}

const jsonBuffer = buffer.subarray(20, 20 + chunkLength);
const gltfJson = JSON.parse(jsonBuffer.toString('utf8'));

console.log('\n--- Meshes matching "floor" or "plane" ---');
if (gltfJson.meshes) {
  gltfJson.meshes.forEach((mesh, index) => {
    if (mesh.name && (mesh.name.toLowerCase().includes('floor') || mesh.name.toLowerCase().includes('plane'))) {
      console.log(`Mesh [${index}]: ${mesh.name}`);
    }
  });
}

console.log('\n--- Nodes matching "floor" or "plane" ---');
if (gltfJson.nodes) {
  gltfJson.nodes.forEach((node, index) => {
    if (node.name && (node.name.toLowerCase().includes('floor') || node.name.toLowerCase().includes('plane'))) {
      console.log(`Node [${index}]: ${node.name} (mesh index: ${node.mesh !== undefined ? node.mesh : 'none'})`);
    }
  });
}

