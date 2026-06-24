const THREE = require('three');
const keys = Object.keys(THREE.ShaderChunk).filter(k => k.includes('skin'));
console.log('Skinning chunks:', keys);
keys.forEach(k => {
  console.log(`\n=== ${k} ===`);
  console.log(THREE.ShaderChunk[k].substring(0, 500));
});
