import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

console.log("=== Animation Channels ===");
if (gltf.animations) {
  gltf.animations.forEach((anim, i) => {
    console.log(`\nAnimation ${i}: "${anim.name}" (channels: ${anim.channels.length})`);
    // Print unique animated nodes
    const nodeIndices = new Set();
    anim.channels.forEach(ch => {
      nodeIndices.add(ch.target.node);
    });
    console.log(`  Animates nodes: ${Array.from(nodeIndices).map(idx => `${idx} ("${gltf.nodes[idx]?.name || "?"}")`).join(", ")}`);
  });
}
