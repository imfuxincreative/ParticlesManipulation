/**
 * Navigation & Camera Optics Configuration for Particles
 * 
 * Provides centralized section checkpoints, URL slug routing,
 * and keyframed lens focal length (in mm) conversion to degrees FOV.
 */

export interface SnapRange {
  start: number
  end: number
}

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
