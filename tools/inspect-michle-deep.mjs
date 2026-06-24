import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

// Check animation 2 (mixamo.com) - which bones does it target?
console.log("=== Animation 2: 'mixamo.com' - first 20 channels ===");
const anim = gltf.animations[2];
anim.channels.slice(0, 20).forEach(ch => {
  const node = gltf.nodes[ch.target.node];
  console.log(`  node:${ch.target.node} "${node?.name}" path:${ch.target.path}`);
});

// Check if the mixamo animation targets joints in the michle skin
const skin = gltf.skins[0];
console.log(`\n=== Skin 0 joints (${skin.joints.length} total, first 10) ===`);
skin.joints.slice(0, 10).forEach(j => {
  console.log(`  Joint node ${j}: "${gltf.nodes[j]?.name}"`);
});

// Check if any animation targets the michle joint nodes
const jointSet = new Set(skin.joints);
console.log("\n=== Which animations target michle skin joints? ===");
gltf.animations.forEach((anim, i) => {
  const jointChannels = anim.channels.filter(ch => jointSet.has(ch.target.node));
  console.log(`  Animation ${i} "${anim.name}": ${jointChannels.length}/${anim.channels.length} channels target michle joints`);
});

// Check if animation channels target node indices that DON'T exist in michle
console.log("\n=== Animation 2 channel targets (unique nodes) ===");
const targetNodes = new Set(gltf.animations[2].channels.map(ch => ch.target.node));
targetNodes.forEach(nodeIdx => {
  const inJoints = jointSet.has(nodeIdx);
  console.log(`  Node ${nodeIdx}: "${gltf.nodes[nodeIdx]?.name}" inMichleJoints:${inJoints}`);
});

// Check michle mesh details
console.log("\n=== Michle mesh geometry details ===");
[160, 161, 162, 163, 164, 165].forEach(meshIdx => {
  const mesh = gltf.meshes[meshIdx];
  console.log(`  Mesh ${meshIdx}: "${mesh.name}" primitives:${mesh.primitives.length}`);
  mesh.primitives.forEach((prim, pi) => {
    const attrs = Object.keys(prim.attributes);
    console.log(`    Prim ${pi}: attrs=[${attrs.join(",")}] material:${prim.material}`);
  });
});

// Check materials of michle
console.log("\n=== Michle materials ===");
const matIndices = new Set();
[160, 161, 162, 163, 164, 165].forEach(meshIdx => {
  gltf.meshes[meshIdx].primitives.forEach(p => {
    if (p.material !== undefined) matIndices.add(p.material);
  });
});
matIndices.forEach(mi => {
  const mat = gltf.materials[mi];
  console.log(`  Material ${mi}: "${mat.name}" alphaMode:${mat.alphaMode || 'OPAQUE'}`);
  if (mat.pbrMetallicRoughness) {
    const pbr = mat.pbrMetallicRoughness;
    console.log(`    baseColorFactor: ${JSON.stringify(pbr.baseColorFactor)}`);
    console.log(`    baseColorTexture: ${JSON.stringify(pbr.baseColorTexture)}`);
  }
});
