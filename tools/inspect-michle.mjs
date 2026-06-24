import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const magic = buf.readUInt32LE(0);
if (magic !== 0x46546C67) {
  console.error("Not a valid GLB file");
  process.exit(1);
}

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

// Search for michle-related nodes
console.log("=== Searching for 'mich' in node names ===");
gltf.nodes.forEach((n, i) => {
  if (n.name && n.name.toLowerCase().includes("mich")) {
    console.log(`  Node ${i}: "${n.name}" mesh:${n.mesh} skin:${n.skin} children:${JSON.stringify(n.children || [])}`);
    // Check if it has translation/rotation/scale
    if (n.translation) console.log(`    translation: ${JSON.stringify(n.translation)}`);
    if (n.rotation) console.log(`    rotation: ${JSON.stringify(n.rotation)}`);
    if (n.scale) console.log(`    scale: ${JSON.stringify(n.scale)}`);
  }
});

// Show all nodes with skins (skinned meshes)
console.log("\n=== Nodes with SKIN (skinned meshes) ===");
gltf.nodes.forEach((n, i) => {
  if (n.skin !== undefined) {
    console.log(`  Node ${i}: "${n.name}" mesh:${n.mesh} skin:${n.skin}`);
  }
});

// Show skins
console.log("\n=== SKINS ===");
if (gltf.skins) {
  gltf.skins.forEach((skin, i) => {
    console.log(`  Skin ${i}: "${skin.name || '(unnamed)'}" skeleton:${skin.skeleton} joints:${skin.joints?.length}`);
  });
}

// Show animations that target michle nodes
console.log("\n=== Animations targeting michle-related nodes ===");
if (gltf.animations) {
  gltf.animations.forEach((anim, i) => {
    const michleChannels = anim.channels.filter(ch => {
      const nodeName = gltf.nodes[ch.target.node]?.name || "";
      return nodeName.toLowerCase().includes("mich") || nodeName.toLowerCase().includes("object");
    });
    if (michleChannels.length > 0) {
      console.log(`  Animation ${i}: "${anim.name}" (${michleChannels.length} michle channels)`);
      michleChannels.slice(0, 5).forEach(ch => {
        console.log(`    -> node:${ch.target.node}("${gltf.nodes[ch.target.node]?.name}") path:${ch.target.path}`);
      });
      if (michleChannels.length > 5) console.log(`    ... and ${michleChannels.length - 5} more`);
    }
  });
}

// Full hierarchy showing michle subtree
console.log("\n=== MICHLE SUBTREE ===");
function printTree(nodeIdx, depth = 0) {
  const node = gltf.nodes[nodeIdx];
  const prefix = "  ".repeat(depth + 1);
  const tags = [];
  if (node.mesh !== undefined) tags.push(`MESH:${node.mesh}`);
  if (node.camera !== undefined) tags.push("CAMERA");
  if (node.skin !== undefined) tags.push(`SKIN:${node.skin}`);
  console.log(`${prefix}${node.name || `(node ${nodeIdx})`} [${tags.join(",") || "group"}]`);
  if (node.children) {
    node.children.forEach(c => printTree(c, depth + 1));
  }
}

// Find michle root node
gltf.nodes.forEach((n, i) => {
  if (n.name && n.name.toLowerCase() === "michle") {
    printTree(i);
  }
});

// Show all animations list
console.log("\n=== ALL ANIMATIONS ===");
if (gltf.animations) {
  gltf.animations.forEach((anim, i) => {
    console.log(`  Animation ${i}: "${anim.name}" channels:${anim.channels.length}`);
  });
}

// Full scene hierarchy (top level only)
console.log("\n=== TOP-LEVEL SCENE NODES ===");
const defaultScene = gltf.scene || 0;
const scene = gltf.scenes[defaultScene];
scene.nodes.forEach(n => {
  const node = gltf.nodes[n];
  console.log(`  Node ${n}: "${node.name}" children:${node.children?.length || 0}`);
});
