"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { CityXRayMeshSystem } from "./CityXRayMeshSystem";
import { SimonGlowSystem } from "./SimonGlowSystem";
import { GridFloorMeshSystem } from "./GridFloorMeshSystem";
import { useSimulation } from "@/context/SimulationContext";

const CAMERA_NAME = "Camera";
const TARGET_NAME = "body";
const BLENDER_START_FRAME = -492;

/**
 * Visual properties each scene can customize.
 * Any property left undefined falls back to the global SimulationSettings.
 */
export interface SceneVisualOverrides {
  hazeColor?: string | THREE.Color;
  xrayFillOpacity?: number;
  xrayOutlineColor?: string | THREE.Color;
  xrayBaseColor?: string | THREE.Color;
  xrayOutlinePower?: number;
  xrayScanlineIntensity?: number;
  xrayBorderColor?: string | THREE.Color;
  xrayBorderOpacity?: number;
  xrayBorderThreshold?: number;
  xrayBorderRevealDepth?: number;
  xraySolidRevealDepth?: number;
  xrayHoverRadius?: number;
  skyColor?: string | THREE.Color;
  skyHorizonRange?: number;
  showSky?: boolean;
  showGridFloor?: boolean;
  gridFloorOpacity?: number;
  gridFloorY?: number;
  showFog?: boolean;
  fogColor?: string | THREE.Color;
  fogNear?: number;
  fogFar?: number;
  fogAmount?: number;
}

export interface SceneConfig {
  path: string;
  hasParticleTarget: boolean;
  activeAnimationName?: string; // Optional: specify the exact animation to play (e.g. "Action" for static posed action)
  visuals?: SceneVisualOverrides;
}

interface SceneSlotProps {
  config: SceneConfig;
  sceneIndex: number;
  projectionBounds: { min: number; max: number };
  onCameraReady: (cam: THREE.PerspectiveCamera) => void;
}

/**
 * SceneSlot
 *
 * Self-contained component that manages one GLB scene:
 * - Loads GLB, extracts meshes, finds/creates camera
 * - Sets up animations, drives them from gl.userData.sceneScrollNorms[sceneIndex]
 * - Renders <primitive> + <CityXRayMeshSystem> + <SimonGlitchSystem>
 */
