import { readFileSync } from "fs";
import { resolve } from "path";
import * as THREE from "three";

// Since we are running in node, we need to mock GLTF or parse the JSON buffers.
// But we can just use the GLTF JSON to see the meshes and their coordinates!
const file = resolve("public/SCENE.glb");
const buf = readFileSync(file);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString("utf8");
const gltf = JSON.parse(jsonStr);

console.log("=== CHECKING MESH DATA IN GLTF ===");
// Wing node is 635, child 634, child 633, children 629, 632
// Let's check mesh 154, 155, 156, 157
const meshIndices = [154, 155, 156, 157];

meshIndices.forEach(idx => {
  const mesh = gltf.meshes[idx];
  if (!mesh) {
    console.log(`Mesh ${idx} not found`);
    return;
  }
  console.log(`\nMesh ${idx}: "${mesh.name}"`);
  mesh.primitives.forEach((prim, pi) => {
    console.log(`  Primitive ${pi}:`);
    const posAccessorIdx = prim.attributes.POSITION;
    const accessor = gltf.accessors[posAccessorIdx];
    console.log(`    POSITION Accessor ${posAccessorIdx}: count=${accessor.count} type=${accessor.type} componentType=${accessor.componentType}`);
    console.log(`    Min: ${JSON.stringify(accessor.min)}`);
    console.log(`    Max: ${JSON.stringify(accessor.max)}`);
  });
});
