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
const CAMERA_NAME = "Camera";
const TARGET_NAME = "body";

/**
 * SceneModel
 *
 * Orchestrates the entire scene:
 * 1. Loads the GLB scene (SCENE.glb)
 * 2. Extracts camera and binds its animation to scroll
 * 3. Separates target and city meshes
 * 4. Controls camera walkthrough animation based on scroll
 */
export const SceneModel: React.FC = () => {
  const gltf = useGLTF(SCENE_PATH);
  const { set, size } = useThree();
  const scrollData = useScroll();
  const { settings, updateSetting } = useSimulation();
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Animation mixer setup for SCENE
  const groupRef = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(gltf.animations, groupRef);

  // Find the active mixamo action name (alphabetically highest mixamo action) from gltf.animations.
  // This ensures it is available immediately on the first render, without waiting for the mixer actions to mount.
  const activeMixamoActionName = useMemo(() => {
    const names = gltf.animations.map((clip) => clip.name);
    const mixamoNames = names.filter((name) => name.toLowerCase().includes("mixamo"));
    if (mixamoNames.length === 0) return "";
    mixamoNames.sort();
    return mixamoNames[mixamoNames.length - 1];
  }, [gltf.animations]);

  // Find the maximum duration of the active animations from gltf.animations.
  // This keeps animations synchronized even if they have different clip lengths.
  const maxDuration = useMemo(() => {
    let max = 0;
    const cameraClip = gltf.animations.find((c) => c.name.toLowerCase().includes("camera"));
    if (cameraClip) {
      max = Math.max(max, cameraClip.duration);
    }
    gltf.animations.forEach((clip) => {
      const name = clip.name;
      if (name.toLowerCase().includes("mixamo") && name !== activeMixamoActionName) return;
      if (!name.toLowerCase().includes("camera")) {
        max = Math.max(max, clip.duration);
      }
    });
    return max || 1; // Default to 1 to avoid division by zero
  }, [gltf.animations, activeMixamoActionName]);


  // Refs for scene cameras
  const sceneCameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Track the active camera type to avoid redundant set({ camera }) calls
  const activeCameraTypeRef = useRef<"cam1">("cam1");

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
      activeCam.near = 0.1; // Prevent close objects from being clipped
      activeCam.far = 1000.0; // Ensure nothing far away is clipped
      activeCam.aspect = size.width / size.height;
      activeCam.updateProjectionMatrix();
      set({ camera: activeCam });
      activeCameraTypeRef.current = "cam1";
      console.log("[SceneModel] SCENE camera activated");
    }
  }, [gltf, set, size]);

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

  // Drive camera based on scroll offset
  useFrame((state) => {
    if (!scrollData) return;

    const t = scrollData.offset; // 0..1

    // Drive camera fly-in over the entire scroll range
    const cameraNorm = Math.min(t, 1.0);
    const globalTime = cameraNorm * maxDuration;

    const cameraActionName = Object.keys(actions).find(
      (name) => name.toLowerCase().includes("camera")
    );
    if (cameraActionName && actions[cameraActionName]) {
      const action = actions[cameraActionName];
      const clip = gltf.animations.find((c) => c.name === cameraActionName);
      const duration = clip ? clip.duration : 12.0;
      action.time = Math.min(globalTime, duration);
    }

    const bodyActionNames = Object.keys(actions).filter(
      (name) => !name.toLowerCase().includes("camera")
    );
    bodyActionNames.forEach((name) => {
      if (name.toLowerCase().includes("mixamo") && name !== activeMixamoActionName) return;
      const action = actions[name];
      if (action) {
        const clip = gltf.animations.find((c) => c.name === name);
        const duration = clip ? clip.duration : 1.0;
        action.time = Math.min(globalTime, duration);
      }
    });

    if (mixer) mixer.update(0);

    const targetCam = sceneCameraRef.current;

    // Switch active R3F camera once when crossing thresholds
    if (targetCam && state.camera !== targetCam) {
      set({ camera: targetCam });
      activeCameraTypeRef.current = "cam1";
      console.log(`[SceneModel] Switched active camera to: cam1`);
    }

    // Keep aspect ratios and projection matrices up to date
    if (sceneCameraRef.current) {
      sceneCameraRef.current.aspect = size.width / size.height;
      sceneCameraRef.current.updateMatrixWorld(true);
      sceneCameraRef.current.updateProjectionMatrix();
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
