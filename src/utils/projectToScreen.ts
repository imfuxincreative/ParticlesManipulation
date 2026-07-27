import * as THREE from "three";

/**
 * Projects a 3D world position to 2D screen-space pixel coordinates.
 *
 * @param worldPos - The 3D position in world space
 * @param camera   - The active THREE.Camera
 * @param size     - Viewport dimensions { width, height }
 * @returns        - Screen-space coordinates { x, y } with origin at top-left,
 *                   or null if the point is behind the camera.
 */
export function projectToScreen(
  worldPos: THREE.Vector3,
  camera: THREE.Camera,
  size: { width: number; height: number }
): { x: number; y: number } | null {
  // Clone to avoid mutating the original vector
  const projected = worldPos.clone().project(camera);

  // Behind the camera — NDC z > 1 means behind the near plane
  if (projected.z > 1) return null;

  // Convert NDC (-1..1) to pixel coordinates (top-left origin)
  const x = (projected.x * 0.5 + 0.5) * size.width;
  const y = (-projected.y * 0.5 + 0.5) * size.height;

  return { x, y };
}
