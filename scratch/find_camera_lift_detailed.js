const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, '..', 'public', 'SCENE.glb');
const buf = fs.readFileSync(glbPath);
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);
const binaryOffset = 20 + jsonLen + 8;

function readAccessorFloats(accessorIdx) {
  const accessor = gltf.accessors[accessorIdx];
  const bufferView = gltf.bufferViews[accessor.bufferView];
  const viewByteOffset = bufferView.byteOffset || 0;
  const accByteOffset = accessor.byteOffset || 0;
  const totalOffset = binaryOffset + viewByteOffset + accByteOffset;

  let componentCount = 1;
  if (accessor.type === 'VEC3') componentCount = 3;

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
gltf.nodes.forEach((node, idx) => {
  if (node.name === "Camera") cameraNodeIdx = idx;
});

gltf.animations.forEach((anim) => {
  if (anim.name === "CameraAction.001") {
    anim.channels.forEach((channel) => {
      if (channel.target.node === cameraNodeIdx && channel.target.path === "translation") {
        const sampler = anim.samplers[channel.sampler];
        const times = readAccessorFloats(sampler.input);
        const values = readAccessorFloats(sampler.output);

        console.log("=== CAMERA Y LIFT DETAIL (Frames 700 to 1300) ===");
        for (let i = 0; i < times.length; i++) {
          const t = times[i];
          const frameBlender = Math.round(t * 30 - 513);
          if (frameBlender >= 700 && frameBlender <= 1300 && frameBlender % 10 === 0) {
            console.log(`  Blender Frame = ${frameBlender}: Time = ${t.toFixed(4)}s, Y = ${values[i][1].toFixed(4)}`);
          }
        }
      }
    });
  }
});
