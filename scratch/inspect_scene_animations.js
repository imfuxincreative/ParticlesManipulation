const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, '..', 'public', 'SCENE.glb');
if (!fs.existsSync(glbPath)) {
  console.error("File not found:", glbPath);
  process.exit(1);
}

const buffer = fs.readFileSync(glbPath);
const chunkLength = buffer.readUInt32LE(12);
const jsonString = buffer.toString('utf8', 20, 20 + chunkLength);
const gltf = JSON.parse(jsonString);

console.log('--- TARGETED ANIMATION SEARCH ---');
if (!gltf.animations) {
  console.log('No animations found.');
} else {
  gltf.animations.forEach((anim, idx) => {
    const name = anim.name || '';
    const nameLower = name.toLowerCase();
    
    // We want to find camera animations, mixamo animations, or anything containing 'simon' or 'action' with dynamic ranges
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
    
    // Only print animations that are either mixamo, camera, or have length > 0
    if (nameLower.includes('camera') || nameLower.includes('mixamo') || nameLower.includes('simon') || duration > 0.1) {
      console.log(`Animation ${idx}: name="${name}"`);
      console.log(`  Duration: ${minTime}s to ${maxTime}s (length: ${duration}s)`);
      console.log(`  Channels: ${anim.channels ? anim.channels.length : 0}`);
    }
  });
}
