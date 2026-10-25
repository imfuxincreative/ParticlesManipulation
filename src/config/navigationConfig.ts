/**
 * Navigation & Camera Optics Configuration for Particles
 * 
 * Provides centralized section checkpoints, URL slug routing,
 * and keyframed lens focal length (in mm) conversion to degrees FOV.
 */

export const BLENDER_START_FRAME = -493
export const BLENDER_LAST_FRAME = 8871
export const BLENDER_FPS = 30
export const TOTAL_BLENDER_FRAMES = BLENDER_LAST_FRAME - BLENDER_START_FRAME // 9364

export interface SnapRange {
  start: number
  end: number
  speed?: number // Optional speed factor: e.g. 0.35 for 35% speed (slower)
  transitionFrames?: number // Easing buffer frames (default: 45)
}

export interface SpeedRange {
  start: number
  end: number
  speed: number // 1.0 = normal speed, 0.35 = 35% speed (slower, more scroll distance per frame)
  transitionFrames?: number // Smooth transition ramp in/out frames (default: 45)
}

// Configurable scroll speed ranges (smoothly decelerates into these sections)
export const SCROLL_SPEED_RANGES: SpeedRange[] = [
  { start: 522, end: 1857, speed: 0.15, transitionFrames: 50 },
  // { start: 1464, end: 1857, speed: 0.15, transitionFrames: 50 },
]

// Centralized navigation checkpoints & magnetic snapping ranges (in Blender frame numbers)
export const SNAP_RANGES: SnapRange[] = [
  { start: -493, end: 0 },
  { start: 720, end: 1212 },
  { start: 1212, end: 1464 },
  { start: 1464, end: 1721 },

  { start: 1857, end: 2493 },

  { start: 3846, end: 5075 },
  { start: 5133, end: 5744 },
  { start: 5744, end: 6297 },
  { start: 6297, end: 7435 },
  { start: 7435, end: 8700 },
  // { start: 3613, end: 3846 },
  { start: 4057, end: 4561 },
]

// Helper to gather all configured speed ranges from SCROLL_SPEED_RANGES + SNAP_RANGES
export function getActiveSpeedRanges(): SpeedRange[] {
  const merged: SpeedRange[] = [...SCROLL_SPEED_RANGES]
  for (const snap of SNAP_RANGES) {
    if (typeof snap.speed === "number" && snap.speed > 0) {
      merged.push({
        start: snap.start,
        end: snap.end,
        speed: snap.speed,
        transitionFrames: snap.transitionFrames ?? 45,
      })
    }
  }
  return merged
}

/**
 * Calculates instantaneous scroll speed factor for a given frame.
 * Uses Hermite smoothstep for zero-jerk, C1 continuous entry & exit ramps.
 * Returns a value in (0.05, 1.0], where 1.0 is full speed and 0.35 is slower motion.
 */
export function getScrollSpeedAtFrame(frame: number): number {
  const ranges = getActiveSpeedRanges()
  let minSpeed = 1.0

  for (const range of ranges) {
    const pad = Math.max(1, range.transitionFrames ?? 45)
    const outerStart = range.start - pad
    const outerEnd = range.end + pad

    if (frame < outerStart || frame > outerEnd) {
      continue
    }

    let rangeSpeed = 1.0
    if (frame >= range.start && frame <= range.end) {
      // Inside core slow range
      rangeSpeed = range.speed
    } else if (frame >= outerStart && frame < range.start) {
      // Smooth deceleration ramp: 1.0 down to range.speed
      const t = (frame - outerStart) / pad
      const smoothT = t * t * (3 - 2 * t) // Hermite smoothstep
      rangeSpeed = 1.0 + (range.speed - 1.0) * smoothT
    } else if (frame > range.end && frame <= outerEnd) {
      // Smooth acceleration ramp: range.speed up to 1.0
      const t = (frame - range.end) / pad
      const smoothT = t * t * (3 - 2 * t) // Hermite smoothstep
      rangeSpeed = range.speed + (1.0 - range.speed) * smoothT
    }

    if (rangeSpeed < minSpeed) {
      minSpeed = rangeSpeed
    }
  }

  return Math.max(0.05, minSpeed)
}

