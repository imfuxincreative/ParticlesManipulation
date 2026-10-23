"use client";

import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";

interface CarTrafficData {
  car: THREE.Object3D;
  initialPosition: THREE.Vector3;
  initialQuaternion: THREE.Quaternion;
  initialScale: THREE.Vector3;
  direction: THREE.Vector3;
  speedMultiplier: number;
  phase: number;
  distanceTraveled: number;
  hasForwardMarker: boolean;
}

interface FlyingCarsSystemProps {
  scene: THREE.Object3D;
}

// Deterministic hash to give each car an unchanging, fair pseudo-random value [0, 1)
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 10000) / 10000;
}

export const FlyingCarsSystem: React.FC<FlyingCarsSystemProps> = ({ scene }) => {
  const { settings } = useSimulation();
  const carsDataRef = useRef<CarTrafficData[]>([]);

  // Temp vectors to avoid allocating memory in useFrame
  const tempPosRef = useRef(new THREE.Vector3());
  const tempQuatRef = useRef(new THREE.Quaternion());
  const eulerWobbleRef = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const wobbleQuatRef = useRef(new THREE.Quaternion());

  // Discover and initialize all flying cars
  useEffect(() => {
    if (!scene) return;

    scene.updateMatrixWorld(true);

    const detectedCars: THREE.Object3D[] = [];

    // Find all car groups: "flying-car", "flying-car.001", "flying-car001", etc.
    scene.traverse((child) => {
      const name = child.name ? child.name.toLowerCase() : "";
      if (
        name.startsWith("flying-car") ||
        name.startsWith("flying_car") ||
        /^flying[-_]?car/i.test(child.name)
      ) {
        // Ensure we don't accidentally pick up child meshes inside the car (like "flying-car_body")
        if (child instanceof THREE.Group || child.children.length > 0) {
          detectedCars.push(child);
        }
      }
    });

    const carList: CarTrafficData[] = [];
    const carWorldPos = new THREE.Vector3();
    const forwardWorldPos = new THREE.Vector3();

    detectedCars.forEach((car, index) => {
      // Find empty object named "forward" inside this car
      let forwardObj: THREE.Object3D | null = null;
      car.traverse((descendant) => {
        if (
          descendant !== car &&
          descendant.name &&
          descendant.name.toLowerCase().includes("forward")
        ) {
          forwardObj = descendant;
        }
      });

      car.getWorldPosition(carWorldPos);
      const worldDir = new THREE.Vector3();
      let hasForwardMarker = false;

      if (forwardObj) {
        (forwardObj as THREE.Object3D).getWorldPosition(forwardWorldPos);
        worldDir.subVectors(forwardWorldPos, carWorldPos);

        // If the forward empty is placed at a non-zero offset relative to car
        if (worldDir.lengthSq() > 0.0001) {
          worldDir.normalize();
          hasForwardMarker = true;
        } else {
          // If forward empty is at (0,0,0) of car, check its orientation
          (forwardObj as THREE.Object3D).getWorldDirection(worldDir);
          if (worldDir.lengthSq() > 0.0001) {
            worldDir.normalize();
            hasForwardMarker = true;
          }
        }
      }

      // Fallback: If no forward empty was found or position was zero, use car group's heading
      if (!hasForwardMarker) {
        car.getWorldDirection(worldDir);
        if (worldDir.lengthSq() < 0.0001) {
          worldDir.set(0, 0, 1);
        }
      }

      // Convert world direction into parent space (so car.position.addScaledVector moves properly)
      const parentDir = worldDir.clone();
      if (car.parent) {
        const parentRotInverse = car.parent
          .getWorldQuaternion(new THREE.Quaternion())
          .invert();
        parentDir.applyQuaternion(parentRotInverse).normalize();
      }

      // Compute deterministic, fair pseudo-random speed factor in range [1 - variance, 1 + variance]
      const seed = hashString(car.name || `car_${index}`);
      // Variance from settings or fallback default 0.35
      const variance = settings.flyingCarsSpeedVariance ?? 0.35;
      // seed is [0, 1). Center at 0: (seed - 0.5) * 2 is [-1, 1).
      const speedMultiplier = 1.0 + (seed - 0.5) * 2.0 * variance;
      const phase = seed * Math.PI * 2.0;

      carList.push({
        car,
        initialPosition: car.position.clone(),
        initialQuaternion: car.quaternion.clone(),
        initialScale: car.scale.clone(),
        direction: parentDir,
        speedMultiplier,
        phase,
        distanceTraveled: 0,
        hasForwardMarker,
      });
    });

    carsDataRef.current = carList;

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[FlyingCarsSystem] Initialized ${carList.length} flying cars with symmetric screen loop:`,
        carList.map((c) => ({
          name: c.car.name,
          hasForwardMarker: c.hasForwardMarker,
          dir: [
            parseFloat(c.direction.x.toFixed(2)),
            parseFloat(c.direction.y.toFixed(2)),
            parseFloat(c.direction.z.toFixed(2)),
          ],
          speedMultiplier: parseFloat(c.speedMultiplier.toFixed(2)),
        }))
      );
    }
  }, [scene, settings.flyingCarsSpeedVariance]);

  // Expose a global reset function for debug/dashboard
  useEffect(() => {
    (window as any).__resetFlyingCars = () => {
      carsDataRef.current.forEach((data) => {
        data.distanceTraveled = 0;
        data.car.position.copy(data.initialPosition);
        data.car.quaternion.copy(data.initialQuaternion);
        data.car.scale.copy(data.initialScale);
      });
    };
    return () => {
      delete (window as any).__resetFlyingCars;
    };
  }, []);

  useFrame((state, delta) => {
    if (!settings.enableFlyingCars) return;
    const cars = carsDataRef.current;
    if (cars.length === 0) return;

    // Clamp delta to avoid massive leaps on frame drops or background tab resumption
    const dt = Math.min(delta, 0.1);
    const baseSpeed = Math.max(0, settings.flyingCarsBaseSpeed ?? 35);
    const maxDist = Math.max(100, settings.flyingCarsMaxDistance ?? 800);
    const halfSpan = maxDist * 0.5;
    const time = state.clock.getElapsedTime();
    const useBobbing = settings.flyingCarsHoverBobbing ?? true;
    const bobAmp = useBobbing ? (settings.flyingCarsBobbingStrength ?? 0.8) : 0;
    const invertDir = settings.invertFlyingCarsDirection ?? false;

    const tempPos = tempPosRef.current;
    const tempQuat = tempQuatRef.current;
    const eulerWobble = eulerWobbleRef.current;
    const wobbleQuat = wobbleQuatRef.current;

    for (let i = 0, len = cars.length; i < len; i++) {
      const data = cars[i];
      const speed = baseSpeed * data.speedMultiplier;

      // Advance continuous travel distance
      data.distanceTraveled += speed * dt;

      // Symmetrically wrap offset between [-halfSpan, +halfSpan]
      // At distanceTraveled = 0: offset = 0 (exact initial position)
      // As it flies forward (left -> right): offset goes 0 -> +halfSpan (leaves right edge)
      // At +halfSpan: wraps seamlessly to -halfSpan (enters from left edge)
      // Then -halfSpan -> 0 -> +halfSpan seamlessly in an infinite circuit!
      const wrapped = (((data.distanceTraveled + halfSpan) % maxDist) + maxDist) % maxDist;
      const offset = wrapped - halfSpan;

      // Direction vector: Inverted by default so cars fly towards their forward face/hood
      const flip = invertDir ? 1 : -1;
      const dirX = data.direction.x * flip;
      const dirY = data.direction.y * flip;
      const dirZ = data.direction.z * flip;

      tempPos.set(
        data.initialPosition.x + dirX * offset,
        data.initialPosition.y + dirY * offset,
        data.initialPosition.z + dirZ * offset
      );

      // Seamless scale-fade near the extreme boundary edges so cars enter & exit cleanly without popping
      const fadeRegion = halfSpan * 0.12;
      const distFromEdge = halfSpan - Math.abs(offset);
      const scaleFactor = THREE.MathUtils.clamp(distFromEdge / fadeRegion, 0, 1);
      data.car.scale.copy(data.initialScale).multiplyScalar(Math.max(0.001, scaleFactor));

      // Organic hover floating (subtle vertical oscillation)
      if (bobAmp > 0) {
        const bobY = Math.sin(time * 2.2 + data.phase) * bobAmp;
        tempPos.y += bobY;

        // Subtle micro-pitch and roll to simulate anti-gravity vehicle stability
        const microPitch = Math.cos(time * 2.2 + data.phase) * (bobAmp * 0.012);
        const microRoll = Math.sin(time * 1.7 + data.phase) * (bobAmp * 0.018);
        eulerWobble.set(microPitch, 0, microRoll, "YXZ");
        wobbleQuat.setFromEuler(eulerWobble);

        tempQuat.copy(data.initialQuaternion).multiply(wobbleQuat);
        data.car.quaternion.copy(tempQuat);
      } else {
        data.car.quaternion.copy(data.initialQuaternion);
      }

      data.car.position.copy(tempPos);
    }
  });

  return null;
};
