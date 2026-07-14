import { readFileSync } from "fs";
import { resolve } from "path";
import * as THREE from "three";

// We need to mock some browser globals for Three.js GLTFLoader if we want to load via GLTFLoader,
// but since we just need the local positions and the node matrix, we can calculate it manually!

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

// Find floor node and mesh
const floorNodeIdx = gltf.nodes.findIndex(n => n.name === 'floor');
const floorNode = gltf.nodes[floorNodeIdx];
console.log("Floor Node:", floorNode);

// Compute local matrix
const translation = floorNode.translation ? new THREE.Vector3(...floorNode.translation) : new THREE.Vector3(0, 0, 0);
const rotation = floorNode.rotation ? new THREE.Quaternion(...floorNode.rotation) : new THREE.Quaternion(0, 0, 0, 1);
const scale = floorNode.scale ? new THREE.Vector3(...floorNode.scale) : new THREE.Vector3(1, 1, 1);
const localMatrix = new THREE.Matrix4().compose(translation, rotation, scale);

const meshIdx = floorNode.mesh;
const mesh = gltf.meshes[meshIdx];
console.log("Floor Mesh Primitives:", mesh.primitives);

const positionAccessorIdx = mesh.primitives[0].attributes.POSITION;
const accessor = gltf.accessors[positionAccessorIdx];
const bufferView = gltf.bufferViews[accessor.bufferView];

// Read binary data chunk
const binOffset = 20 + jsonLen + 8; // GLB header (12) + JSON chunk header (8) + JSON chunk length + BIN chunk header (8)
const binBuf = buf.slice(binOffset + bufferView.byteOffset);

// Read VEC3 float positions
const positions = [];
for (let i = 0; i < accessor.count; i++) {
  const x = binBuf.readFloatLE(i * 12);
  const y = binBuf.readFloatLE(i * 12 + 4);
  const z = binBuf.readFloatLE(i * 12 + 8);
  positions.push(new THREE.Vector3(x, y, z));
}

console.log("Local Positions:");
positions.forEach((p, idx) => console.log(`  v[${idx}]:`, p.x, p.y, p.z));

console.log("World Positions (assuming no parent transform):");
positions.forEach((p, idx) => {
  const wp = p.clone().applyMatrix4(localMatrix);
  console.log(`  wp[${idx}]:`, wp.x, wp.y, wp.z);
});
