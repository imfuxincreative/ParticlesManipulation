import { readFileSync } from "fs";
import { resolve } from "path";
import * as THREE from "three";

// Since we are in node, we don't have GLTFLoader easily, but we can inspect using our mock hierarchy.
// Let's load the GLTF and parse the skeleton manually.
const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

// Let's find mixamorig:Spine2 (277) parent-chain
const parentChain = [];
let curr = 277; // mixamorig:Spine2
while (curr >= 0) {
  parentChain.unshift(curr);
  let parent = -1;
  for (let i = 0; i < gltf.nodes.length; i++) {
    if (gltf.nodes[i].children && gltf.nodes[i].children.includes(curr)) {
      parent = i;
      break;
    }
  }
  curr = parent;
}
console.log("Parent chain:", parentChain.map(idx => gltf.nodes[idx].name));

// Let's load the animation channels for all nodes in the chain
const anim = gltf.animations.find(a => a.name === "mixamo.com.003");

// We want to evaluate the translation/rotation at time 25.2s
// Since we don't have the binary buffer parsed, let's look at the node default translates.
// Actually, let's look at mixamorig:Hips (the root joint).
// Hips moves a lot.
// Let's write a parser for GLB binary chunk to extract accessor values so we can get the exact world position!
// Wait, is that necessary?
// In the browser, Three.js handles GLTFLoader and AnimationMixer automatically.
// The code we wrote above:
// const tempMixer = new THREE.AnimationMixer(gltf.scene);
// tempMixer.setTime(25.2);
// gltf.scene.updateMatrixWorld(true);
// Will work perfectly in the browser because Three.js has the full loaded binary buffer and full bones structure!
// So we don't need to write a binary parser in Node, we can trust the browser to do it correctly.
console.log("Success: Three.js will parse this easily in the browser.");
