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
  console.log(`\n=========================================`);
  console.log(`Animation ${idx}: "${anim.name}"`);
  console.log(`=========================================`);
  
  // Group channels by target path (translation, rotation, scale)
  const paths = {};
  anim.channels.forEach(c => {
    paths[c.target.path] = (paths[c.target.path] || 0) + 1;
  });
  console.log('Channel paths count:', paths);
  
  // Look at keyframe counts for all samplers in this animation
  const counts = anim.samplers.map(s => gltf.accessors[s.input].count);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);
  const avgCount = (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1);
  console.log(`Keyframe counts - Min: ${minCount}, Max: ${maxCount}, Avg: ${avgCount}`);
  
  // Let's print details of a few channels targeting different bones
  const sampleBones = ['mixamorig:Hips', 'mixamorig:LeftArm', 'mixamorig:RightArm', 'mixamorig:LeftForeArm', 'mixamorig:RightForeArm'];
  sampleBones.forEach(boneName => {
    const channel = anim.channels.find(c => {
      const targetNode = gltf.nodes[c.target.node];
      return targetNode && targetNode.name === boneName && c.target.path === 'rotation';
    });
    
    if (channel) {
      const targetNode = gltf.nodes[channel.target.node];
      const sampler = anim.samplers[channel.sampler];
      const outputAccessor = gltf.accessors[sampler.output];
      console.log(`\nBone: "${boneName}" (rotation)`);
      console.log(`  Sampler output count: ${outputAccessor.count}`);
      // If output accessor has min/max values
      if (outputAccessor.min && outputAccessor.max) {
        console.log(`  Output min: [${outputAccessor.min.map(v => v.toFixed(3))}]`);
        console.log(`  Output max: [${outputAccessor.max.map(v => v.toFixed(3))}]`);
      }
    }
  });
});
