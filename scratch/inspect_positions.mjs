import { readFileSync } from "fs";
import { resolve } from "path";
import * as THREE from "three";

// Load GLTF JSON
const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

console.log("Nodes count:", gltf.nodes.length);

// Find Camera and Spine nodes
let cameraNodeIdx = -1;
let spineNodeIdx = -1;
gltf.nodes.forEach((n, idx) => {
  if (n.name === "Camera") cameraNodeIdx = idx;
  if (n.name && n.name.toLowerCase().includes("spine")) {
    console.log(`Spine Candidate index ${idx}: "${n.name}"`);
    spineNodeIdx = idx;
  }
});

console.log("Camera Node index:", cameraNodeIdx);
console.log("Spine Node index:", spineNodeIdx);

// Helper to evaluate translation, rotation, scale from animations at time t
function evaluateNodeTRS(nodeIdx, t) {
  if (nodeIdx === -1) return;
  const node = gltf.nodes[nodeIdx];
  if (!node) return;
  let translation = node.translation ? [...node.translation] : [0, 0, 0];
  let rotation = node.rotation ? [...node.rotation] : [0, 0, 0, 1];
  let scale = node.scale ? [...node.scale] : [1, 1, 1];

  if (gltf.animations) {
    gltf.animations.forEach((anim) => {
      if (anim.name.includes("CameraAction.001") || anim.name.includes("mixamo.com.003")) {
        anim.channels.forEach((channel) => {
          if (channel.target.node === nodeIdx) {
            const sampler = anim.samplers[channel.sampler];
            console.log(`Node ${nodeIdx} ("${node.name}") has channel targeting "${channel.target.path}" in animation "${anim.name}"`);
          }
        });
      }
    });
  }

  return { translation, rotation, scale };
}

evaluateNodeTRS(cameraNodeIdx, 25.2);
evaluateNodeTRS(spineNodeIdx, 25.2);
