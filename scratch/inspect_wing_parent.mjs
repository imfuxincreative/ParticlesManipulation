import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

let current = 635;
console.log(`Node ${current}: "${gltf.nodes[current]?.name}"`);

function findParent(nodeIdx) {
  for (let i = 0; i < gltf.nodes.length; i++) {
    const n = gltf.nodes[i];
    if (n.children && n.children.includes(nodeIdx)) {
      return i;
    }
  }
  return -1;
}

let parent = findParent(635);
if (parent !== -1) {
  console.log(`Parent Node ${parent}: "${gltf.nodes[parent].name}"`);
} else {
  console.log("No parent found (it is a root node)");
}
