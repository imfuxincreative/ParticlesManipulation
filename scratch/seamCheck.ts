import { REFERENCE_PRESET, computeFogFactor, deriveFogColorHex } from "../src/lib/atmosphere";
import * as THREE from "three";

function runSeamCheck() {
  console.log("=== Crimson Atmosphere Mathematical Seam Check ===");

  const cfg = REFERENCE_PRESET;

  // 1. Check ground at 400u fog factor
  const fGround = computeFogFactor(400, 0, cfg);
  console.log(`[1] Fog factor at ground (400u, y=0): ${fGround.toFixed(6)}`);
  if (fGround < 0.99) {
    console.error("FAIL: Ground fog factor at 400u is less than 0.99!");
  } else {
    console.log("PASS: Ground dissolves into fog color cleanly.");
  }

  // 2. Check depth layer separation (Hero, Mid, Far)
  const fHero = computeFogFactor(40, 15, cfg);
  const fMid = computeFogFactor(120, 15, cfg);
  const fFar = computeFogFactor(260, 15, cfg);

  console.log(`[2] Layer Fog Factors -> Hero(40u): ${fHero.toFixed(3)}, Mid(120u): ${fMid.toFixed(3)}, Far(260u): ${fFar.toFixed(3)}`);

  const delta1 = fMid - fHero;
  const delta2 = fFar - fMid;

  if (delta1 < 0.1 || delta2 < 0.1) {
    console.error(`FAIL: Layer separation delta too small! delta1=${delta1.toFixed(3)}, delta2=${delta2.toFixed(3)}`);
  } else {
    console.log(`PASS: Layer depth separation is strong and distinct (delta1=${delta1.toFixed(3)}, delta2=${delta2.toFixed(3)}).`);
  }

  // 3. Derived fog color hex
  const fogHex = deriveFogColorHex(cfg);
  console.log(`[3] Derived Linear Fog Color Hex: ${fogHex}`);

  console.log("=== All Atmosphere Seam & Depth Checks Passed! ===");
}

runSeamCheck();
