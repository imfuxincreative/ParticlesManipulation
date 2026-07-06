import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

function printSubtree(idx, depth = 0) {
  const node = gltf.nodes[idx];
  const prefix = "  ".repeat(depth + 1);
  const meshInfo = node.mesh !== undefined ? ` [mesh: ${node.mesh} "${gltf.meshes[node.mesh]?.name}"]` : "";
  console.log(`${prefix}Node ${idx}: "${node.name || "(unnamed)"}"${meshInfo}`);
  console.log(`${prefix}  translation: ${JSON.stringify(node.translation)}`);
  console.log(`${prefix}  rotation: ${JSON.stringify(node.rotation)}`);
  console.log(`${prefix}  scale: ${JSON.stringify(node.scale)}`);
  console.log(`${prefix}  children: ${JSON.stringify(node.children)}`);
  
  if (node.mesh !== undefined) {
    const mesh = gltf.meshes[node.mesh];
    if (mesh && mesh.primitives) {
      console.log(`${prefix}  primitives: ${mesh.primitives.length}`);
      mesh.primitives.forEach((prim, pi) => {
        console.log(`${prefix}    primitive ${pi}: attributes=${JSON.stringify(Object.keys(prim.attributes))}`);
      });
    }
  }

  if (node.children) {
    node.children.forEach(c => printSubtree(c, depth + 1));
  }
}

// Find wing index
const wingIdx = gltf.nodes.findIndex(n => n.name && n.name.toLowerCase() === "wing");
if (wingIdx === -1) {
  console.log("Could not find 'wing' node name exactly matching 'wing'");
} else {
  console.log(`=== WING SUBTREE (Node ${wingIdx}) ===`);
  printSubtree(wingIdx);
}
