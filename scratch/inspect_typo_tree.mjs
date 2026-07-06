import { readFileSync } from "fs";
import { resolve } from "path";

const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

// Node 623 is "typo" - check children recursively
function printNodeTree(idx, depth = 0) {
  const node = gltf.nodes[idx];
  const prefix = "  ".repeat(depth);
  const hasMesh = node.mesh !== undefined;
  console.log(`${prefix}Node ${idx}: "${node.name}" ${hasMesh ? `[mesh ${node.mesh}]` : "[no mesh]"}`);
  if (hasMesh) {
    const mesh = gltf.meshes[node.mesh];
    console.log(`${prefix}  Mesh: "${mesh.name}" prims:${mesh.primitives.length}`);
    mesh.primitives.forEach((p, pi) => {
      if (p.material !== undefined) {
        const mat = gltf.materials[p.material];
        console.log(`${prefix}    Prim ${pi}: material="${mat.name}"`);
        // Check if material has a texture
        if (mat.pbrMetallicRoughness?.baseColorTexture) {
          const texIdx = mat.pbrMetallicRoughness.baseColorTexture.index;
          const tex = gltf.textures[texIdx];
          console.log(`${prefix}      Texture: ${JSON.stringify(tex)}`);
          if (tex.source !== undefined && gltf.images[tex.source]) {
            const img = gltf.images[tex.source];
            console.log(`${prefix}      Image: ${JSON.stringify(img)}`);
          }
        }
      }
    });
  }
  if (node.children) {
    node.children.forEach(c => printNodeTree(c, depth + 1));
  }
}

printNodeTree(623);
