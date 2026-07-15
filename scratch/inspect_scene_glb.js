const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, '..', 'public', 'SCENE.glb');
if (!fs.existsSync(glbPath)) {
  console.log('File does not exist:', glbPath);
  process.exit(1);
}

const buffer = fs.readFileSync(glbPath);
const chunkLength = buffer.readUInt32LE(12);
const jsonString = buffer.toString('utf8', 20, 20 + chunkLength);
const gltf = JSON.parse(jsonString);

console.log('--- ANIMATIONS ---');
if (gltf.animations) {
  gltf.animations.forEach((anim, idx) => {
    console.log(`Anim ${idx}: name="${anim.name || ''}"`);
    // Find duration by looking at accessors for sampler inputs
    let maxTime = 0;
    if (anim.samplers) {
      anim.samplers.forEach((sampler) => {
        const inputAccessorIdx = sampler.input;
        const accessor = gltf.accessors[inputAccessorIdx];
        if (accessor && accessor.max) {
          maxTime = Math.max(maxTime, accessor.max[0]);
        }
      });
    }
    console.log(`  Duration: ${maxTime} seconds (${maxTime * 30} frames at 30fps)`);
  });
} else {
  console.log('No animations found');
}
