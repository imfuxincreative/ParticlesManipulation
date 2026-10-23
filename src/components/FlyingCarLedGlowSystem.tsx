"use client";

import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FlyingCarLedShader } from "@/shaders/flyingCarLedShader";
import { useSimulation } from "@/context/SimulationContext";
import { atmosphereUniforms } from "@/lib/atmosphereUniforms";

interface FlyingCarLedGlowSystemProps {
  scene: THREE.Object3D;
}

export const FlyingCarLedGlowSystem: React.FC<FlyingCarLedGlowSystemProps> = ({ scene }) => {
  const { settings } = useSimulation();
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);
  const originalMaterialsRef = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map());

  // Initialize shader material and attach to all car LED meshes
  useEffect(() => {
    if (!scene) return;

    // Create shader material with cloned uniforms + atmosphere uniform references
    const mat = new THREE.ShaderMaterial({
      vertexShader: FlyingCarLedShader.vertexShader,
      fragmentShader: FlyingCarLedShader.fragmentShader,
      uniforms: {
        ...THREE.UniformsUtils.clone(FlyingCarLedShader.uniforms),
        ...atmosphereUniforms,
      },
      side: THREE.DoubleSide,
      depthWrite: true,
      transparent: false,
    });

    mat.uniforms.uIntensity.value = settings.carLedIntensity ?? 3.5;
    if (settings.carLedColor) {
      mat.uniforms.uColor.value.set(settings.carLedColor);
    }
    mat.uniforms.uPulse.value = settings.carLedPulse !== false ? 1.0 : 0.0;
    mat.uniforms.uPulseSpeed.value = settings.carLedPulseSpeed ?? 2.5;

    materialRef.current = mat;

    const detectedMeshes: THREE.Mesh[] = [];
    const originalMats = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

    // Traverse scene to find all LED meshes belonging to flying cars
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const meshName = child.name ? child.name.toLowerCase() : "";
      const isLedNamed = meshName.startsWith("led") || /^led(\d+)?$/i.test(child.name);

      if (!isLedNamed) return;

      // Verify that this LED mesh is a child of a flying car group
      let isUnderCar = false;
      let ancestor: THREE.Object3D | null = child.parent;
      while (ancestor) {
        const ancName = ancestor.name ? ancestor.name.toLowerCase() : "";
        if (
          ancName.startsWith("flying-car") ||
          ancName.startsWith("flying_car") ||
          /^flying[-_]?car/i.test(ancestor.name)
        ) {
          isUnderCar = true;
          break;
        }
        ancestor = ancestor.parent;
      }

      // If under a car, apply the custom glowing shader
      if (isUnderCar) {
        originalMats.set(child, child.material);
        child.material = mat;
        child.visible = true;
        child.frustumCulled = false;
        detectedMeshes.push(child);
      }
    });

    meshesRef.current = detectedMeshes;
    originalMaterialsRef.current = originalMats;

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[FlyingCarLedGlowSystem] Attached glow light shader to ${detectedMeshes.length} LED meshes:`,
        detectedMeshes.map((m) => m.name)
      );
    }

    return () => {
      // Teardown: restore original materials and dispose shader
      originalMats.forEach((origMat, mesh) => {
        if (mesh) {
          mesh.material = origMat;
        }
      });
      originalMats.clear();
      meshesRef.current = [];
      mat.dispose();
      materialRef.current = null;
    };
  }, [scene]);

  // Reactive synchronization with SimulationContext settings
  useEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;

    mat.uniforms.uIntensity.value = settings.carLedIntensity ?? 3.5;
    if (settings.carLedColor) {
      mat.uniforms.uColor.value.set(settings.carLedColor);
    }
    mat.uniforms.uPulse.value = settings.carLedPulse !== false ? 1.0 : 0.0;
    mat.uniforms.uPulseSpeed.value = settings.carLedPulseSpeed ?? 2.5;
  }, [settings.carLedIntensity, settings.carLedColor, settings.carLedPulse, settings.carLedPulseSpeed]);

  // Animate time for pulse and organic electrical current shimmer
  useFrame((state) => {
    const mat = materialRef.current;
    if (mat && settings.carLedPulse !== false) {
      mat.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return null;
};
