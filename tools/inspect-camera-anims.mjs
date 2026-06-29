import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

console.log("=== CAMERA ANIMATIONS ===");
if (gltf.animations) {
  gltf.animations.forEach((anim, i) => {
    if (anim.name.toLowerCase().includes("camera")) {
      let minTime = Infinity;
      let maxTime = -Infinity;
      
      anim.samplers.forEach(sampler => {
        const accessor = gltf.accessors[sampler.input];
        if (accessor) {
          if (accessor.min && accessor.min[0] < minTime) minTime = accessor.min[0];
          if (accessor.max && accessor.max[0] > maxTime) maxTime = accessor.max[0];
        }
      });

      console.log(`Animation ${i}: "${anim.name}"`);
      console.log(`  Duration: ${minTime}s to ${maxTime}s (length: ${maxTime - minTime}s)`);
    }
  });
}
