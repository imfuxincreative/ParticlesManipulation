import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

// Node 623 is "typo"
const typoNode = gltf.nodes[623];
console.log("=== TYPO NODE FULL DETAILS ===");
console.log(JSON.stringify(typoNode, null, 2));

// Find its mesh
if (typoNode.mesh !== undefined) {
  const mesh = gltf.meshes[typoNode.mesh];
  console.log("\n=== MESH ===");
  console.log(`Name: ${mesh.name}`);
  console.log(`Primitives: ${mesh.primitives.length}`);
  if (mesh.primitives[0]?.material !== undefined) {
    const matIdx = mesh.primitives[0].material;
    const mat = gltf.materials[matIdx];
    console.log(`\n=== MATERIAL ===`);
    console.log(JSON.stringify(mat, null, 2));
  }
}

// Trace full parent chain up to Scene root
console.log("\n=== PARENT CHAIN ===");
function findParent(nodeIdx) {
  for (let i = 0; i < gltf.nodes.length; i++) {
    const n = gltf.nodes[i];
    if (n.children && n.children.includes(nodeIdx)) {
      return i;
    }
  }
  return -1;
}

let current = 623;
while (current >= 0) {
  const node = gltf.nodes[current];
  console.log(`Node ${current}: "${node.name}"`);
  console.log(`  translation: ${JSON.stringify(node.translation)}`);
  console.log(`  rotation: ${JSON.stringify(node.rotation)}`);
  console.log(`  scale: ${JSON.stringify(node.scale)}`);
  current = findParent(current);
}

// Check which scene root nodes include this
console.log("\n=== Is 'typo' a direct Scene child? ===");
const scene = gltf.scenes[gltf.scene || 0];
console.log(`Scene root nodes: ${scene.nodes}`);
console.log(`623 in root? ${scene.nodes.includes(623)}`);
