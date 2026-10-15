import * as THREE from "three";

export interface EdgeFadeOptions {
  /** Fraction of the mesh's X-width (0..1) over which the fade happens, measured back from the +X edge. */
  fadeFraction?: number;
  /** Use smoothstep (true) or a pure linear ramp (false). */
  smooth?: boolean;
}

/**
 * Fades a mesh to opacity 0 towards its WORLD +X edge (same as Blender X+).
 * Clones the material(s) so shared materials on other meshes are not affected.
 */
export function applyEdgeFadeX(mesh: THREE.Mesh, options: EdgeFadeOptions = {}): void {
  if (!mesh || mesh.userData.edgeFadeApplied === true) return;
  mesh.userData.edgeFadeApplied = true;

  const { fadeFraction = 0.3, smooth = true } = options;

  // World-space bounds (parent rotations can flip the mesh's local X axis)
  mesh.updateWorldMatrix(true, false);
  const bbox = new THREE.Box3().setFromObject(mesh);
  const fadeEnd = bbox.max.x;
  const fadeStart = bbox.max.x - (bbox.max.x - bbox.min.x) * THREE.MathUtils.clamp(fadeFraction, 0.0001, 1);

  const patch = (src: THREE.Material): THREE.Material => {
    const mat = src.clone();
    // clone() copies userData but NOT onBeforeCompile -> allow atmosphere patch to re-apply on the clone
    delete mat.userData.atmospherePatched;
    mat.transparent = true;
    mat.depthWrite = true;

    const uniforms = {
      uEdgeFadeStart: { value: fadeStart },
      uEdgeFadeEnd: { value: fadeEnd },
    };
    mat.userData.edgeFadeUniforms = uniforms;

    const prevOnBeforeCompile = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => {
      if (prevOnBeforeCompile) prevOnBeforeCompile(shader, renderer);

      Object.assign(shader.uniforms, uniforms);

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vEdgeFadeLocalX;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvEdgeFadeLocalX = (modelMatrix * vec4(transformed, 1.0)).x;");

      const ramp = smooth
        ? "smoothstep(uEdgeFadeStart, uEdgeFadeEnd, vEdgeFadeLocalX)"
        : "clamp((vEdgeFadeLocalX - uEdgeFadeStart) / max(uEdgeFadeEnd - uEdgeFadeStart, 1e-5), 0.0, 1.0)";

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vEdgeFadeLocalX;\nuniform float uEdgeFadeStart;\nuniform float uEdgeFadeEnd;"
        )
        .replace(
          "#include <opaque_fragment>",
          `#include <opaque_fragment>\ngl_FragColor.a *= 1.0 - ${ramp};`
        );
    };

    // onBeforeCompile wrappers share the same toString(), so force a unique program cache key
    // or three.js would reuse a non-faded program for this material.
    const prevKey = mat.customProgramCacheKey.bind(mat);
    mat.customProgramCacheKey = () => `${prevKey()}|edgeFadeX|${smooth ? 1 : 0}`;

    mat.needsUpdate = true;
    return mat;
  };

  mesh.material = Array.isArray(mesh.material) ? mesh.material.map(patch) : patch(mesh.material);
}
