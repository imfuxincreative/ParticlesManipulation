import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

console.log("=== Searching for character/body nodes ===");
if (gltf.nodes) {
  gltf.nodes.forEach((node, i) => {
    if (node.name && (node.name.toLowerCase().includes("body") || node.name.toLowerCase().includes("character") || node.name.toLowerCase().includes("skater"))) {
      console.log(`\nFound Node ${i}: "${node.name}"`);
      console.log(`  Translation: ${JSON.stringify(node.translation)}`);
      console.log(`  Rotation: ${JSON.stringify(node.rotation)}`);
      console.log(`  Scale: ${JSON.stringify(node.scale)}`);
      console.log(`  Mesh: ${node.mesh}`);
      console.log(`  Children: ${JSON.stringify(node.children)}`);
    }
  });
}
