/**
 * Navigation & Camera Optics Configuration for Particles
 * 
 * Provides centralized section checkpoints, URL slug routing,
 * and keyframed lens focal length (in mm) conversion to degrees FOV.
 */

export interface SectionConfig {
  name: string
  slug: string
  frame: number
  checkpointIndex: number
  index: number
}

export const CHECKPOINTS = [-493, 720, 1212, 1857, 2493, 3116, 3613, 3846, 4057, 4561]

export const SECTIONS: SectionConfig[] = [
  { name: "Home", slug: "home", frame: -493, checkpointIndex: 0, index: 0 },
  { name: "Overview", slug: "overview", frame: 720, checkpointIndex: 1, index: 1 },
  { name: "Showcase", slug: "showcase", frame: 1857, checkpointIndex: 3, index: 2 },
  { name: "Architecture", slug: "architecture", frame: 3116, checkpointIndex: 5, index: 3 },
  { name: "Contact", slug: "contact", frame: 4057, checkpointIndex: 7, index: 4 },
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
  { frame: 720, focalLength: 20 },
  { frame: 1212, focalLength: 20 },
  { frame: 1857, focalLength: 30 },
  { frame: 2493, focalLength: 30 },
  { frame: 3116, focalLength: 20 },
  { frame: 3613, focalLength: 10 },
  { frame: 3846, focalLength: 15 },
  { frame: 4057, focalLength: 15 },
  { frame: 4561, focalLength: 20 },
]

export function getFocalLengthAtFrame(frame: number): number {
  if (FOCAL_LENGTH_KEYFRAMES.length === 0) return 26
  if (frame <= FOCAL_LENGTH_KEYFRAMES[0].frame) return FOCAL_LENGTH_KEYFRAMES[0].focalLength
  if (frame >= FOCAL_LENGTH_KEYFRAMES[FOCAL_LENGTH_KEYFRAMES.length - 1].frame) {
    return FOCAL_LENGTH_KEYFRAMES[FOCAL_LENGTH_KEYFRAMES.length - 1].focalLength
  }

  for (let i = 0; i < FOCAL_LENGTH_KEYFRAMES.length - 1; i++) {
    const k0 = FOCAL_LENGTH_KEYFRAMES[i]
    const k1 = FOCAL_LENGTH_KEYFRAMES[i + 1]
    if (frame >= k0.frame && frame <= k1.frame) {
      const factor = (frame - k0.frame) / (k1.frame - k0.frame)
      return k0.focalLength + (k1.focalLength - k0.focalLength) * factor
    }
  }

  return 26
}

export function focalLengthToFov(focalLengthMm: number, sensorHeightMm: number = 24): number {
  return 2 * Math.atan(sensorHeightMm / (2 * focalLengthMm)) * (180 / Math.PI)
}
