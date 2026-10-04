import * as THREE from "three";
import { atmosphereUniforms } from "./atmosphereUniforms";
import { atmosphereParsGLSL } from "@/shaders/atmosphericFog.glsl";

export function patchMaterialWithAtmosphere(mat: THREE.Material): void {
  if (!mat || mat.userData.atmospherePatched === true) return;
  mat.userData.atmospherePatched = true;

  const originalOnBeforeCompile = mat.onBeforeCompile;

  mat.onBeforeCompile = (shader, renderer) => {
    if (originalOnBeforeCompile) {
      originalOnBeforeCompile(shader, renderer);
    }

    if (!shader.fragmentShader.includes("#include <fog_fragment>")) {
      return;
    }

    Object.assign(shader.uniforms, atmosphereUniforms);

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vAtmoWorldPos;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 atmoWP = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          atmoWP = batchingMatrix * atmoWP;
        #endif
        #ifdef USE_INSTANCING
          atmoWP = instanceMatrix * atmoWP;
        #endif
        vAtmoWorldPos = (modelMatrix * atmoWP).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vAtmoWorldPos;\n${atmosphereParsGLSL}`)
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>\n        gl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, distance(vAtmoWorldPos, uCamPos), vAtmoWorldPos);`
      );
  };

  mat.needsUpdate = true;
}
