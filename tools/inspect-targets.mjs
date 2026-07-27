import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const magic = buf.readUInt32LE(0);
if (magic !== 0x46546C67) {
  console.error("Not a valid GLB file");
  process.exit(1);
}

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

// Search for target-named nodes
console.log("=== Searching for 'target' in node names ===");
gltf.nodes.forEach((n, i) => {
  if (n.name && n.name.toLowerCase().includes("target")) {
    console.log(`  Node ${i}: "${n.name}"`);
    if (n.translation) console.log(`    translation: ${JSON.stringify(n.translation)}`);
    if (n.rotation) console.log(`    rotation: ${JSON.stringify(n.rotation)}`);
    if (n.scale) console.log(`    scale: ${JSON.stringify(n.scale)}`);
    if (n.mesh !== undefined) console.log(`    mesh: ${n.mesh}`);
    if (n.children) console.log(`    children: ${JSON.stringify(n.children)}`);
  }
});

// Print all node names for reference
console.log("\n=== ALL NODE NAMES ===");
gltf.nodes.forEach((n, i) => {
  console.log(`  Node ${i}: "${n.name || '(unnamed)'}"`);
});
