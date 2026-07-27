import { readFileSync } from "fs";
import { resolve } from "path";

const buf = readFileSync(resolve("public/SCENE.glb"));
const jl = buf.readUInt32LE(12);
const g = JSON.parse(buf.slice(20, 20 + jl).toString("utf8"));

g.nodes.forEach((n, i) => {
  if (n.name && n.name.toLowerCase().includes("target")) {
    console.log(`Node ${i}: "${n.name}" translation:${JSON.stringify(n.translation)} mesh:${n.mesh} children:${JSON.stringify(n.children)}`);
  }
});
