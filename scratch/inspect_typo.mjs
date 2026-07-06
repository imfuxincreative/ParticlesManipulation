import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

// GLB header
const magic = buf.readUInt32LE(0);
if (magic !== 0x46546C67) {
  console.error("Not a valid GLB file");
  process.exit(1);
}

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

// Find 'typo' node
console.log("=== Searching for 'typo' node ===");
if (gltf.nodes) {
  gltf.nodes.forEach((node, i) => {
    if (node.name && node.name.toLowerCase().includes("typo")) {
      console.log(`\nFound Node ${i}: "${node.name}"`);
      console.log(`  Translation: ${JSON.stringify(node.translation)}`);
      console.log(`  Rotation: ${JSON.stringify(node.rotation)}`);
      console.log(`  Scale: ${JSON.stringify(node.scale)}`);
      console.log(`  Mesh: ${node.mesh}`);
      console.log(`  Children: ${JSON.stringify(node.children)}`);
      
      // Find parent
      gltf.nodes.forEach((pNode, pi) => {
        if (pNode.children && pNode.children.includes(i)) {
          console.log(`  Parent Node ${pi}: "${pNode.name}"`);
          console.log(`    Parent Translation: ${JSON.stringify(pNode.translation)}`);
          console.log(`    Parent Rotation: ${JSON.stringify(pNode.rotation)}`);
          console.log(`    Parent Scale: ${JSON.stringify(pNode.scale)}`);
          
          // Grandparent
          gltf.nodes.forEach((gpNode, gpi) => {
            if (gpNode.children && gpNode.children.includes(pi)) {
              console.log(`  Grandparent Node ${gpi}: "${gpNode.name}"`);
              console.log(`    Grandparent Translation: ${JSON.stringify(gpNode.translation)}`);
              console.log(`    Grandparent Rotation: ${JSON.stringify(gpNode.rotation)}`);
              console.log(`    Grandparent Scale: ${JSON.stringify(gpNode.scale)}`);
            }
          });
        }
      });
      
      // If it has a mesh, print mesh info
      if (node.mesh !== undefined && gltf.meshes[node.mesh]) {
        const mesh = gltf.meshes[node.mesh];
        console.log(`  Mesh name: "${mesh.name}"`);
        console.log(`  Mesh primitives: ${mesh.primitives.length}`);
        if (mesh.primitives[0]?.material !== undefined) {
          const matIdx = mesh.primitives[0].material;
          const mat = gltf.materials[matIdx];
          console.log(`  Material: "${mat?.name}"`);
        }
      }
    }
  });
}

// Also print the top-level Scene children for context
console.log("\n=== Top-level Scene nodes ===");
const defaultScene = gltf.scene || 0;
const scene = gltf.scenes[defaultScene];
scene.nodes.forEach(n => {
  const node = gltf.nodes[n];
  console.log(`  Node ${n}: "${node.name}" translation=${JSON.stringify(node.translation)} rotation=${JSON.stringify(node.rotation)} scale=${JSON.stringify(node.scale)}`);
});
