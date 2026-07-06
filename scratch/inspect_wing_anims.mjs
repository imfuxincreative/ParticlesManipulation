import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

console.log("=== Animations and Wing Channels ===");
if (gltf.animations) {
  gltf.animations.forEach((anim, i) => {
    let hasWing = false;
    anim.channels.forEach(ch => {
      const nodeIdx = ch.target.node;
      const nodeName = gltf.nodes[nodeIdx]?.name || "";
      if (nodeName.toLowerCase().includes("wing") || (nodeIdx >= 623 && nodeIdx <= 627)) {
        hasWing = true;
      }
    });
    if (hasWing) {
      console.log(`  Animation ${i}: "${anim.name}" has wing channels:`);
      anim.channels.forEach(ch => {
        const nodeIdx = ch.target.node;
        const nodeName = gltf.nodes[nodeIdx]?.name || "";
        if (nodeName.toLowerCase().includes("wing") || (nodeIdx >= 623 && nodeIdx <= 627)) {
          console.log(`    - Node ${nodeIdx} ("${nodeName}") path: ${ch.target.path}`);
        }
      });
    }
  });
} else {
  console.log("No animations found");
}
