import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/sceene.glb");
const buf = readFileSync(file);

// GLB header: magic(4), version(4), length(4), then chunk0 length(4) + type(4)
const magic = buf.readUInt32LE(0);
if (magic !== 0x46546C67) {
  console.error("Not a valid GLB file");
  process.exit(1);
}

// First chunk is JSON
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

console.log("=== NODES ===");
if (gltf.nodes) {
  gltf.nodes.forEach((node, i) => {
    const meshInfo = node.mesh !== undefined ? ` [mesh: ${node.mesh}]` : "";
    const camInfo = node.camera !== undefined ? ` [camera: ${node.camera}]` : "";
    const childInfo = node.children ? ` children: [${node.children.join(",")}]` : "";
    console.log(`  Node ${i}: "${node.name || "(unnamed)"}"${meshInfo}${camInfo}${childInfo}`);
  });
}

console.log("\n=== CAMERAS ===");
if (gltf.cameras) {
  gltf.cameras.forEach((cam, i) => {
    console.log(`  Camera ${i}: type=${cam.type}`, JSON.stringify(cam[cam.type]));
  });
}

console.log("\n=== ANIMATIONS ===");
if (gltf.animations) {
  gltf.animations.forEach((anim, i) => {
    const channelInfo = anim.channels.map(ch => {
      const targetNode = ch.target.node;
      const targetPath = ch.target.path;
      return `node:${targetNode}(${gltf.nodes[targetNode]?.name || "?"}) path:${targetPath}`;
    });
    console.log(`  Animation ${i}: "${anim.name || "(unnamed)"}" channels: ${anim.channels.length}`);
    channelInfo.forEach(c => console.log(`    - ${c}`));
  });
}

console.log("\n=== MESHES ===");
if (gltf.meshes) {
  gltf.meshes.forEach((mesh, i) => {
    const primCount = mesh.primitives ? mesh.primitives.length : 0;
    console.log(`  Mesh ${i}: "${mesh.name || "(unnamed)"}" primitives: ${primCount}`);
  });
}

console.log("\n=== SCENE HIERARCHY ===");
function printTree(nodeIdx, depth = 0) {
  const node = gltf.nodes[nodeIdx];
  const prefix = "  ".repeat(depth + 1);
  const tags = [];
  if (node.mesh !== undefined) tags.push("MESH");
  if (node.camera !== undefined) tags.push("CAMERA");
  console.log(`${prefix}${node.name || `(node ${nodeIdx})`} [${tags.join(",")||"group"}]`);
  if (node.children) {
    node.children.forEach(c => printTree(c, depth + 1));
  }
}
const defaultScene = gltf.scene || 0;
const scene = gltf.scenes[defaultScene];
console.log(`  Scene: "${scene.name || "(unnamed)"}"`);
scene.nodes.forEach(n => printTree(n));
