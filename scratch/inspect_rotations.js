const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, '..', 'public', 'cityhall.glb');
if (!fs.existsSync(glbPath)) {
  console.error("File not found:", glbPath);
  process.exit(1);
}

const buffer = fs.readFileSync(glbPath);
const jsonLength = buffer.readUInt32LE(12);
const jsonString = buffer.toString('utf8', 20, 20 + jsonLength);
const gltf = JSON.parse(jsonString);

// Find the start of the binary chunk
const binaryHeaderStart = 20 + jsonLength;
const binaryLength = buffer.readUInt32LE(binaryHeaderStart);
const binaryBuffer = buffer.slice(binaryHeaderStart + 8, binaryHeaderStart + 8 + binaryLength);

function getAccessorValues(accessorIdx) {
  const accessor = gltf.accessors[accessorIdx];
  if (!accessor) return null;
  const bufferView = gltf.bufferViews[accessor.bufferView];
  if (!bufferView) return null;
  
  const byteOffset = (accessor.byteOffset || 0) + (bufferView.byteOffset || 0);
  const count = accessor.count;
  const componentType = accessor.componentType; // 5126 is FLOAT
  const type = accessor.type; // "VEC4", "SCALAR", etc.
  
  let numComponents = 1;
  if (type === 'VEC3') numComponents = 3;
  else if (type === 'VEC4') numComponents = 4;
  else if (type === 'MAT4') numComponents = 16;
  
  const result = [];
  if (componentType === 5126) { // FLOAT
    for (let i = 0; i < count; i++) {
      const element = [];
      for (let c = 0; c < numComponents; c++) {
        const offset = byteOffset + (i * numComponents + c) * 4;
        element.push(binaryBuffer.readFloatLE(offset));
      }
      result.push(element);
    }
  }
  return result;
}

const targetBones = [
  'mixamorig:LeftArm',
  'mixamorig:RightArm',
  'mixamorig:LeftForeArm',
  'mixamorig:RightForeArm'
];

console.log("--- BONE DEFAULT ROTATIONS IN NODES ---");
targetBones.forEach(boneName => {
  const node = gltf.nodes.find(n => n.name === boneName);
  if (node) {
    console.log(`Node "${boneName}": rotation=[${node.rotation ? node.rotation.map(r => r.toFixed(4)) : 'identity/none'}]`);
  }
});

const animIndices = [352, 353, 354, 355, 356];

animIndices.forEach(idx => {
  const anim = gltf.animations[idx];
  if (!anim) return;
  console.log(`\n--- Animation ${idx}: "${anim.name}" ---`);
  
  targetBones.forEach(boneName => {
    const channel = anim.channels.find(c => {
      const targetNode = gltf.nodes[c.target.node];
      return targetNode && targetNode.name === boneName && c.target.path === 'rotation';
    });
    
    if (channel) {
      const values = getAccessorValues(channel.sampler.output || anim.samplers[channel.sampler].output);
      if (values && values.length > 0) {
        console.log(`Bone "${boneName}": keyframe count=${values.length}`);
        console.log(`  First frame rotation: [${values[0].map(v => v.toFixed(4))}]`);
        if (values.length > 1) {
          console.log(`  Last frame rotation:  [${values[values.length - 1].map(v => v.toFixed(4))}]`);
        }
      }
    } else {
      console.log(`Bone "${boneName}": no rotation track`);
    }
  });
});