export const SceneSlot: React.FC<SceneSlotProps> = ({
  config,
  sceneIndex,
  projectionBounds,
  onCameraReady,
}) => {
  const gltf = useGLTF(config.path);
  const { size } = useThree();
  const { settings } = useSimulation();
  const groupRef = useRef<THREE.Group>(null);

  const mixer = useMemo(() => new THREE.AnimationMixer(gltf.scene), [gltf.scene]);
  const actions = useMemo(() => {
    const act: Record<string, THREE.AnimationAction> = {};
    gltf.animations.forEach((clip) => {
      act[clip.name] = mixer.clipAction(clip);
    });
    return act;
  }, [gltf.animations, mixer]);

  useEffect(() => {
    return () => {
      if (mixer) {
        mixer.stopAllAction();
      }
    };
  }, [mixer]);

  const cameraReadyRef = useRef(false);

  // Track original properties of Simon's bodypart materials to restore on unmount
  const originalBodypartPropsRef = useRef<Map<THREE.Material, { transparent: boolean; opacity: number }>>(new Map());

  // Find the active mixamo action names (supports multiple characters)
  const activeMixamoActionNames = useMemo(() => {
    const names = gltf.animations.map((clip) => clip.name);
    const mixamoNames = names.filter((name) => name.toLowerCase().includes("mixamo"));
    mixamoNames.sort();

    const active: string[] = [];
    if (config.activeAnimationName !== undefined && mixamoNames.includes(config.activeAnimationName)) {
      active.push(config.activeAnimationName);
    }

    // Automatically pick up the newest/last mixamo animation for the second character
    if (mixamoNames.length > 0) {
      const last = mixamoNames[mixamoNames.length - 1];
      if (!active.includes(last)) {
        active.push(last);
      }
    }
    return active;
  }, [gltf.animations, config.activeAnimationName]);

  // Compute max animation duration for this scene
  const maxDuration = useMemo(() => {
    let max = 0;
    gltf.animations.forEach((clip) => {
      const name = clip.name;
      if (name.toLowerCase().includes("mixamo") && !activeMixamoActionNames.includes(name)) return;
      max = Math.max(max, clip.duration);
    });
    return max || 1;
  }, [gltf.animations, activeMixamoActionNames]);

  // Separate meshes: city meshes, target meshes, Simon glowing meshes, Simon bodypart meshes, and floor meshes
  const { cityMeshes, targetMeshes, simonGlowMeshes, simonBodypartMeshes, floorMeshes } = useMemo(() => {
    const city: THREE.Mesh[] = [];
    const target: THREE.Mesh[] = [];
    const simonGlow: THREE.Mesh[] = [];
    const simonBodypart: THREE.Mesh[] = [];
    const floor: THREE.Mesh[] = [];

    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((child) => {
      if (child.name === CAMERA_NAME || child instanceof THREE.Camera) {
        return;
      }

      if (child instanceof THREE.Mesh) {
        // Exclude meshes under the "wing" node or matching the new wing mesh names from general rendering
        let isWing = false;
        let pNode: THREE.Object3D | null = child;
        while (pNode) {
          if (
            pNode.name === "wing" ||
            pNode.name === "wing1" ||
            pNode.name === "wing2" ||
            pNode.name === "winghandle1" ||
            pNode.name === "winghandle2"
          ) {
            isWing = true;
            break;
          }
          pNode = pNode.parent;
        }
        if (isWing) {
          child.visible = false;
          return;
        }

        // Simon and new character meshes check
        let isSimon = false;
        let sNode: THREE.Object3D | null = child;
        while (sNode) {
          const lowerName = sNode.name ? sNode.name.toLowerCase() : "";
          if (
            lowerName.includes("simon") ||
            lowerName === "hair2" ||
            lowerName === "glass" ||
            lowerName === "glass.001" ||
            lowerName.includes("armature") ||
            lowerName === "shirt2" ||
            lowerName === "pant2" ||
            lowerName === "hair.001" ||
            lowerName === "bodypart2"
          ) {
            isSimon = true;
            break;
          }
          sNode = sNode.parent;
        }

        if (isSimon) {
          // Identify if it's the bodypart mesh (which shouldn't glow)
          let isBodypart = false;
          let bNode: THREE.Object3D | null = child;
          while (bNode) {
            const bName = bNode.name ? bNode.name.toLowerCase() : "";
            if (bName === "bodypart" || bName === "bodypart2") {
              isBodypart = true;
              break;
            }
            bNode = bNode.parent;
          }

          if (isBodypart) {
            // Keep bodypart visible with its original materials
            child.visible = true;
            child.frustumCulled = false;
            simonBodypart.push(child);
          } else {
            // Add other parts to glowing meshes
            simonGlow.push(child);
            child.visible = false; // Hidden initially, SimonGlowSystem will apply material & make visible
            child.frustumCulled = false;
          }
          return;
        }

        // Hide GLTF floor/ground plane meshes if showGridFloor is turned off
        const nameLower = child.name.toLowerCase();
        const isFloorMesh = nameLower.includes("plane") || nameLower === "floor" || nameLower.startsWith("floor.");
        if (isFloorMesh && !settings.showGridFloor) {
          child.visible = false;
          return;
        }

        if (isFloorMesh) {
          floor.push(child);
          child.visible = false; // Rendered by GridFloorMeshSystem
          return;
        }

        if (config.hasParticleTarget) {
          // Only Scene 1 separates target from city
          let isTarget = false;
          let node: THREE.Object3D | null = child;
          while (node) {
            if (node.name === TARGET_NAME) {
              isTarget = true;
              break;
            }
            node = node.parent;
          }
          if (isTarget) {
            target.push(child);
          } else {
            city.push(child);
          }
        } else {
          city.push(child);
        }
        child.visible = false;
      }
    });

    console.log(`[SceneSlot ${sceneIndex}] Separated: ${city.length} city meshes, ${target.length} target meshes, ${simonGlow.length} simon glow meshes, ${simonBodypart.length} simon bodypart meshes, ${floor.length} floor meshes`);
    return { cityMeshes: city, targetMeshes: target, simonGlowMeshes: simonGlow, simonBodypartMeshes: simonBodypart, floorMeshes: floor };
  }, [gltf, config.hasParticleTarget, sceneIndex, settings.showGridFloor]);



  // Assign a default white material to bodypart meshes since they may have been
  // exported without materials (which causes them to render black).
  // We clone the material for each mesh to prevent shared instance opacity bugs.
  useEffect(() => {
    const defaultSkinMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    });

    simonBodypartMeshes.forEach((mesh) => {
      mesh.material = defaultSkinMat.clone();
    });
  }, [simonBodypartMeshes]);

  // Enable transparency on Simon's bodypart meshes on mount, restore on unmount
  useEffect(() => {
    simonBodypartMeshes.forEach((mesh) => {
      if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (!originalBodypartPropsRef.current.has(mat)) {
            originalBodypartPropsRef.current.set(mat, {
              transparent: mat.transparent,
              opacity: mat.opacity,
            });
          }
          mat.transparent = true;
          mat.depthWrite = true;
        });
      }
    });

    return () => {
      originalBodypartPropsRef.current.forEach((props, mat) => {
        mat.transparent = props.transparent;
        mat.opacity = props.opacity;
      });
      originalBodypartPropsRef.current.clear();
    };
  }, [simonBodypartMeshes]);

  // Find and set up the camera
  useEffect(() => {
    if (cameraReadyRef.current) return;

    let sceneCamera: THREE.PerspectiveCamera | null = null;

    gltf.scene.traverse((child) => {
      if (child.name === CAMERA_NAME && (child as any).isCamera) {
        sceneCamera = child as THREE.PerspectiveCamera;
      }
      if (child.name === CAMERA_NAME) {
        child.children.forEach((c) => {
          if ((c as any).isCamera) {
            sceneCamera = c as THREE.PerspectiveCamera;
          }
        });
      }
    });

    if (!sceneCamera) {
      gltf.scene.traverse((child) => {
        if (child.name === CAMERA_NAME) {
          const cam = new THREE.PerspectiveCamera(
            60,
            size.width / size.height,
            0.1,
            1000
          );
          cam.position.set(0, 0, 0);
          cam.quaternion.identity();
          cam.scale.set(1, 1, 1);
          child.add(cam);
          sceneCamera = cam;
        }
      });
    }

    if (sceneCamera) {
      const cam = sceneCamera as THREE.PerspectiveCamera;
      cam.near = 0.1;
      cam.far = 1000.0;
      cam.aspect = size.width / size.height;
      cam.updateProjectionMatrix();
      cameraReadyRef.current = true;
      onCameraReady(cam);
      console.log(`[SceneSlot ${sceneIndex}] Camera registered`);
    }
  }, [gltf, size, sceneIndex, onCameraReady]);

  // Set up active animations (play paused)
  useEffect(() => {
    Object.keys(actions).forEach((name) => {
      if (name.toLowerCase().includes("mixamo") && !activeMixamoActionNames.includes(name)) {
        return;
      }
      const action = actions[name];
      if (action) {
        action.play();
        action.paused = true;
      }
    });
  }, [actions, activeMixamoActionNames]);

  // Drive animations from shared scroll state
  useFrame((state) => {
    const glUserData = (state.gl as any).userData || {};
    const activeSceneIndex = glUserData.activeSceneIndex ?? 0;
    const incomingSceneIndex = glUserData.incomingSceneIndex ?? -1;

    // A scene is visible only if it is the active scene OR the incoming transitioning scene
    const isVisible = (sceneIndex === activeSceneIndex) || (sceneIndex === incomingSceneIndex);

    if (groupRef.current) {
      groupRef.current.visible = isVisible;
    }

    if (!isVisible) return; // Skip updating animations/calculations if hidden

    const scrollNorms: number[] = glUserData.sceneScrollNorms || [];
    const scrollNorm = scrollNorms[sceneIndex] ?? 0.0;
    const globalTime = scrollNorm * maxDuration;

    // Update all active actions
    Object.keys(actions).forEach((name) => {
      if (name.toLowerCase().includes("mixamo") && !activeMixamoActionNames.includes(name)) return;
      const action = actions[name];
      if (action) {
        const clip = gltf.animations.find((c) => c.name === name);
        const duration = clip ? clip.duration : 1.0;

        // Shift all animations except camera by the Blender start frame offset
        const isCamera = name.toLowerCase().includes("camera");
        const timelineOffset = -BLENDER_START_FRAME / 30; // 17.1 seconds
        const evalTime = isCamera ? globalTime : (globalTime - timelineOffset);

        action.time = Math.min(Math.max(0, evalTime), duration);
      }
    });

    if (mixer) mixer.update(0);

    // Dynamic linear fog opacity fade for Simon's bodypart meshes
    simonBodypartMeshes.forEach((mesh) => {
      if (!mesh.material) return;

      const worldPos = new THREE.Vector3();
      mesh.getWorldPosition(worldPos);

      const viewSpacePos = worldPos.clone().applyMatrix4(state.camera.matrixWorldInverse);
      const depth = -viewSpacePos.z;

      const showFogVal = glUserData.sceneVisuals?.showFog !== undefined ? glUserData.sceneVisuals.showFog : settings.showFog;
      const fogNearVal = glUserData.sceneVisuals?.fogNear !== undefined ? glUserData.sceneVisuals.fogNear : settings.fogNear;
      const fogFarVal = glUserData.sceneVisuals?.fogFar !== undefined ? glUserData.sceneVisuals.fogFar : settings.fogFar;
      const fogAmountVal = glUserData.sceneVisuals?.fogAmount !== undefined ? glUserData.sceneVisuals.fogAmount : settings.fogAmount;

      let opacity = 1.0;
      if (showFogVal) {
        const fogFactor = THREE.MathUtils.clamp((fogFarVal - depth) / Math.max(fogFarVal - fogNearVal, 0.0001), 0.0, 1.0);
        const fogMix = fogAmountVal * (1.0 - fogFactor);
        opacity = 1.0 - fogMix;
      }

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((mat) => {
        mat.opacity = opacity;
      });
    });

    // Keep camera aspect ratio up to date
    if (cameraReadyRef.current) {
      gltf.scene.traverse((child) => {
        if ((child as any).isPerspectiveCamera) {
          (child as THREE.PerspectiveCamera).aspect = size.width / size.height;
          (child as THREE.PerspectiveCamera).updateProjectionMatrix();
        }
      });
    }
  }, -2);

  return (
    <group ref={groupRef}>
      <primitive object={gltf.scene} visible={true} />
      {cityMeshes.length > 0 && (
        <CityXRayMeshSystem
          meshes={cityMeshes}
          projectionBounds={projectionBounds}
          sceneIndex={sceneIndex}
        />
      )}
      {simonGlowMeshes.length > 0 && (
        <SimonGlowSystem
          meshes={simonGlowMeshes}
          sceneIndex={sceneIndex}
        />
      )}
      {floorMeshes.length > 0 && settings.showGridFloor && (
        <GridFloorMeshSystem
          meshes={floorMeshes}
          projectionBounds={projectionBounds}
          sceneIndex={sceneIndex}
        />
      )}

    </group>
  );
};