// Precomputed Cumulative Scroll Weight LUT
const LUT_START_FRAME = BLENDER_START_FRAME
const LUT_END_FRAME = BLENDER_LAST_FRAME
const LUT_SIZE = LUT_END_FRAME - LUT_START_FRAME + 1 // 9365 frames

let cumulativeWeight: Float64Array | null = null
let totalVirtualWeight = 1.0

function initScrollLUT() {
  if (cumulativeWeight) return
  cumulativeWeight = new Float64Array(LUT_SIZE)
  cumulativeWeight[0] = 0

  for (let i = 1; i < LUT_SIZE; i++) {
    const frame = LUT_START_FRAME + i
    const speed = getScrollSpeedAtFrame(frame)
    // Slower speed = higher weight = more physical scroll distance allocated to this frame
    const weight = 1.0 / speed
    cumulativeWeight[i] = cumulativeWeight[i - 1] + weight
  }
  totalVirtualWeight = cumulativeWeight[LUT_SIZE - 1] || 1.0
}

export function invalidateScrollLUT() {
  cumulativeWeight = null
  initScrollLUT()
}

/**
 * Maps Blender animation frame number to normalized scroll offset [0.0, 1.0].
 * O(1) evaluation via cumulative weight LUT.
 */
export function getScrollOffsetFromFrame(frame: number): number {
  initScrollLUT()
  if (frame <= LUT_START_FRAME) return 0.0
  if (frame >= LUT_END_FRAME) return 1.0

  const idxFloat = frame - LUT_START_FRAME
  const idx0 = Math.floor(idxFloat)
  const idx1 = Math.min(LUT_SIZE - 1, idx0 + 1)
  const frac = idxFloat - idx0

  const w0 = cumulativeWeight![idx0]
  const w1 = cumulativeWeight![idx1]
  const w = w0 + (w1 - w0) * frac

  return Math.min(1.0, Math.max(0.0, w / totalVirtualWeight))
}

/**
 * Maps normalized scroll offset [0.0, 1.0] back to exact Blender animation frame number.
 * Continuous monotonic inverse via fast binary search + linear interpolation.
 */
