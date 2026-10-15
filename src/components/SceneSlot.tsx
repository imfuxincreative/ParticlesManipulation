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
import { applyEdgeFadeX } from "@/lib/patchEdgeFade";

// Desert mesh: fade opacity to 0 along its local +X edge
const DESERT_FADE_FRACTION = 0.3; // portion of the desert width used for the fade (0..1)
const isDesertMesh = (obj: THREE.Object3D) =>
  obj.name.toLowerCase().startsWith("desert") ||
  (!!obj.parent && obj.parent.name.toLowerCase().startsWith("desert"));

const CAMERA_NAME = "Camera";
const TARGET_NAME = "body";
const BLENDER_START_FRAME = -493;
const BLENDER_FPS = 30;

// Frame-gated groups (GLTFLoader strips '.' from names, so "Skycity.001" -> "Skycity001")
const SKYCITY_SHOW_FRAME = 5057; // Skycity.001 renders from this Blender frame onwards
const SKYCITY_NAMES = ["Skycity.001", "Skycity001"];
const GROUNDCITY_NAMES = ["groundCity", "groundcity", "GroundCity"]; // hidden from SKYCITY_SHOW_FRAME onwards

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

  // Resolve frame-gated groups once (no per-frame traversal). Missing groups are simply ignored.
  const { skycityNodes, groundCityNodes } = useMemo(() => {
    const find = (names: string[]) => {
      const found: THREE.Object3D[] = [];
      gltf.scene.traverse((o) => {
        if (names.includes(o.name)) found.push(o);
      });
      return found;
    };
    const sky = find(SKYCITY_NAMES);
    const ground = find(GROUNDCITY_NAMES);
    // Start hidden so Skycity never flashes before the first frame update
    sky.forEach((o) => (o.visible = false));
    return { skycityNodes: sky, groundCityNodes: ground };
  }, [gltf.scene]);

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

  // --- PERF: Only register actions for animations we actually use ---
  // With 3466 animations in the GLB, registering ALL of them causes
  // mixer.update() to evaluate thousands of dead tracks per frame.
  // Instead, build a whitelist and only create clipActions for those.
  const { actions, relevantClips, clipDurationMap } = useMemo(() => {
    const activeMixamoSet = new Set(activeMixamoActionNames);
    const act: Record<string, THREE.AnimationAction> = {};
    const relevant: THREE.AnimationClip[] = [];
    const durMap = new Map<string, number>();

    gltf.animations.forEach((clip) => {
      const nameLower = clip.name.toLowerCase();
      const isMixamo = nameLower.includes("mixamo");

      // Skip inactive mixamo clips
      if (isMixamo && !activeMixamoSet.has(clip.name)) return;

      // Keep: camera clips, active mixamo, and all other non-mixamo clips
      act[clip.name] = mixer.clipAction(clip);
      relevant.push(clip);
      durMap.set(clip.name, clip.duration);
    });

    return { actions: act, relevantClips: relevant, clipDurationMap: durMap };
  }, [gltf.animations, mixer, activeMixamoActionNames]);

  const maxDuration = useMemo(() => {
    let max = 0;
    relevantClips.forEach((clip) => {
      max = Math.max(max, clip.duration);
    });
    return max || 1;
  }, [relevantClips]);

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
        if (child.geometry && !child.geometry.boundingSphere) {
          child.geometry.computeBoundingSphere();
        }

        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            m.side = THREE.DoubleSide;
          });
        }

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

        const SIMON_EXACT_NAMES = new Set([
          "simon",
          "simon.001",
          "bodypart",
          "bodypart2",
          "shirt2",
          "shirt2.001",
          "tshirt",
          "pant",
          "pant2",
          "shoe2",
          "sneaker",
          "hair",
          "hair.001",
          "hair2",
          "hair2.001",
          "hair2.002",
          "glass",
          "glass.001",
        ]);

        const childName = child.name ? child.name.toLowerCase() : "";

        let isSimon = SIMON_EXACT_NAMES.has(childName);
        if (!isSimon) {
          let sNode: THREE.Object3D | null = child.parent;
          while (sNode) {
            const pName = sNode.name ? sNode.name.toLowerCase() : "";
            if (pName === "simon" || pName === "simon.001" || pName === "armature" || pName === "armature.001") {
              isSimon = true;
              break;
            }
            sNode = sNode.parent;
          }
        }

        if (isSimon) {
          const isBodypart = childName === "bodypart" || childName === "bodypart2";

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

  // Patch GLB materials with single-source atmospheric GPU fog and ensure double-sided rendering
  useEffect(() => {
    const allMeshes = [...cityMeshes, ...targetMeshes, ...simonBodypartMeshes];
    allMeshes.forEach((mesh) => {
      if (mesh) {
        if (mesh.material && isDesertMesh(mesh)) {
          applyEdgeFadeX(mesh, { fadeFraction: DESERT_FADE_FRACTION, smooth: true });
        }
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            m.side = THREE.DoubleSide;
            patchMaterialWithAtmosphere(m);
          });
        }
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

  // --- PERF: Pre-compute the list of action names to iterate in the frame loop ---
  // Avoids per-frame .toLowerCase() and .includes() string operations on 3466 names.
  const actionNamesToAnimate = useMemo(() => Object.keys(actions), [actions]);

  // Pre-compute camera action flags to avoid per-frame string checks
  const cameraActionFlags = useMemo(() => {
    const flags = new Map<string, boolean>();
    actionNamesToAnimate.forEach((name) => {
      flags.set(name, name.toLowerCase().includes("camera"));
    });
    return flags;
  }, [actionNamesToAnimate]);

  useEffect(() => {
    // All actions in `actions` are already filtered to only relevant ones
    Object.values(actions).forEach((action) => {
      if (action) {
        action.play();
        action.paused = true;
      }
    });
  }, [actions]);

  // --- PERF: Cache the camera reference once instead of traversing 9500 nodes per frame ---
  const sceneCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const lastAspectRef = useRef<number>(0);

  useEffect(() => {
    let cam: THREE.PerspectiveCamera | null = null;
    gltf.scene.traverse((child) => {
      if ((child as any).isPerspectiveCamera) {
        cam = child as THREE.PerspectiveCamera;
      }
    });
    sceneCameraRef.current = cam;
  }, [gltf.scene]);

  // Pre-compute constant timeline offset outside the frame loop
  const TIMELINE_OFFSET = -BLENDER_START_FRAME / 30;

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

    // --- PERF: Iterate only the pre-filtered action names (not all 3466) ---
    // Duration is looked up via O(1) Map instead of O(N) .find() per action.
    // Camera flag is pre-computed to avoid per-frame .toLowerCase().includes().
    const names = actionNamesToAnimate;
    for (let i = 0, len = names.length; i < len; i++) {
      const name = names[i];
      const action = actions[name];
      if (action) {
        const duration = clipDurationMap.get(name) || 1.0;
        const isCamera = cameraActionFlags.get(name) || false;
        const evalTime = isCamera ? globalTime : (globalTime - TIMELINE_OFFSET);

        action.time = Math.min(Math.max(0, evalTime), duration);
      }
    }

    mixer.update(0);

    // Current Blender frame (camera clip starts at BLENDER_START_FRAME)
    const currentFrame = globalTime * BLENDER_FPS + BLENDER_START_FRAME;
    const showSkycity = currentFrame >= SKYCITY_SHOW_FRAME;
    for (let i = 0; i < skycityNodes.length; i++) {
      if (skycityNodes[i].visible !== showSkycity) skycityNodes[i].visible = showSkycity;
    }
    for (let i = 0; i < groundCityNodes.length; i++) {
      if (groundCityNodes[i].visible === showSkycity) groundCityNodes[i].visible = !showSkycity;
    }

    // --- PERF: Update camera only when aspect ratio actually changes ---
    // Previously traversed the entire 9500-node scene graph every frame.
    if (cameraReadyRef.current && sceneCameraRef.current) {
      const currentAspect = size.width / size.height;

      if (Math.abs(currentAspect - lastAspectRef.current) > 0.001) {
        lastAspectRef.current = currentAspect;
        const DESIGN_ASPECT = 16 / 9;
        const cam = sceneCameraRef.current;
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
