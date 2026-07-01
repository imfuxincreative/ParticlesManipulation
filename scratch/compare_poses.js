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

const animIndices = [352, 353, 354, 355, 356];

animIndices.forEach(idx => {
  const anim = gltf.animations[idx];
  if (!anim) return;
  console.log(`\n--- Animation ${idx}: "${anim.name}" (${anim.channels.length} channels) ---`);
  
  // Find a channel targeting a joint like mixamorig:LeftArm or mixamorig:LeftForeArm
  let testChannel = null;
  for (let c of anim.channels) {
    const targetNode = gltf.nodes[c.target.node];
    if (targetNode && (targetNode.name.includes('LeftArm') || targetNode.name.includes('LeftForeArm') || targetNode.name.includes('LeftShoulder'))) {
      testChannel = c;
      break;
    }
  }
  
  if (testChannel) {
    const targetNode = gltf.nodes[testChannel.target.node];
    const sampler = anim.samplers[testChannel.sampler];
    const inputAccessor = gltf.accessors[sampler.input];
    const outputAccessor = gltf.accessors[sampler.output];
    console.log(`Channel targets: "${targetNode.name}" path: "${testChannel.target.path}"`);
    console.log(`Sampler: input accessor ${sampler.input} (count: ${inputAccessor.count}), output accessor ${sampler.output} (count: ${outputAccessor.count})`);
    console.log(`Input min/max: [${inputAccessor.min}] / [${inputAccessor.max}]`);
  } else {
    console.log("No LeftArm/LeftForeArm channel found.");
  }
});
