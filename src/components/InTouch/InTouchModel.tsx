"use client";

import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAtmosphere } from "@/lib/atmosphere";
import { Model as InTouchGeneratedModel } from "./InTouchModelGenerated";

interface InTouchModelProps {
  hand1PosRef?: React.MutableRefObject<THREE.Vector3 | null>;
  hand2PosRef?: React.MutableRefObject<THREE.Vector3 | null>;
  /**
   * If true, keeps original textures and materials exported from Blender / GLB.
   * If false (default), applies the cinematic deep dark crimson silhouette material.
   */
  useOriginalMaterials?: boolean;
  cameraRef?: React.Ref<THREE.PerspectiveCamera>;
  /**
   * If true (default), enables subtle procedural mouse hover tracking across subject body and head.
   */
  enableMouseTracking?: boolean;
}

interface InTouchMouseProceduralRigProps {
  subjectGroupRef: React.RefObject<THREE.Group | null>;
  headBoneRef: React.RefObject<THREE.Bone | null>;
  neckBoneRef: React.RefObject<THREE.Bone | null>;
  spine2BoneRef: React.RefObject<THREE.Bone | null>;
  spineBoneRef: React.RefObject<THREE.Bone | null>;
  rightHandBoneRef: React.RefObject<THREE.Bone | null>;
  leftHandBoneRef: React.RefObject<THREE.Bone | null>;
  hand1PosRef?: React.MutableRefObject<THREE.Vector3 | null>;
  hand2PosRef?: React.MutableRefObject<THREE.Vector3 | null>;
  enabled?: boolean;
}

/**
 * Procedural mouse interaction rig executed strictly after mixer.update.
 * Blends smooth full-body weight shift, spinal lean, and neck/head gaze tracking
 * additively on top of the running Mixamo animation without keyframe collisions.
 */
const InTouchMouseProceduralRig: React.FC<InTouchMouseProceduralRigProps> = ({
  subjectGroupRef,
  headBoneRef,
  neckBoneRef,
  spine2BoneRef,
  spineBoneRef,
  rightHandBoneRef,
  leftHandBoneRef,
  hand1PosRef,
  hand2PosRef,
  enabled = true,
}) => {
  // Damped pointer coordinates for natural muscle lag
  const smoothedPointer = useRef(new THREE.Vector2(0, 0));
  const smoothedSway = useRef(new THREE.Vector2(0, 0));

  // Pre-allocated zero-allocation math buffers
  const tempV1 = useMemo(() => new THREE.Vector3(), []);
  const tempV2 = useMemo(() => new THREE.Vector3(), []);
  const tempEuler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  const tempQuat = useMemo(() => new THREE.Quaternion(), []);
  const baseSubjectQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
    []
  );
  const swayQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state, delta) => {
    // 1. Maintain contact tracking for frosted glass wall
    if (rightHandBoneRef.current && hand1PosRef) {
      rightHandBoneRef.current.getWorldPosition(tempV1);
      if (!hand1PosRef.current) hand1PosRef.current = new THREE.Vector3();
      hand1PosRef.current.copy(tempV1);
    }

    if (leftHandBoneRef.current && hand2PosRef) {
      leftHandBoneRef.current.getWorldPosition(tempV2);
      if (!hand2PosRef.current) hand2PosRef.current = new THREE.Vector3();
      hand2PosRef.current.copy(tempV2);
    }

    if (!enabled) return;

    // Clamp delta to protect against tab defocus frame spikes
    const safeDelta = Math.min(delta, 0.1);

    // Read normalized device coordinates [-1 to +1] from R3F pointer
    const targetX = THREE.MathUtils.clamp(state.pointer.x, -1.2, 1.2);
    const targetY = THREE.MathUtils.clamp(state.pointer.y, -1.2, 1.2);

    // Head / gaze leads with faster response
    smoothedPointer.current.x = THREE.MathUtils.damp(
      smoothedPointer.current.x,
      targetX,
      3.8,
      safeDelta
    );
    smoothedPointer.current.y = THREE.MathUtils.damp(
      smoothedPointer.current.y,
      targetY,
      3.8,
      safeDelta
    );

    // Body weight / posture follows with heavier, slightly delayed damping
    smoothedSway.current.x = THREE.MathUtils.damp(
      smoothedSway.current.x,
      targetX,
      2.6,
      safeDelta
    );
    smoothedSway.current.y = THREE.MathUtils.damp(
      smoothedSway.current.y,
      targetY,
      2.6,
      safeDelta
    );

    const px = smoothedPointer.current.x;
    const py = smoothedPointer.current.y;
    const sx = smoothedSway.current.x;
    const sy = smoothedSway.current.y;

    // 2. Character Full-Body Sway (subject group)
    if (subjectGroupRef.current) {
      const subject = subjectGroupRef.current;
      subject.position.x = sx * 0.07;
      subject.position.y = sy * 0.02;
      subject.position.z = sy * 0.04;

      // Subtle full-body posture rotation in world space
      const subPitch = -sy * 0.025;
      const subYaw = sx * 0.045;
      const subRoll = -sx * 0.025;
      tempEuler.set(subPitch, subYaw, subRoll, "YXZ");
      swayQuat.setFromEuler(tempEuler);
      subject.quaternion.copy(baseSubjectQuat).premultiply(swayQuat);
    }

    // 3. Additive Kinematic Bone Chain
    // Mixamo local coordinates: +Y is up along bone, +Z is forward, +X is character's left (viewer's right)
    const applyAdditiveRotation = (
      bone: THREE.Bone | null,
      yawWeight: number,
      pitchWeight: number,
      rollWeight: number
    ) => {
      if (!bone) return;
      const yaw = px * yawWeight;
      const pitch = -py * pitchWeight;
      const roll = -px * rollWeight;
      tempEuler.set(pitch, yaw, roll, "YXZ");
      tempQuat.setFromEuler(tempEuler);
      bone.quaternion.multiply(tempQuat);
    };

    // Distributed look-at and spinal lean
    applyAdditiveRotation(spineBoneRef.current, 0.06, 0.04, 0.02);   // Lower torso lean
    applyAdditiveRotation(spine2BoneRef.current, 0.12, 0.08, 0.04);  // Chest & ribcage
    applyAdditiveRotation(neckBoneRef.current, 0.20, 0.14, 0.06);    // Neck
    applyAdditiveRotation(headBoneRef.current, 0.36, 0.26, 0.10);    // Head primary gaze
  });

  return null;
};

