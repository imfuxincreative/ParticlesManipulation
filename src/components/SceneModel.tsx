"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, useScroll } from "@react-three/drei";
import * as THREE from "three";
import { CityXRayMeshSystem } from "./CityXRayMeshSystem";
import { ModelParticleSystem } from "./ModelParticleSystem";
import { GridFloor } from "./GridFloor";
import { SkyDome } from "./SkyDome";
import { useSimulation } from "@/context/SimulationContext";

const SCENE_PATH = "/SCENE.glb";
const CITYHALL_PATH = "/cityhall.glb";
const CAMERA_NAME = "Camera";
const TARGET_NAME = "body";

/**
 * SceneModel
 *
 * Orchestrates the entire scene:
 * 1. Loads the GLB scenes (SCENE.glb and cityhall.glb)
 * 2. Extracts cameras and binds their animations to scroll
 * 3. Separates target and city meshes
 * 4. Smoothly wipes between SCENE.glb and cityhall.glb on scroll
 * 5. Controls camera transitions and walkthrough animations based on scroll phases
 */
export const SceneModel: React.FC = () => {
  const gltf = useGLTF(SCENE_PATH);
  const gltf2 = useGLTF(CITYHALL_PATH);
  const { set, size } = useThree();
  const scrollData = useScroll();
  const { settings, updateSetting } = useSimulation();
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Animation mixer setup for SCENE
  const groupRef = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(gltf.animations, groupRef);

  // Animation mixer setup for cityhall
  const group2Ref = useRef<THREE.Group>(null);
  const { actions: actions2, mixer: mixer2 } = useAnimations(gltf2.animations, group2Ref);

  // Find the active mixamo action name (alphabetically highest mixamo action)
  const activeMixamoActionName = useMemo(() => {
    const names = Object.keys(actions);
    const mixamoNames = names.filter((name) => name.toLowerCase().includes("mixamo"));
    if (mixamoNames.length === 0) return "";
    mixamoNames.sort();
    return mixamoNames[mixamoNames.length - 1];
  }, [actions]);

  // Refs for scene cameras
  const sceneCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const hallwayCameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Track the active camera type to avoid redundant set({ camera }) calls
  const activeCameraTypeRef = useRef<"cam1" | "cam2" | "transition">("cam1");

  // Transition camera to interpolate between sceneCamera and hallwayCamera
  const transitionCamera = useMemo(() => {
    return new THREE.PerspectiveCamera(50, size.width / size.height, 0.1, 1000);
  }, [size]);

  // Separate SCENE.glb into camera, target, and city meshes
  const { cityMeshes, targetMeshes } = useMemo(() => {
    const city: THREE.Mesh[] = [];
    const target: THREE.Mesh[] = [];

    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((child) => {
      if (child.name === CAMERA_NAME || child instanceof THREE.Camera) {
        return;
      }

      if (child instanceof THREE.Mesh) {
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
        child.visible = false;
      }
    });

    console.log(`[SceneModel] Separated SCENE: ${city.length} city meshes, ${target.length} target meshes`);
    return { cityMeshes: city, targetMeshes: target };
  }, [gltf]);

  // Separate cityhall.glb city meshes
  const cityhallMeshes = useMemo(() => {
    const meshes: THREE.Mesh[] = [];

    gltf2.scene.updateMatrixWorld(true);
    gltf2.scene.traverse((child) => {
      if (child.name === CAMERA_NAME || child instanceof THREE.Camera) {
        return;
      }

      if (child instanceof THREE.Mesh) {
        meshes.push(child);
        child.visible = false;
      }
    });

    console.log(`[SceneModel] Separated cityhall: ${meshes.length} meshes`);
    return meshes;
  }, [gltf2]);

  // Find and set up the SCENE.glb camera
  useEffect(() => {
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
      let createdCam: THREE.PerspectiveCamera | null = null;
      gltf.scene.traverse((child) => {
        if (child.name === CAMERA_NAME) {
          const cam = new THREE.PerspectiveCamera(
            0.39959652046304894 * (180 / Math.PI),
            size.width / size.height,
            0.1,
            1000
          );
          cam.position.set(0, 0, 0);
          cam.quaternion.identity();
          cam.scale.set(1, 1, 1);
          child.add(cam);
          createdCam = cam;
        }
      });
      sceneCamera = createdCam;
    }

    if (sceneCamera) {
      const activeCam = sceneCamera as THREE.PerspectiveCamera;
      sceneCameraRef.current = activeCam;
      activeCam.aspect = size.width / size.height;
      activeCam.updateProjectionMatrix();
      set({ camera: activeCam });
      activeCameraTypeRef.current = "cam1";
      console.log("[SceneModel] SCENE camera activated");
    }
  }, [gltf, set, size]);

  // Find and set up the cityhall.glb camera
  useEffect(() => {
    let hallwayCamera: THREE.PerspectiveCamera | null = null;

    gltf2.scene.traverse((child) => {
      if (child.name === CAMERA_NAME && (child as any).isCamera) {
        hallwayCamera = child as THREE.PerspectiveCamera;
      }
      if (child.name === CAMERA_NAME) {
        child.children.forEach((c) => {
          if ((c as any).isCamera) {
            hallwayCamera = c as THREE.PerspectiveCamera;
          }
        });
      }
    });

    if (!hallwayCamera) {
      gltf2.scene.traverse((child) => {
        if (child.name === "Camera.001" && (child as any).isCamera) {
          hallwayCamera = child as THREE.PerspectiveCamera;
        }
      });
    }

    if (hallwayCamera) {
      const cam = hallwayCamera as THREE.PerspectiveCamera;
      hallwayCameraRef.current = cam;
      cam.aspect = size.width / size.height;
      cam.updateProjectionMatrix();
      console.log("[SceneModel] Cityhall camera initialized");
    }
  }, [gltf2, size]);

  // Set up camera & body animations for SCENE.glb
  useEffect(() => {
    const cameraActionName = Object.keys(actions).find(
      (name) => name.toLowerCase().includes("camera")
    );

    if (cameraActionName && actions[cameraActionName]) {
      const action = actions[cameraActionName];
      action.play();
      action.paused = true;
    }

    const bodyActionNames = Object.keys(actions).filter(
      (name) => !name.toLowerCase().includes("camera")
    );

    bodyActionNames.forEach((name) => {
      if (name.toLowerCase().includes("mixamo") && name !== activeMixamoActionName) {
        return;
      }
      const action = actions[name];
      if (action) {
        action.play();
        action.paused = true;
      }
    });
  }, [actions, activeMixamoActionName]);

  // Set up camera walkthrough animation for cityhall.glb
  useEffect(() => {
    const cameraActionName = Object.keys(actions2).find(
      (name) => name.toLowerCase().includes("camera")
    );

    if (cameraActionName && actions2[cameraActionName]) {
      const action = actions2[cameraActionName];
      action.play();
      action.paused = true;
      console.log(`[SceneModel] Cityhall camera walkthrough action ready: duration: ${action.getClip().duration}s`);
    }
  }, [actions2]);

  // Drive camera and transitions based on scroll offset
  useFrame((state) => {
    if (!scrollData) return;

    const t = scrollData.offset; // 0..1

    let targetCam: THREE.PerspectiveCamera | null = null;
    let targetType: "cam1" | "cam2" | "transition" = "cam1";

    if (t < 0.45) {
      // --- Phase 1: Scene 1 Camera Fly-in ---
      const cameraNorm = Math.min(t / 0.45, 1.0);
      
      const cameraActionName = Object.keys(actions).find(
        (name) => name.toLowerCase().includes("camera")
      );
      if (cameraActionName && actions[cameraActionName]) {
        const action = actions[cameraActionName];
        action.time = cameraNorm * action.getClip().duration;
      }

      const bodyActionNames = Object.keys(actions).filter(
        (name) => !name.toLowerCase().includes("camera")
      );
      bodyActionNames.forEach((name) => {
        if (name.toLowerCase().includes("mixamo") && name !== activeMixamoActionName) return;
        const action = actions[name];
        if (action) {
          action.time = cameraNorm * action.getClip().duration;
        }
      });

      if (mixer) mixer.update(0);
      targetCam = sceneCameraRef.current;
      targetType = "cam1";
    } else if (t < 0.65) {
      // --- Phase 2: vertical Wipe (Camera smoothly interpolates between Scene 1 and Scene 2) ---
      // Keep Scene 1 camera at its end
      const cameraActionName1 = Object.keys(actions).find(
        (name) => name.toLowerCase().includes("camera")
      );
      if (cameraActionName1 && actions[cameraActionName1]) {
        const action = actions[cameraActionName1];
        action.time = action.getClip().duration;
      }
      if (mixer) mixer.update(0);

      // Keep Scene 2 camera at its start
      const cameraActionName2 = Object.keys(actions2).find(
        (name) => name.toLowerCase().includes("camera")
      );
      if (cameraActionName2 && actions2[cameraActionName2]) {
        const action = actions2[cameraActionName2];
        action.time = 0.0;
      }
      if (mixer2) mixer2.update(0);

      if (sceneCameraRef.current && hallwayCameraRef.current) {
        sceneCameraRef.current.updateMatrixWorld(true);
        hallwayCameraRef.current.updateMatrixWorld(true);

        const pos1 = new THREE.Vector3();
        const quat1 = new THREE.Quaternion();
        sceneCameraRef.current.getWorldPosition(pos1);
        sceneCameraRef.current.getWorldQuaternion(quat1);

        const pos2 = new THREE.Vector3();
        const quat2 = new THREE.Quaternion();
        hallwayCameraRef.current.getWorldPosition(pos2);
        hallwayCameraRef.current.getWorldQuaternion(quat2);

        const progress = (t - 0.45) / 0.20; // 0..1
        transitionCamera.position.lerpVectors(pos1, pos2, progress);
        transitionCamera.quaternion.slerpQuaternions(quat1, quat2, progress);
        transitionCamera.fov = THREE.MathUtils.lerp(
          sceneCameraRef.current.fov,
          hallwayCameraRef.current.fov,
          progress
        );
        transitionCamera.updateProjectionMatrix();

        targetCam = transitionCamera;
        targetType = "transition";
      } else {
        targetCam = sceneCameraRef.current;
        targetType = "cam1";
      }
    } else {
      // --- Phase 3: Scene 2 Walkthrough ---
      const cameraNorm = Math.min((t - 0.65) / 0.35, 1.0);

      const cameraActionName = Object.keys(actions2).find(
        (name) => name.toLowerCase().includes("camera")
      );
      if (cameraActionName && actions2[cameraActionName]) {
        const action = actions2[cameraActionName];
        action.time = cameraNorm * action.getClip().duration;
      }

      if (mixer2) mixer2.update(0);
      targetCam = hallwayCameraRef.current;
      targetType = "cam2";
    }

    // Switch active R3F camera once when crossing thresholds
    if (targetCam && state.camera !== targetCam) {
      set({ camera: targetCam });
      activeCameraTypeRef.current = targetType;
      console.log(`[SceneModel] Switched active camera to: ${targetType}`);
    }

    // Keep aspect ratios and projection matrices up to date
    if (sceneCameraRef.current) {
      sceneCameraRef.current.aspect = size.width / size.height;
      sceneCameraRef.current.updateMatrixWorld(true);
      sceneCameraRef.current.updateProjectionMatrix();
    }
    if (hallwayCameraRef.current) {
      hallwayCameraRef.current.aspect = size.width / size.height;
      hallwayCameraRef.current.updateMatrixWorld(true);
      hallwayCameraRef.current.updateProjectionMatrix();
    }
    if (transitionCamera) {
      transitionCamera.aspect = size.width / size.height;
      transitionCamera.updateProjectionMatrix();
    }

    // Maintain model index 0 during transition
    if (settingsRef.current.currentModelIndex !== 0) {
      updateSetting('currentModelIndex', 0);
    }
  });

  // Calculate bounding box and diagonal projection bounds for SCENE
  const cityProjectionBounds = useMemo(() => {
    if (cityMeshes.length === 0) return { min: -100, max: 100 };

    const wipeDir = new THREE.Vector3(1, 0, 1).normalize();
    const bounds = new THREE.Box3();

    cityMeshes.forEach((mesh) => {
      if (mesh.geometry) {
        if (!mesh.geometry.boundingBox) {
          mesh.geometry.computeBoundingBox();
        }
        if (mesh.geometry.boundingBox) {
          const meshBounds = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
          bounds.union(meshBounds);
        }
      }
    });

    const corners = [
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
    ];

    let minProj = Infinity;
    let maxProj = -Infinity;
    corners.forEach((c) => {
      const proj = c.dot(wipeDir);
      minProj = Math.min(minProj, proj);
      maxProj = Math.max(maxProj, proj);
    });

    return { min: minProj - 5, max: maxProj + 5 };
  }, [cityMeshes]);

  // Calculate bounding box and diagonal projection bounds for cityhall
  const cityhallProjectionBounds = useMemo(() => {
    if (cityhallMeshes.length === 0) return { min: -100, max: 100 };

    const wipeDir = new THREE.Vector3(1, 0, 1).normalize();
    const bounds = new THREE.Box3();

    cityhallMeshes.forEach((mesh) => {
      if (mesh.geometry) {
        if (!mesh.geometry.boundingBox) {
          mesh.geometry.computeBoundingBox();
        }
        if (mesh.geometry.boundingBox) {
          const meshBounds = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
          bounds.union(meshBounds);
        }
      }
    });

    const corners = [
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
    ];

    let minProj = Infinity;
    let maxProj = -Infinity;
    corners.forEach((c) => {
      const proj = c.dot(wipeDir);
      minProj = Math.min(minProj, proj);
      maxProj = Math.max(maxProj, proj);
    });

    return { min: minProj - 5, max: maxProj + 5 };
  }, [cityhallMeshes]);

  return (
    <>
      <group ref={groupRef}>
        {/* Embed SCENE.glb (original meshes hidden, lights/bones intact) */}
        <primitive object={gltf.scene} visible={true} />

        {/* City + Target meshes rendered as holographic X-Ray */}
        {cityMeshes.length > 0 && (
          <CityXRayMeshSystem meshes={cityMeshes} projectionBounds={cityProjectionBounds} isScene2={false} />
        )}
      </group>

      <group ref={group2Ref}>
        {/* Embed cityhall.glb (original meshes hidden, structure/lights intact) */}
        <primitive object={gltf2.scene} visible={true} />

        {/* Cityhall meshes rendered as holographic X-Ray */}
        {cityhallMeshes.length > 0 && (
          <CityXRayMeshSystem meshes={cityhallMeshes} projectionBounds={cityhallProjectionBounds} isScene2={true} />
        )}
      </group>

      {/* Glowing Sky Dome */}
      {settings.showSky && <SkyDome />}

      {/* Grid Floor */}
      {settings.showGridFloor && <GridFloor projectionBounds={cityProjectionBounds} />}

      {/* Target rendered with interactive particle system */}
      {targetMeshes.length > 0 && (
        <ModelParticleSystem meshes={targetMeshes} targetNode={targetMeshes[0]} projectionBounds={cityProjectionBounds} />
      )}
    </>
  );
};

useGLTF.preload(SCENE_PATH);
useGLTF.preload(CITYHALL_PATH);
