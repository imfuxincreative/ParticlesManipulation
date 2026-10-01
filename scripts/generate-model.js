const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const glbRelativePath = 'public/SCENE.glb';
const outputPath = path.join(__dirname, '..', 'src', 'components', 'SceneModelGenerated.tsx');

console.log(`1. Running gltfjsx on "${glbRelativePath}"...`);
try {
  execSync(`npx gltfjsx "${glbRelativePath}" -o src/components/SceneModelGenerated.tsx --types`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log("✓ gltfjsx completed successfully.");
  try {
    const buf = fs.readFileSync(path.join(__dirname, '..', glbRelativePath));
    const jsonLen = buf.readUInt32LE(12);
    const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
    const json = JSON.parse(jsonStr);
    const animNames = json.animations ? json.animations.map(a => a.name) : [];
    console.log("ℹ Animation Clips detected in GLB:", animNames);
  } catch (e) {}
} catch (err) {
  console.error("✗ Failed to run gltfjsx:", err.message);
  process.exit(1);
}

console.log("2. Patching generated component with custom features...");
let code = fs.readFileSync(outputPath, 'utf8');

// Add @ts-nocheck to top of auto-generated file to prevent TypeScript control flow analysis overflow on massive 3D mesh trees
if (!code.startsWith('// @ts-nocheck')) {
  code = '// @ts-nocheck\n' + code;
}

// A. Add useFrame and useThree imports
code = code.replace(
  "import { useGLTF, PerspectiveCamera, useAnimations } from '@react-three/drei'",
  "import { useGLTF, PerspectiveCamera, useAnimations } from '@react-three/drei'\nimport { useFrame, useThree } from '@react-three/fiber'"
);

// B. Inject custom React hooks, anisotropic texture filtering, and defensive optional chaining
const newSignature = `export function Model(props: React.ComponentPropsWithoutRef<'group'>) {
  const group = React.useRef<THREE.Group>(null)
  const { nodes, materials, animations } = useGLTF('/SCENE.glb') as unknown as GLTFResult
  const { actions, names } = useAnimations(animations, group)

  // Configure anisotropic filtering on all loaded textures (capped on mobile to prevent GPU VRAM stalls)
  const gl = useThree((state) => state.gl)
  React.useLayoutEffect(() => {
    const isMobileDevice = typeof window !== "undefined" && window.innerWidth < 768
    const maxAnisotropy = Math.min(isMobileDevice ? 2 : 4, gl.capabilities.getMaxAnisotropy())
    Object.values(materials || {}).forEach((material) => {
      if (material) {
        const textureKeys: (keyof THREE.MeshStandardMaterial)[] = [
          'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'lightMap'
        ]
        textureKeys.forEach((key) => {
          const texture = material[key] as THREE.Texture | null | undefined
          if (texture && texture.isTexture) {
            texture.anisotropy = maxAnisotropy
          }
        })
      }
    })
  }, [materials, gl])

  return (`;

// Regular expression to replace the function model declaration
const regexSignature = /export\s+function\s+Model\s*\([\s\S]*?\)\s*\{[\s\S]*?return\s*\(/;
code = code.replace(regexSignature, newSignature);

// C. Make perspective camera makeDefault={true} if present
code = code.replace(
  /<PerspectiveCamera name="Camera" makeDefault=\{false\}/,
  '<PerspectiveCamera name="Camera" makeDefault={true}'
);

// D. Add defensive optional chaining to prevent runtime geometry/material loading crashes
// 1) nodes.xyz.geometry -> nodes.xyz?.geometry
code = code.replace(/nodes\.([a-zA-Z0-9_]+)\.geometry/g, 'nodes.$1?.geometry');
// 2) nodes.xyz.material -> nodes.xyz?.material
code = code.replace(/nodes\.([a-zA-Z0-9_]+)\.material/g, 'nodes.$1?.material');
// 3) nodes['xyz'].geometry -> nodes['xyz']?.geometry
code = code.replace(/nodes\[['"]([^'"]+)['"]\]\.geometry/g, "nodes['$1']?.geometry");
// 4) nodes['xyz'].material -> nodes['xyz']?.material
code = code.replace(/nodes\[['"]([^'"]+)['"]\]\.material/g, "nodes['$1']?.material");
// 5) materials['xyz'] -> materials?.['xyz']
code = code.replace(/materials(?!\?\.)\[['"]([^'"]+)['"]\]/g, "materials?.['$1']");

fs.writeFileSync(outputPath, code, 'utf8');
console.log("✓ Component successfully patched with anisotropic filtering, makeDefault camera, and defensive optional chaining!");
console.log("✓ Done!");
