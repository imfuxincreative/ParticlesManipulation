/**
 * Target Callout Configuration
 *
 * Each entry maps to a Blender object named "target1", "target2", etc.
 * Add new targets here — no code changes needed elsewhere.
 */

export interface CalloutTargetConfig {
  /** Must match the Blender object name exactly (e.g. "target1") */
  id: string;

  /** Primary label text (uppercase monospace style) */
  label: string;

  /** Optional secondary line of text */
  sublabel?: string;

  /** Blender frame where this callout starts appearing */
  frameStart: number;

  /** Blender frame where this callout starts disappearing */
  frameEnd: number;

  /**
   * Direction the horizontal SVG line extends from the diagonal.
   * "left"  → label sits to the LEFT of the target point
   * "right" → label sits to the RIGHT of the target point
   */
  direction: "left" | "right";

  /**
   * Length of the diagonal segment in pixels.
   * Controls how far the line travels before the horizontal turn.
   * @default 80
   */
  diagonalLength?: number;

  /**
   * Length of the horizontal segment in pixels.
   * Controls how far the horizontal line extends to the label.
   * @default 120
   */
  horizontalLength?: number;

  /**
   * Angle of the diagonal segment in degrees.
   * 0 = straight up, 45 = upper-left/upper-right diagonal.
   * The actual direction (left vs right) is controlled by the `direction` field.
   * @default 35
   */
  diagonalAngle?: number;

  /** Optional accent color override (hex). Defaults to white. */
  accentColor?: string;

  /**
   * Whether the Blender helper mesh for this target should be visible in the scene.
   * Set to true if the target is a real prop/object you want to render.
   * @default false — hidden (pure invisible anchor point)
   */
  meshVisible?: boolean;
}

export const CALLOUT_TARGETS: CalloutTargetConfig[] = [
  {
    id: "target1",
    label: "Creative dev & Designer",
    sublabel: "I love to craft visual experience",
    frameStart: 1473,
    frameEnd: 1857,
    direction: "left",
    diagonalLength: 80,
    horizontalLength: 130,
    diagonalAngle: 35,
    meshVisible: false, // hidden anchor point
  },
  {
    id: "target3",
    label: "@IMFUCXINCREATIVE",
    frameStart: 1473,
    frameEnd: 1857,
    direction: "right",
    diagonalLength: 80,
    horizontalLength: 130,
    diagonalAngle: 35,
    meshVisible: true,  // ← this mesh renders visibly in the scene
  },
  {
    id: "target2",
    label: "    AVAILABLE TO HIRE",
    sublabel: "CREATIVE DEV / FRONTEND DEV",
    frameStart: 3613,
    frameEnd: 3784,
    direction: "right",
    diagonalLength: 70,
    horizontalLength: 140,
    diagonalAngle: 30,
    meshVisible: false, // hidden anchor point
  },
];
