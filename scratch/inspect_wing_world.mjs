import { readFileSync } from "fs";
import { resolve } from "path";
import * as THREE from "three";

// Since SCENE.glb is a binary GLTF, we can't easily run Three.js GLTFLoader in plain node without dynamic imports
// and a canvas/fetch mock. Let's write a small script to parse the hierarchy and compute the world matrices manually!
const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

// Let's build a tree and compute node local matrices, then world matrices.
const nodes = gltf.nodes;

// Initialize matrices
const localMatrices = nodes.map(node => {
  const m = new THREE.Matrix4();
  const pos = node.translation ? new THREE.Vector3(...node.translation) : new THREE.Vector3();
  const rot = node.rotation ? new THREE.Quaternion(...node.rotation) : new THREE.Quaternion();
  const scale = node.scale ? new THREE.Vector3(...node.scale) : new THREE.Vector3(1, 1, 1);
  m.compose(pos, rot, scale);
  return m;
});

const worldMatrices = nodes.map(() => new THREE.Matrix4());

// Find root nodes of the scene
const scene = gltf.scenes[gltf.scene || 0];
const roots = scene.nodes;

function computeWorldMatrices(nodeIdx, parentWorldMatrix) {
  const localMat = localMatrices[nodeIdx];
  const worldMat = worldMatrices[nodeIdx];
  if (parentWorldMatrix) {
    worldMat.multiplyMatrices(parentWorldMatrix, localMat);
  } else {
    worldMat.copy(localMat);
  }
  const node = nodes[nodeIdx];
  if (node.children) {
    node.children.forEach(c => computeWorldMatrices(c, worldMat));
  }
}

roots.forEach(r => computeWorldMatrices(r, null));

// Now print the computed world positions of the wing meshes
const wingIdx = nodes.findIndex(n => n.name && n.name.toLowerCase() === "wing");
console.log(`Wing Node Index: ${wingIdx}`);

function printWorldTransforms(idx, depth = 0) {
  const node = nodes[idx];
  const prefix = "  ".repeat(depth + 1);
  const worldMat = worldMatrices[idx];
  const pos = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  worldMat.decompose(pos, rot, scale);
  
  console.log(`${prefix}Node ${idx}: "${node.name}"`);
  console.log(`${prefix}  World Position: [${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)}]`);
  console.log(`${prefix}  World Scale: [${scale.x.toFixed(3)}, ${scale.y.toFixed(3)}, ${scale.z.toFixed(3)}]`);
  
  if (node.children) {
    node.children.forEach(c => printWorldTransforms(c, depth + 1));
  }
}

printWorldTransforms(wingIdx);