export function getFrameFromScrollOffset(offset: number): number {
  initScrollLUT()
  if (offset <= 0.0) return LUT_START_FRAME
  if (offset >= 1.0) return LUT_END_FRAME

  const targetWeight = offset * totalVirtualWeight

  let low = 0
  let high = LUT_SIZE - 1

  while (low <= high) {
    const mid = (low + high) >> 1
    if (cumulativeWeight![mid] < targetWeight) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  const i0 = Math.max(0, low - 1)
  const i1 = Math.min(LUT_SIZE - 1, low)
  const w0 = cumulativeWeight![i0]
  const w1 = cumulativeWeight![i1]

  const frac = w1 > w0 ? (targetWeight - w0) / (w1 - w0) : 0.0
  const frame = LUT_START_FRAME + i0 + frac * (i1 - i0)

  return Math.min(LUT_END_FRAME, Math.max(LUT_START_FRAME, frame))
}

export const CHECKPOINTS: number[] = Array.from(
  new Set(SNAP_RANGES.flatMap((range) => [range.start, range.end]))
).sort((a, b) => a - b)

export interface SectionConfig {
  name: string
  slug: string
  frame: number
  checkpointIndex: number
  index: number
}

export const SECTIONS: SectionConfig[] = [
  { name: "Home", slug: "home", frame: -493, checkpointIndex: 0, index: 0 },
  { name: "Overview", slug: "overview", frame: 720, checkpointIndex: 2, index: 1 },
  { name: "Showcase", slug: "showcase", frame: 1857, checkpointIndex: 6, index: 2 },
  { name: "Architecture", slug: "architecture", frame: 3216, checkpointIndex: 8, index: 3 },
  { name: "Contact", slug: "contact", frame: 4057, checkpointIndex: 10, index: 4 },
]

export const SLUG_ALIASES: Record<string, number> = {
  home: 0,
  main: 0,
  start: 0,
  overview: 1,
  about: 1,
  intro: 1,
  showcase: 2,
  projects: 2,
  work: 2,
  architecture: 3,
  design: 3,
  city: 3,
  contact: 4,
  connect: 4,
  hire: 4,
  email: 4,
}

export function getSectionIndexFromHash(hash: string): number | null {
  if (!hash) return null
  const clean = hash.replace(/^#\/?/, "").toLowerCase().trim()
  if (clean in SLUG_ALIASES) {
    return SLUG_ALIASES[clean]
  }
  return null
}

export interface FocalLengthKeyframe {
  frame: number
  focalLength: number // in mm
}

export const FOCAL_LENGTH_KEYFRAMES: FocalLengthKeyframe[] = [
  { frame: -493, focalLength: 30 },
  { frame: 0, focalLength: 30 },
  { frame: 720, focalLength: 20 },
  { frame: 1212, focalLength: 20 },
  { frame: 1464, focalLength: 25 },
  { frame: 1721, focalLength: 30 },
  { frame: 1857, focalLength: 30 },
  { frame: 2493, focalLength: 30 },
  { frame: 3216, focalLength: 20 },
  { frame: 3846, focalLength: 15 },
  { frame: 4057, focalLength: 15 },
  { frame: 4561, focalLength: 20 },
  { frame: 5075, focalLength: 20 },
  { frame: 5133, focalLength: 20 },
  { frame: 5744, focalLength: 20 },
  { frame: 6297, focalLength: 20 },
  { frame: 7435, focalLength: 20 },
  { frame: 8347, focalLength: 20 },
]

export const MOBILE_FOCAL_LENGTH_KEYFRAMES: FocalLengthKeyframe[] = [
  { frame: -493, focalLength: 28 },
  { frame: 0, focalLength: 28 },
  { frame: 720, focalLength: 64 },
  { frame: 1212, focalLength: 64 },
  { frame: 1464, focalLength: 66 },
  { frame: 1721, focalLength: 68 },
  { frame: 1857, focalLength: 68 },
  { frame: 2493, focalLength: 68 },
  { frame: 3216, focalLength: 64 },
  { frame: 3846, focalLength: 44 },
  { frame: 4057, focalLength: 44 },
  { frame: 4561, focalLength: 54 },
  { frame: 5075, focalLength: 54 },
  { frame: 5133, focalLength: 54 },
  { frame: 5744, focalLength: 54 },
  { frame: 6297, focalLength: 54 },
  { frame: 7435, focalLength: 54 },
  { frame: 8347, focalLength: 54 },
]

export function getFocalLengthAtFrame(frame: number, isMobile: boolean = false): number {
  const keyframes = isMobile ? MOBILE_FOCAL_LENGTH_KEYFRAMES : FOCAL_LENGTH_KEYFRAMES
  if (keyframes.length === 0) return isMobile ? 16 : 26
  if (frame <= keyframes[0].frame) return keyframes[0].focalLength
  if (frame >= keyframes[keyframes.length - 1].frame) {
    return keyframes[keyframes.length - 1].focalLength
  }

  for (let i = 0; i < keyframes.length - 1; i++) {
    const k0 = keyframes[i]
    const k1 = keyframes[i + 1]
    if (frame >= k0.frame && frame <= k1.frame) {
      const factor = (frame - k0.frame) / (k1.frame - k0.frame)
      return k0.focalLength + (k1.focalLength - k0.focalLength) * factor
    }
  }

  return isMobile ? 16 : 26
}

export function focalLengthToFov(focalLengthMm: number, sensorHeightMm: number = 24): number {
  return 2 * Math.atan(sensorHeightMm / (2 * focalLengthMm)) * (180 / Math.PI)
}