export const InTouchModel: React.FC<InTouchModelProps> = ({
  hand1PosRef,
  hand2PosRef,
  useOriginalMaterials = false,
  cameraRef,
  enableMouseTracking = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const zenithColor = useAtmosphere((s) => s.zenithColor);

  // References to skeletal hierarchy and subject group
  const subjectGroupRef = useRef<THREE.Group | null>(null);
  const spineBoneRef = useRef<THREE.Bone | null>(null);
  const spine2BoneRef = useRef<THREE.Bone | null>(null);
  const neckBoneRef = useRef<THREE.Bone | null>(null);
  const headBoneRef = useRef<THREE.Bone | null>(null);
  const rightHandBoneRef = useRef<THREE.Bone | null>(null);
  const leftHandBoneRef = useRef<THREE.Bone | null>(null);

  // Deep dark silhouette material with subtle crimson rim scattering and surface depth
  const silhouetteMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#180407"),
      roughness: 0.68,
      metalness: 0.18,
      emissive: new THREE.Color("#2a0006"),
      emissiveIntensity: 0.22,
      side: THREE.DoubleSide,
    });
  }, []);

  // Update silhouette material emissive tone when atmosphere changes
  useEffect(() => {
    silhouetteMaterial.emissive.set(zenithColor).lerp(new THREE.Color("#000000"), 0.85);
  }, [silhouetteMaterial, zenithColor]);

  // Extract bones and nodes once generated model is mounted
  const handleLoaded = useCallback(
    (data: { nodes: any }) => {
      const nodes = data.nodes || {};
      const hips = nodes.mixamorigHips;
      if (hips) {
        hips.traverse((child: any) => {
          if (child.isBone) {
            const name = child.name.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (name.includes("head") && !name.includes("top")) {
              headBoneRef.current = child as THREE.Bone;
            } else if (name.includes("neck")) {
              neckBoneRef.current = child as THREE.Bone;
            } else if (name.includes("spine2")) {
              spine2BoneRef.current = child as THREE.Bone;
            } else if (name.endsWith("spine")) {
              spineBoneRef.current = child as THREE.Bone;
            } else if (name.endsWith("righthand")) {
              rightHandBoneRef.current = child as THREE.Bone;
            } else if (name.endsWith("lefthand")) {
              leftHandBoneRef.current = child as THREE.Bone;
            }
          }
        });
      }

      if (nodes.subject && !subjectGroupRef.current) {
        subjectGroupRef.current = nodes.subject;
      } else if (groupRef.current && !subjectGroupRef.current) {
        groupRef.current.traverse((child: any) => {
          if (child.name === "subject" && !subjectGroupRef.current) {
            subjectGroupRef.current = child as THREE.Group;
          }
        });
      }

      if (!useOriginalMaterials && groupRef.current) {
        groupRef.current.traverse((child: any) => {
          if (child.isMesh) {
            child.material = silhouetteMaterial;
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
          }
        });
      }
    },
    [useOriginalMaterials, silhouetteMaterial]
  );

  return (
    <group ref={groupRef} dispose={null}>
      <InTouchGeneratedModel
        subjectRef={subjectGroupRef}
        customMaterial={useOriginalMaterials ? null : silhouetteMaterial}
        onLoaded={handleLoaded}
        autoPlayAnimation={true}
        cameraRef={cameraRef}
      />
      <InTouchMouseProceduralRig
        subjectGroupRef={subjectGroupRef}
        headBoneRef={headBoneRef}
        neckBoneRef={neckBoneRef}
        spine2BoneRef={spine2BoneRef}
        spineBoneRef={spineBoneRef}
        rightHandBoneRef={rightHandBoneRef}
        leftHandBoneRef={leftHandBoneRef}
        hand1PosRef={hand1PosRef}
        hand2PosRef={hand2PosRef}
        enabled={enableMouseTracking}
      />
    </group>
  );
};
