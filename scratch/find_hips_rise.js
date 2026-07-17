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

let hipsNodeIdx = -1;
gltf.nodes.forEach((node, idx) => {
  if (node.name === "mixamorigHips" || node.name === "mixamorig:Hips") hipsNodeIdx = idx;
});

gltf.animations.forEach((anim) => {
  if (anim.name === "mixamo.com.003") {
    anim.channels.forEach((channel) => {
      if (channel.target.node === hipsNodeIdx && channel.target.path === "translation") {
        const sampler = anim.samplers[channel.sampler];
        const times = readAccessorFloats(sampler.input);
        const values = readAccessorFloats(sampler.output);

        console.log(`Scan Hips Y translation. Total frames: ${times.length}`);
        
        let prevY = values[0][1];
        let moves = [];
        
        for (let i = 0; i < times.length; i++) {
          const t = times[i];
          const y = values[i][1];
          const frameBlender = Math.round(t * 30 - 513);
          const diff = y - prevY;
          
          if (Math.abs(diff) > 0.001) {
            moves.push({ index: i, time: t, frame: frameBlender, y: y, diff: diff });
          }
          prevY = y;
        }

        console.log(`Detected ${moves.length} keyframes with Y change.`);
        if (moves.length > 0) {
          console.log(`First change at index ${moves[0].index}: Time = ${moves[0].time.toFixed(4)}s (Blender Frame = ${moves[0].frame}), Y = ${moves[0].y.toFixed(4)}`);
          console.log(`Last change at index ${moves[moves.length - 1].index}: Time = ${moves[moves.length - 1].time.toFixed(4)}s (Blender Frame = ${moves[moves.length - 1].frame}), Y = ${moves[moves.length - 1].y.toFixed(4)}`);
          
          // Print some key steps where major shifts occur
          console.log("\nMajor transitions in Hips Y:");
          let lastPrintedY = moves[0].y;
          console.log(`Frame ${moves[0].frame}: Y = ${moves[0].y.toFixed(4)}`);
          for (let m of moves) {
            if (Math.abs(m.y - lastPrintedY) > 2.0) {
              console.log(`Frame ${m.frame}: Y = ${m.y.toFixed(4)}`);
              lastPrintedY = m.y;
            }
          }
          console.log(`Frame ${moves[moves.length - 1].frame}: Y = ${moves[moves.length - 1].y.toFixed(4)}`);
        }
      }
    });
  }
});
