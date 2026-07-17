const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, '..', 'public', 'SCENE.glb');
if (!fs.existsSync(glbPath)) {
  console.error("File not found:", glbPath);
  process.exit(1);
}

const buf = fs.readFileSync(glbPath);
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

const binaryOffset = 20 + jsonLen + 8;

function readAccessorFloats(accessorIdx) {
  const accessor = gltf.accessors[accessorIdx];
  if (!accessor) return null;
  const bufferView = gltf.bufferViews[accessor.bufferView];
  if (!bufferView) return null;

  const viewByteOffset = bufferView.byteOffset || 0;
  const accByteOffset = accessor.byteOffset || 0;
  const totalOffset = binaryOffset + viewByteOffset + accByteOffset;

  let componentCount = 1;
  if (accessor.type === 'VEC3') componentCount = 3;
  if (accessor.type === 'VEC4') componentCount = 4;

  const arr = [];
  for (let i = 0; i < accessor.count; i++) {
    const item = [];
    for (let c = 0; c < componentCount; c++) {
      const idx = totalOffset + (i * componentCount + c) * 4;
      item.push(buf.readFloatLE(idx));
    }
    arr.push(componentCount === 1 ? item[0] : item);
  }
  return arr;
}

let cameraNodeIdx = -1;
let hipsNodeIdx = -1;

gltf.nodes.forEach((node, idx) => {
  if (node.name === "Camera") cameraNodeIdx = idx;
  if (node.name === "mixamorigHips" || node.name === "mixamorig:Hips") hipsNodeIdx = idx;
});

console.log("=== CAMERA Y ANALYSIS ===");
gltf.animations.forEach((anim) => {
  if (anim.name === "CameraAction.001") {
    anim.channels.forEach((channel) => {
      if (channel.target.node === cameraNodeIdx && channel.target.path === "translation") {
        const sampler = anim.samplers[channel.sampler];
        const times = readAccessorFloats(sampler.input);
        const values = readAccessorFloats(sampler.output);

        let initialY = values[0][1];
        let movementStartIdx = -1;
        for (let i = 0; i < times.length; i++) {
          if (Math.abs(values[i][1] - initialY) > 0.001) {
            movementStartIdx = i;
            break;
          }
        }
        
        if (movementStartIdx !== -1) {
          console.log(`First camera movement detected at index ${movementStartIdx}:`);
          for (let j = Math.max(0, movementStartIdx - 5); j <= Math.min(times.length - 1, movementStartIdx + 10); j++) {
            const t = times[j];
            const y = values[j][1];
            const frameBlender = Math.round(t * 30 - 513);
            console.log(`  Index ${j}: Time = ${t.toFixed(4)}s (Blender Frame = ${frameBlender}), Y = ${y.toFixed(4)} (diff = ${(y - initialY).toFixed(4)})`);
          }
        }
      }
    });
  }
});

console.log("\n=== HIPS Y ANALYSIS ===");
gltf.animations.forEach((anim) => {
  if (anim.name === "mixamo.com.003") {
    anim.channels.forEach((channel) => {
      if (channel.target.node === hipsNodeIdx && channel.target.path === "translation") {
        const sampler = anim.samplers[channel.sampler];
        const times = readAccessorFloats(sampler.input);
        const values = readAccessorFloats(sampler.output);

        let initialY = values[0][1];
        let movementStartIdx = -1;
        for (let i = 0; i < times.length; i++) {
          if (Math.abs(values[i][1] - initialY) > 0.001) {
            movementStartIdx = i;
            break;
          }
        }

        if (movementStartIdx !== -1) {
          console.log(`First Hips movement detected at index ${movementStartIdx}:`);
          for (let j = Math.max(0, movementStartIdx - 5); j <= Math.min(times.length - 1, movementStartIdx + 10); j++) {
            const t = times[j];
            const y = values[j][1];
            const frameBlender = Math.round(t * 30 - 513); // Assumes same global timeline offset
            // Let's also print character-local frame (t * 30)
            const frameLocal = Math.round(t * 30);
            console.log(`  Index ${j}: Time = ${t.toFixed(4)}s (Blender Frame = ${frameBlender}, Local Frame = ${frameLocal}), Y = ${y.toFixed(4)} (diff = ${(y - initialY).toFixed(4)})`);
          }
        } else {
          console.log("No Hips movement detected relative to first frame!");
          // Let's print some sample keyframes from the middle (e.g. index 300 to 320)
          console.log("Printing sample Hips frames from index 300 to 310:");
          for (let j = 300; j < 310 && j < times.length; j++) {
            const t = times[j];
            const y = values[j][1];
            console.log(`  Index ${j}: Time = ${t.toFixed(4)}s, Y = ${y.toFixed(4)}`);
          }
        }
      }
    });
  }
});
