"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, useScroll } from "@react-three/drei";
import * as THREE from "three";
import { CityParticleSystem } from "./CityParticleSystem";
import { ModelParticleSystem } from "./ModelParticleSystem";

const SCENE_PATH = "/sceene.glb";
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
  const { set, camera: defaultCamera } = useThree();
  const scrollData = useScroll();

  // Animation mixer setup
  const groupRef = useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(gltf.animations, groupRef);

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
          child.visible = false; // Hide original solid mesh so only particles show
        } else {
          city.push(child);
        }
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
      gltf.scene.traverse((child) => {
        if (child.name === CAMERA_NAME) {
          // Create a perspective camera matching the GLB camera spec
          const cam = new THREE.PerspectiveCamera(
            0.39959652046304894 * (180 / Math.PI), // yfov to degrees
            1.7777777777777777,
            0.1,
            1000
          );
          // Attach cam as child of the node so animations drive it
          // It will inherit the node's transform automatically
          cam.position.set(0, 0, 0);
          cam.quaternion.identity();
          cam.scale.set(1, 1, 1);
          child.add(cam);
          sceneCamera = cam;
        }
      });
    }

    if (sceneCamera) {
      sceneCameraRef.current = sceneCamera;
      // Make the scene camera the active R3F camera
      set({ camera: sceneCamera });
      console.log("[SceneModel] Scene camera activated");
    } else {
      console.warn("[SceneModel] No camera found in scene!");
    }
  }, [gltf, set]);

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

    // Also set up body animation if it exists
    const bodyActionName = Object.keys(actions).find(
      (name) => !name.toLowerCase().includes("camera")
    );

    if (bodyActionName && actions[bodyActionName]) {
      const action = actions[bodyActionName];
      action.play();
      action.paused = true;
      console.log(`[SceneModel] Body animation "${bodyActionName}" ready, duration: ${action.getClip().duration}s`);
    }
  }, [actions]);

  // Drive animations from scroll offset every frame
  useFrame(() => {
    if (!scrollData || !mixer) return;

    const t = scrollData.offset; // 0..1

    // Drive camera animation with scroll
    const cameraActionName = Object.keys(actions).find(
      (name) => name.toLowerCase().includes("camera")
    );
    if (cameraActionName && actions[cameraActionName]) {
      const action = actions[cameraActionName];
      const clip = action.getClip();
      action.time = t * clip.duration;
    }

    // Drive body animation with scroll too
    const bodyActionName = Object.keys(actions).find(
      (name) => !name.toLowerCase().includes("camera")
    );
    if (bodyActionName && actions[bodyActionName]) {
      const action = actions[bodyActionName];
      const clip = action.getClip();
      action.time = t * clip.duration;
    }

    // Force the mixer to update (since actions are paused, we need to manually tick)
    mixer.update(0);

    // Sync the scene camera's world matrix to R3F
    if (sceneCameraRef.current) {
      sceneCameraRef.current.updateMatrixWorld(true);
      sceneCameraRef.current.updateProjectionMatrix();
    }
  });

  return (
    <>
      <group ref={groupRef}>
        {/* Embed the GLTF scene (visible so we can see the normal city) */}
        <primitive object={gltf.scene} visible={true} />

        {/* City rendered as static particles (Disabled for now) */}
        {/* <CityParticleSystem meshes={cityMeshes} /> */}
      </group>

      {/* Target rendered with interactive particle system */}
      {targetMeshes.length > 0 && (
        <ModelParticleSystem meshes={targetMeshes} targetNode={targetMeshes[0]} />
      )}
    </>
  );
};

useGLTF.preload(SCENE_PATH);
