"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SimonGlowSystem } from "./SimonGlowSystem";
import { GridFloorMeshSystem } from "./GridFloorMeshSystem";
import { TargetOverlayBridge } from "./callouts/TargetOverlayBridge";
import { InteractiveSceneParticleSystem } from "./InteractiveSceneParticleSystem";
import { CALLOUT_TARGETS } from "@/config/targetConfig";
import { useSimulation } from "@/context/SimulationContext";
import { patchMaterialWithAtmosphere } from "@/lib/patchAtmosphere";

const CAMERA_NAME = "Camera";
const TARGET_NAME = "body";
const BLENDER_START_FRAME = -492;

export interface SceneVisualOverrides {
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
  showGridFloor?: boolean;
  gridFloorOpacity?: number;
  gridFloorY?: number;
}

export interface SceneConfig {
  path: string;
  hasParticleTarget: boolean;
  activeAnimationName?: string;
  visuals?: SceneVisualOverrides;
}

interface SceneSlotProps {
  config: SceneConfig;
  sceneIndex: number;
  projectionBounds: { min: number; max: number };
  onCameraReady: (cam: THREE.PerspectiveCamera) => void;
}

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
  const baseFovRef = useRef<number>(0);

  const originalBodypartPropsRef = useRef<Map<THREE.Material, { transparent: boolean; opacity: number }>>(new Map());

  const activeMixamoActionNames = useMemo(() => {
    const names = gltf.animations.map((clip) => clip.name);
    const mixamoNames = names.filter((name) => name.toLowerCase().includes("mixamo"));
    mixamoNames.sort();

    const active: string[] = [];
    if (config.activeAnimationName !== undefined && mixamoNames.includes(config.activeAnimationName)) {
      active.push(config.activeAnimationName);
    }

    if (mixamoNames.length > 0) {
      const last = mixamoNames[mixamoNames.length - 1];
      if (!active.includes(last)) {
        active.push(last);
      }
    }
    return active;
  }, [gltf.animations, config.activeAnimationName]);

  const maxDuration = useMemo(() => {
    let max = 0;
    gltf.animations.forEach((clip) => {
      const name = clip.name;
      if (name.toLowerCase().includes("mixamo") && !activeMixamoActionNames.includes(name)) return;
      max = Math.max(max, clip.duration);
    });
    return max || 1;
  }, [gltf.animations, activeMixamoActionNames]);

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
        if (child.name === "Cube005" || child.name === "Cube.005") {
          child.visible = false;
          return;
        }

        if (/^target\d+/.test(child.name)) {
          const targetCfg = CALLOUT_TARGETS.find((t) => t.id === child.name);
          const shouldShow = targetCfg?.meshVisible === true;
          child.visible = shouldShow;
          if (!shouldShow) return;
        }

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
            child.visible = true;
            child.frustumCulled = false;
            simonBodypart.push(child);
          } else {
            simonGlow.push(child);
            child.visible = false;
            child.frustumCulled = false;
          }
          return;
        }

        if (config.hasParticleTarget) {
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
        child.visible = true;
      }
    });

    return { cityMeshes: city, targetMeshes: target, simonGlowMeshes: simonGlow, simonBodypartMeshes: simonBodypart, floorMeshes: floor };
  }, [gltf, config.hasParticleTarget, sceneIndex]);

  // Patch GLB materials with single-source atmospheric GPU fog
  useEffect(() => {
    const allMeshes = [...cityMeshes, ...targetMeshes, ...simonBodypartMeshes];
    allMeshes.forEach((mesh) => {
      if (mesh && mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => patchMaterialWithAtmosphere(m));
      }
    });
  }, [cityMeshes, targetMeshes, simonBodypartMeshes]);

  useEffect(() => {
    const defaultSkinMat = new THREE.MeshStandardMaterial({
      color: 0xdadada,
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    });
    patchMaterialWithAtmosphere(defaultSkinMat);

    simonBodypartMeshes.forEach((mesh) => {
      mesh.material = defaultSkinMat.clone();
    });
  }, [simonBodypartMeshes]);

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
            2000
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
      cam.far = 2000.0;
      cam.aspect = size.width / size.height;
      baseFovRef.current = cam.fov;
      cam.updateProjectionMatrix();
      cameraReadyRef.current = true;
      onCameraReady(cam);
    }
  }, [gltf, size, sceneIndex, onCameraReady]);

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

  useFrame((state) => {
    const glUserData = (state.gl as any).userData || {};
    const activeSceneIndex = glUserData.activeSceneIndex ?? 0;
    const incomingSceneIndex = glUserData.incomingSceneIndex ?? -1;

    const isVisible = (sceneIndex === activeSceneIndex) || (sceneIndex === incomingSceneIndex);

    if (groupRef.current) {
      groupRef.current.visible = isVisible;
    }

    if (!isVisible) return;

    const scrollNorms: number[] = glUserData.sceneScrollNorms || [];
    const scrollNorm = scrollNorms[sceneIndex] ?? 0.0;
    const globalTime = scrollNorm * maxDuration;

    Object.keys(actions).forEach((name) => {
      if (name.toLowerCase().includes("mixamo") && !activeMixamoActionNames.includes(name)) return;
      const action = actions[name];
      if (action) {
        const clip = gltf.animations.find((c) => c.name === name);
        const duration = clip ? clip.duration : 1.0;

        const isCamera = name.toLowerCase().includes("camera");
        const timelineOffset = -BLENDER_START_FRAME / 30;
        const evalTime = isCamera ? globalTime : (globalTime - timelineOffset);

        action.time = Math.min(Math.max(0, evalTime), duration);
      }
    });

    if (mixer) mixer.update(0);

    if (cameraReadyRef.current) {
      const DESIGN_ASPECT = 16 / 9;
      const currentAspect = size.width / size.height;

      gltf.scene.traverse((child) => {
        if ((child as any).isPerspectiveCamera) {
          const cam = child as THREE.PerspectiveCamera;
          cam.aspect = currentAspect;

          if (baseFovRef.current > 0) {
            cam.fov = baseFovRef.current;
          }

          if (currentAspect < DESIGN_ASPECT) {
            cam.zoom = Math.max(0.5, currentAspect / DESIGN_ASPECT);
          } else {
            cam.zoom = 1;
          }

          cam.updateProjectionMatrix();
        }
      });
    }
  }, -2);

  return (
    <group ref={groupRef}>
      <primitive object={gltf.scene} visible={true} />
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

      <TargetOverlayBridge scene={gltf.scene} />
      <InteractiveSceneParticleSystem position={[1047.551, 398.157, 2.997]} />
    </group>
  );
};
