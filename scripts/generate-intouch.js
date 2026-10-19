const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const glbRelativePath = 'public/inTouch.glb';
const originalGlbRelativePath = 'public/inTouch_original.glb';
const outputPath = path.join(__dirname, '..', 'src', 'components', 'InTouch', 'InTouchModelGenerated.tsx');

// Use original GLB if it exists, otherwise inTouch.glb
const sourceGlb = fs.existsSync(path.join(__dirname, '..', originalGlbRelativePath))
  ? originalGlbRelativePath
  : glbRelativePath;

console.log(`1. Running gltfjsx on "${sourceGlb}"...`);
try {
  execSync(`npx gltfjsx "${sourceGlb}" -o "src/components/InTouch/InTouchModelGenerated.tsx" --types`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log("✓ gltfjsx completed successfully.");
} catch (err) {
  console.error("✗ Failed to run gltfjsx:", err.message);
  process.exit(1);
}

// Read animation clips & node structure from GLB for diagnostic feedback
let animNames = [];
let meshNames = [];
let matNames = [];
try {
  const buf = fs.readFileSync(path.join(__dirname, '..', sourceGlb));
  const jsonLen = buf.readUInt32LE(12);
  const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
  const json = JSON.parse(jsonStr);
  animNames = json.animations ? json.animations.map(a => a.name) : [];
  meshNames = json.meshes ? json.meshes.map(m => m.name) : [];
  matNames = json.materials ? json.materials.map(m => m.name) : [];
  console.log("ℹ Meshes detected in GLB:", meshNames);
  console.log("ℹ Materials detected in GLB:", matNames.length > 0 ? matNames : "(none / unassigned in GLB)");
  console.log("ℹ Animation Clips detected in GLB:", animNames);
} catch (e) {
  console.warn("Notice: could not parse binary GLB header for diagnostics:", e.message);
}

console.log("2. Patching generated component with custom features & cache busting...");
let code = fs.readFileSync(outputPath, 'utf8');

// Ensure @ts-nocheck is at top
if (!code.startsWith('// @ts-nocheck')) {
  code = '// @ts-nocheck\n' + code;
}

// Add useFrame and useThree imports if needed
if (!code.includes("useThree")) {
  code = code.replace(
    "import { useGLTF, PerspectiveCamera, useAnimations } from '@react-three/drei'",
    "import { useGLTF, PerspectiveCamera, useAnimations } from '@react-three/drei'\nimport { useFrame, useThree } from '@react-three/fiber'"
  );
}

// Compute timestamp hash of target GLB for cache-busting
const targetGlbFullPath = path.join(__dirname, '..', 'public', 'inTouch.glb');
const mtime = fs.existsSync(targetGlbFullPath) ? Math.floor(fs.statSync(targetGlbFullPath).mtimeMs) : Date.now();
const glbUrlWithCacheBust = `/inTouch.glb?v=${mtime}`;

// Cache bust useGLTF and useGLTF.preload
code = code.replace(/useGLTF\(['"][^'"]*inTouch[^'"]*\.glb[^'"]*['"]\)/g, `useGLTF('${glbUrlWithCacheBust}')`);
code = code.replace(/useGLTF\.preload\(['"][^'"]*inTouch[^'"]*\.glb[^'"]*['"]\)/g, `useGLTF.preload('${glbUrlWithCacheBust}')`);

// Fix JSX.IntrinsicElements['group'] to React.ComponentPropsWithoutRef<'group'> for React 19 compatibility
code = code.replace(
  /export function Model\(props: JSX\.IntrinsicElements\['group'\]\)/g,
  `export interface InTouchModelGeneratedProps extends React.ComponentPropsWithoutRef<'group'> {
  customMaterial?: THREE.Material | null;
  onLoaded?: (data: { nodes: GLTFResult['nodes']; materials: GLTFResult['materials']; actions: Record<string, THREE.AnimationAction | null> }) => void;
  autoPlayAnimation?: boolean;
  cameraRef?: React.Ref<THREE.PerspectiveCamera>;
  makeDefaultCamera?: boolean;
}

export function Model(props: InTouchModelGeneratedProps)`
);

// Fix useRef typing for React 19
code = code.replace(/const group = React\.useRef<THREE\.Group>\(\)/g, "const group = React.useRef<THREE.Group>(null)");

// Inject animation auto-play and onLoaded callback hook
const autoPlaySnippet = `  const { actions } = useAnimations(animations, group)

  // Auto-play primary animation and notify parent of loaded nodes
  React.useEffect(() => {
    if (props.onLoaded) {
      props.onLoaded({ nodes, materials, actions });
    }
    if (props.autoPlayAnimation !== false) {
      const firstAction = Object.values(actions)[0];
      if (firstAction) {
        firstAction.reset().fadeIn(0.6).play();
        firstAction.setLoop(THREE.LoopRepeat, Infinity);
        firstAction.timeScale = 0.95;
      }
    }
  }, [actions, nodes, materials, props.onLoaded, props.autoPlayAnimation])`;

code = code.replace(/const \{ actions \} = useAnimations\(animations, group\)/, autoPlaySnippet);

// Replace material={nodes.xyz?.material} with material={props.customMaterial || nodes.xyz?.material}
// so callers can either let meshes use their original GLB materials OR inject a custom silhouette material
code = code.replace(/material=\{nodes\.([a-zA-Z0-9_]+)\.material\}/g, 'material={props.customMaterial !== undefined ? (props.customMaterial || undefined) : nodes.$1?.material}');
code = code.replace(/material=\{nodes\[['"]([^'"]+)['"]\]\.material\}/g, "material={props.customMaterial !== undefined ? (props.customMaterial || undefined) : nodes['$1']?.material}");

// Strip internal lights from the GLB (e.g. 54000+ watt point lights that blow out silhouette to white)
code = code.replace(/<pointLight[\s\S]*?\/>/g, '');
code = code.replace(/<directionalLight[\s\S]*?\/>/g, '');
code = code.replace(/<spotLight[\s\S]*?\/>/g, '');

// Preserve exported camera from Blender and wire with props.cameraRef and makeDefault
code = code.replace(
  /<PerspectiveCamera name="Camera" makeDefault=\{false\}([\s\S]*?)\/>/,
  '<PerspectiveCamera name="Camera" ref={props.cameraRef} makeDefault={props.makeDefaultCamera !== false}$1/>'
);

// Defensive optional chaining on nodes and materials
code = code.replace(/nodes\.([a-zA-Z0-9_]+)\.geometry/g, 'nodes.$1?.geometry');
code = code.replace(/nodes\.([a-zA-Z0-9_]+)\.material/g, 'nodes.$1?.material');
code = code.replace(/nodes\[['"]([^'"]+)['"]\]\.geometry/g, "nodes['$1']?.geometry");
code = code.replace(/nodes\[['"]([^'"]+)['"]\]\.material/g, "nodes['$1']?.material");
code = code.replace(/materials(?!\?\.)\[['"]([^'"]+)['"]\]/g, "materials?.['$1']");

fs.writeFileSync(outputPath, code, 'utf8');
console.log("✓ InTouch component successfully generated and patched at:", outputPath);
console.log("✓ Cache-buster applied:", glbUrlWithCacheBust);
console.log("✓ Done!");
