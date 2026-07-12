import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

// Find accessors for translation of Camera and mixamorig:Spine
gltf.animations.forEach((anim) => {
  if (anim.name.includes("CameraAction.001") || anim.name.includes("mixamo.com.003")) {
    console.log(`\n=== Animation: ${anim.name} ===`);
    anim.channels.forEach((channel) => {
      const nodeName = gltf.nodes[channel.target.node]?.name;
      if (nodeName === "Camera" || nodeName.toLowerCase().includes("spine") || nodeName.toLowerCase().includes("hip")) {
        const sampler = anim.samplers[channel.sampler];
        const inputAccessor = gltf.accessors[sampler.input];
        const outputAccessor = gltf.accessors[sampler.output];
        
        console.log(`Node: "${nodeName}" channel: "${channel.target.path}"`);
        console.log(`  Input count: ${inputAccessor.count}, min: ${inputAccessor.min[0]}, max: ${inputAccessor.max[0]}`);
        console.log(`  Output count: ${outputAccessor.count}, min: ${JSON.stringify(outputAccessor.min)}, max: ${JSON.stringify(outputAccessor.max)}`);
      }
    });
  }
});
