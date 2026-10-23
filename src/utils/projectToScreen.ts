import * as THREE from "three";

// Reusable scratch vectors to avoid GC churn in the frame loop
const _camSpacePos = new THREE.Vector3();
const _projected = new THREE.Vector3();

/**
 * Projects a 3D world position to 2D screen-space pixel coordinates.
 *
 * @param worldPos - The 3D position in world space
 * @param camera   - The active THREE.Camera
 * @param size     - Viewport dimensions { width, height }
 * @returns        - Screen-space coordinates { x, y } with origin at top-left,
 *                   or null if the point is behind the camera or off-screen.
 */
export function projectToScreen(
  worldPos: THREE.Vector3,
  camera: THREE.Camera,
  size: { width: number; height: number }
): { x: number; y: number } | null {
  // 1. Transform to camera view space
  _camSpacePos.copy(worldPos).applyMatrix4(camera.matrixWorldInverse);

  // In Three.js camera view space, the camera looks down -Z.
  // Any point with z >= -0.1 is on or behind the camera lens.
  // This prevents points behind the camera from being inverted and floating in the sky.
  if (_camSpacePos.z >= -0.1) {
    return null;
  }

  // 2. Project to Normalized Device Coordinates (-1 to +1)
  _projected.copy(worldPos).project(camera);

  // Check depth bounds (near/far plane)
  if (_projected.z < -1 || _projected.z > 1) {
    return null;
  }

  // Convert NDC (-1..1) to pixel coordinates (top-left origin)
  const x = (_projected.x * 0.5 + 0.5) * size.width;
  const y = (-_projected.y * 0.5 + 0.5) * size.height;

  // Viewport bounds check:
  // If the object has moved far off screen, hide it so callouts don't float detached.
  const margin = 120;
  if (
    x < -margin ||
    x > size.width + margin ||
    y < -margin ||
    y > size.height + margin
  ) {
    return null;
  }

  return { x, y };
}
