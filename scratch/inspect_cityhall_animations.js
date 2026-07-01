const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, '..', 'public', 'cityhall.glb');
if (!fs.existsSync(glbPath)) {
  console.error("File not found:", glbPath);
  process.exit(1);
}

const buffer = fs.readFileSync(glbPath);
const chunkLength = buffer.readUInt32LE(12);
const jsonString = buffer.toString('utf8', 20, 20 + chunkLength);
const gltf = JSON.parse(jsonString);

console.log('--- CITYHALL ANIMATION SEARCH ---');
if (!gltf.animations) {
  console.log('No animations found.');
} else {
  gltf.animations.forEach((anim, idx) => {
    const name = anim.name || '';
    const nameLower = name.toLowerCase();
    
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    if (anim.samplers) {
      anim.samplers.forEach((sampler) => {
        const inputAccessorIdx = sampler.input;
        const accessor = gltf.accessors[inputAccessorIdx];
        if (accessor) {
          if (accessor.min && accessor.min[0] !== undefined) {
            minTime = Math.min(minTime, accessor.min[0]);
          }
          if (accessor.max && accessor.max[0] !== undefined) {
            maxTime = Math.max(maxTime, accessor.max[0]);
          }
        }
      });
    }
    
    const duration = maxTime - minTime;
    console.log(`Animation ${idx}: name="${name}" duration=${duration}s`);
  });
}
