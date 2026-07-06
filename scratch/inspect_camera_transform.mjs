import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

console.log("=== Searching for Camera node ===");
if (gltf.nodes) {
  gltf.nodes.forEach((node, i) => {
    if (node.name && node.name.toLowerCase().includes("camera")) {
      console.log(`\nFound Node ${i}: "${node.name}"`);
      console.log(`  Translation: ${JSON.stringify(node.translation)}`);
      console.log(`  Rotation: ${JSON.stringify(node.rotation)}`);
      console.log(`  Scale: ${JSON.stringify(node.scale)}`);
      console.log(`  Camera: ${node.camera}`);
    }
  });
}
