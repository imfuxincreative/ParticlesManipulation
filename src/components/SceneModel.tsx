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
 * 1. Loads the GLB scene
 * 2. Extracts the camera and binds its animation to scroll
 * 3. Separates the target mesh from the city meshes
 * 4. Renders city as a static particle cloud (if enabled)
 * 5. Renders the target with interactive particle system (morphing, glitch, scatter)
 */
export const SceneModel: React.FC = () => {
  const gltf = useGLTF(SCENE_PATH);
  const { set, size } = useThree();
  const scrollData = useScroll();
  const { settings, updateSetting } = useSimulation();
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Animation mixer setup
  const groupRef = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(gltf.animations, groupRef);

  // Find the active mixamo action name (alphabetically highest mixamo action)
  const activeMixamoActionName = useMemo(() => {
    const names = Object.keys(actions);
    const mixamoNames = names.filter((name) => name.toLowerCase().includes("mixamo"));
    if (mixamoNames.length === 0) return "";
    mixamoNames.sort();
    return mixamoNames[mixamoNames.length - 1];
  }, [actions]);

  // Ref for the scene camera object
  const sceneCameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Separate scene into camera, target, and city meshes
  const { cityMeshes, targetMeshes } = useMemo(() => {
    const city: THREE.Mesh[] = [];
    const target: THREE.Mesh[] = [];

    // Ensure world matrices are up to date
    gltf.scene.updateMatrixWorld(true);

    gltf.scene.traverse((child) => {
      // Skip camera nodes
      if (child.name === CAMERA_NAME || child instanceof THREE.Camera) {
        return;
      }

      if (child instanceof THREE.Mesh) {
        // Check if this mesh is the target (or a descendant of the target group)
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
          // Everything else (including michle skinned meshes) is city
          city.push(child);
        }
        child.visible = false; // Hide original; X-ray system will re-show
      }
    });

    console.log(`[SceneModel] Separated scene: ${city.length} city meshes, ${target.length} target meshes`);

    return { cityMeshes: city, targetMeshes: target };
  }, [gltf]);

  // Find and set up the scene camera
  useEffect(() => {
    let sceneCamera: THREE.PerspectiveCamera | null = null;

    gltf.scene.traverse((child) => {
      if (child.name === CAMERA_NAME && (child as any).isCamera) {
        sceneCamera = child as THREE.PerspectiveCamera;
      }
      // Also check children — sometimes the camera is a child of a named node
      if (child.name === CAMERA_NAME) {
        child.children.forEach((c) => {
          if ((c as any).isCamera) {
            sceneCamera = c as THREE.PerspectiveCamera;
          }
        });
      }
    });

    if (!sceneCamera) {
      // If no camera found in scene, try constructing one from the GLTF camera data
      // The camera node exists at index 267 with camera 0
      let createdCam: THREE.PerspectiveCamera | null = null;
      gltf.scene.traverse((child) => {
        if (child.name === CAMERA_NAME) {
          // Create a perspective camera matching the GLB camera spec
          const cam = new THREE.PerspectiveCamera(
            0.39959652046304894 * (180 / Math.PI), // yfov to degrees
            size.width / size.height,
            0.1,
            1000
          );
          // Attach cam as child of the node so animations drive it
          // It will inherit the node's transform automatically
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
      // Make the scene camera the active R3F camera
      set({ camera: activeCam });
      console.log("[SceneModel] Scene camera activated");
    } else {
      console.warn("[SceneModel] No camera found in scene!");
    }
  }, [gltf, set, size]);

  // Set up scroll-driven camera animation
  useEffect(() => {
    // Find the camera action
    const cameraActionName = Object.keys(actions).find(
      (name) => name.toLowerCase().includes("camera")
    );

    if (cameraActionName && actions[cameraActionName]) {
      const action = actions[cameraActionName];
      // Play it but pause — we'll manually control time via scroll
      action.play();
      action.paused = true;
      console.log(`[SceneModel] Camera animation "${cameraActionName}" ready, duration: ${action.getClip().duration}s`);
    }

    // Also set up body animations if they exist (play all non-camera actions)
    const bodyActionNames = Object.keys(actions).filter(
      (name) => !name.toLowerCase().includes("camera")
    );

    bodyActionNames.forEach((name) => {
      // If this is a mixamo action, only play the active one to avoid skeletal blending distortion
      if (name.toLowerCase().includes("mixamo") && name !== activeMixamoActionName) {
        return;
      }
      const action = actions[name];
      if (action) {
        action.play();
        action.paused = true;
        console.log(`[SceneModel] Body animation "${name}" ready, duration: ${action.getClip().duration}s`);
      }
    });
  }, [actions, activeMixamoActionName]);

  // Split scroll: first portion for camera fly-in, rest for model morphing
  const CAMERA_SCROLL_END = 0.2; // Camera completes by 20% scroll (page 1 of 5)

  // Drive animations from scroll offset every frame
  useFrame(() => {
    if (!scrollData || !mixer) return;

    const t = scrollData.offset; // 0..1

    // --- Camera & body animation phase ---
    // Clamp scroll to camera portion, then normalize to 0..1
    const cameraNorm = Math.min(t / CAMERA_SCROLL_END, 1.0);

    // Drive camera animation with clamped scroll
    const cameraActionName = Object.keys(actions).find(
      (name) => name.toLowerCase().includes("camera")
    );
    if (cameraActionName && actions[cameraActionName]) {
      const action = actions[cameraActionName];
      const clip = action.getClip();
      action.time = cameraNorm * clip.duration;
    }

    // Drive body animations with clamped scroll too
    const bodyActionNames = Object.keys(actions).filter(
      (name) => !name.toLowerCase().includes("camera")
    );

    bodyActionNames.forEach((name) => {
      // Only drive the active mixamo animation to avoid conflicts/overhead
      if (name.toLowerCase().includes("mixamo") && name !== activeMixamoActionName) {
        return;
      }
      const action = actions[name];
      if (action) {
        const clip = action.getClip();
        action.time = cameraNorm * clip.duration;
      }
    });

    // Force the mixer to update (since actions are paused, we need to manually tick)
    mixer.update(0);

    // Sync the scene camera's world matrix to R3F
    if (sceneCameraRef.current) {
      sceneCameraRef.current.aspect = size.width / size.height;
      sceneCameraRef.current.updateMatrixWorld(true);
      sceneCameraRef.current.updateProjectionMatrix();
    }

    // --- Model morphing phase (after camera arrives and city fully wipes out) ---
    const MODEL_MORPH_START = 0.5;
    if (t > MODEL_MORPH_START) {
      const morphProgress = (t - MODEL_MORPH_START) / (1.0 - MODEL_MORPH_START); // 0..1
      const numModels = settingsRef.current.models.length;
      const modelIndex = Math.min(
        Math.floor(morphProgress * numModels),
        numModels - 1
      );

      if (modelIndex !== settingsRef.current.currentModelIndex) {
        updateSetting('currentModelIndex', modelIndex);
      }
    } else if (settingsRef.current.currentModelIndex !== 0) {
      // During camera and city wipeout phases, ensure we're showing the first model
      updateSetting('currentModelIndex', 0);
    }
  });

  // Calculate bounding box and diagonal projection bounds for the city
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

    // Add a small safety margin of 5 units on both sides to guarantee full wipe coverage
    return { min: minProj - 5, max: maxProj + 5 };
  }, [cityMeshes]);

  return (
    <>
      <group ref={groupRef}>
        {/* Embed the GLTF scene (lights and structure still intact) */}
        <primitive object={gltf.scene} visible={true} />

        {/* City + michle rendered as holographic X-Ray mesh */}
        {cityMeshes.length > 0 && (
          <CityXRayMeshSystem meshes={cityMeshes} projectionBounds={cityProjectionBounds} />
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
