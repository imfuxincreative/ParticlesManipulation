"use client";

import React, { forwardRef, useMemo, useLayoutEffect } from "react";
import { Effect } from "postprocessing";
import * as THREE from "three";
import { useLoopTransition } from "./transitionConfig";

const fragmentShader = /* glsl */ `
uniform float uBlurStrength;
uniform float uFlashStrength;
uniform float uProgress;
uniform float uAberration;
uniform float uZoomBlur;
uniform float uMaskRadius;
uniform float uMaskFeather;
uniform vec2 uCenter;
uniform vec2 uResolution;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Fast path: zero overhead during normal playback
  if (uBlurStrength < 0.001 && uFlashStrength < 0.001) {
    outputColor = inputColor;
    return;
  }

  // Calculate aspect ratio
  float aspect = uResolution.x > 0.0 && uResolution.y > 0.0 ? uResolution.x / uResolution.y : 1.7777;
  vec2 aspectVec = vec2(aspect, 1.0);

  // Radial Mask Calculation (if enabled)
  float effectiveBlur = uBlurStrength;
  if (uMaskRadius > 0.001) {
    float dist = length((uv - uCenter) * aspectVec);
    float mask = smoothstep(uMaskRadius + uMaskFeather, max(0.001, uMaskRadius - uMaskFeather), dist);
    effectiveBlur *= mask;
  }

  if (effectiveBlur < 0.001 && uFlashStrength < 0.001) {
    outputColor = inputColor;
    return;
  }

  vec2 toCenter = (uv - uCenter);
  float maxRadius = 0.045 * effectiveBlur;
  float zoomDist = uZoomBlur * effectiveBlur;
  float abDist = uAberration * effectiveBlur;

  vec4 accum = vec4(0.0);
  float totalWeight = 0.0;

  // 18-sample golden angle spiral distribution for clean, silky circular bokeh
  const int SAMPLES = 18;
  for (int i = 0; i < SAMPLES; i++) {
    float fi = float(i);
    float norm = (fi + 0.5) / float(SAMPLES);
    float r = sqrt(norm) * maxRadius;
    float theta = fi * 2.39996323; // Golden angle (rad)

    vec2 circleDir = vec2(cos(theta), sin(theta));
    vec2 sampleOffset = circleDir * r + toCenter * ((norm - 0.5) * zoomDist);

    // Chromatic dispersion for cinematic optical lens feel
    vec2 uvR = clamp(uv + sampleOffset * (1.0 + abDist * 1.5), 0.0, 1.0);
    vec2 uvG = clamp(uv + sampleOffset, 0.0, 1.0);
    vec2 uvB = clamp(uv + sampleOffset * (1.0 - abDist * 1.5), 0.0, 1.0);

    float weight = 1.0 - norm * 0.35; // Center-weighted bokeh
    
    float rCol = texture2D(inputBuffer, uvR).r;
    vec4 gCol = texture2D(inputBuffer, uvG);
    float bCol = texture2D(inputBuffer, uvB).b;

    accum += vec4(rCol, gCol.g, bCol, gCol.a) * weight;
    totalWeight += weight;
  }

  vec4 blurred = accum / totalWeight;

  // Soften and illuminate deep shadows during blur so dark silhouettes don't pop behind the blur
  if (effectiveBlur > 0.05) {
    float lum = dot(blurred.rgb, vec3(0.299, 0.587, 0.114));
    float shadowMask = clamp(1.0 - lum * 2.2, 0.0, 1.0);
    blurred.rgb += vec3(0.25 * pow(effectiveBlur, 1.4) * shadowMask);
  }

  // Subtle ethereal exposure lift / dream flash at peak transition
  if (uFlashStrength > 0.001) {
    blurred.rgb += vec3(uFlashStrength * 0.55);
  }

  // Smooth mix between input and blurred
  outputColor = mix(inputColor, blurred, min(1.0, effectiveBlur * 1.3));
}
`;

export class LoopMaskTransitionEffect extends Effect {
  constructor() {
    super("LoopMaskTransitionEffect", fragmentShader, {
      uniforms: new Map<string, THREE.Uniform>([
        ["uBlurStrength", new THREE.Uniform(0.0)],
        ["uFlashStrength", new THREE.Uniform(0.0)],
        ["uProgress", new THREE.Uniform(0.0)],
        ["uAberration", new THREE.Uniform(0.025)],
        ["uZoomBlur", new THREE.Uniform(0.04)],
        ["uMaskRadius", new THREE.Uniform(0.0)],
        ["uMaskFeather", new THREE.Uniform(0.25)],
        ["uCenter", new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
        ["uResolution", new THREE.Uniform(new THREE.Vector2(1920, 1080))],
      ]),
    });
  }

  setSize(width: number, height: number) {
    const res = this.uniforms.get("uResolution");
    if (res) {
      res.value.set(width, height);
    }
  }

  update(_renderer: THREE.WebGLRenderer, _inputBuffer: THREE.WebGLRenderTarget, _deltaTime: number) {
    // Read directly from the reactive transition store on every render
    const state = useLoopTransition.getState();
    const isInTouch = state.activeScene === "inTouch";
    const { config, blurStrength, flashStrength, transitionProgress } = state;

    const uBlur = this.uniforms.get("uBlurStrength");
    if (uBlur) uBlur.value = isInTouch ? 0.0 : blurStrength;

    const uFlash = this.uniforms.get("uFlashStrength");
    if (uFlash) uFlash.value = isInTouch ? 0.0 : flashStrength;

    const uProg = this.uniforms.get("uProgress");
    if (uProg) uProg.value = isInTouch ? 0.0 : transitionProgress;

    const uAb = this.uniforms.get("uAberration");
    if (uAb) uAb.value = config.chromaticAberration;

    const uZoom = this.uniforms.get("uZoomBlur");
    if (uZoom) uZoom.value = config.zoomBlurStrength;

    const uRad = this.uniforms.get("uMaskRadius");
    if (uRad) uRad.value = config.maskRadius;

    const uFeather = this.uniforms.get("uMaskFeather");
    if (uFeather) uFeather.value = config.maskFeather;
  }
}

export interface LoopMaskTransitionProps {
  blurStrength?: number;
  chromaticAberration?: number;
  zoomBlurStrength?: number;
  maskRadius?: number;
  maskFeather?: number;
}

export const LoopMaskTransition = forwardRef<LoopMaskTransitionEffect, LoopMaskTransitionProps>(
  (props, ref) => {
    const effect = useMemo(() => new LoopMaskTransitionEffect(), []);

    useLayoutEffect(() => {
      if (props.blurStrength !== undefined) {
        const u = effect.uniforms.get("uBlurStrength");
        if (u) u.value = props.blurStrength;
      }
      if (props.chromaticAberration !== undefined) {
        const u = effect.uniforms.get("uAberration");
        if (u) u.value = props.chromaticAberration;
      }
      if (props.zoomBlurStrength !== undefined) {
        const u = effect.uniforms.get("uZoomBlur");
        if (u) u.value = props.zoomBlurStrength;
      }
      if (props.maskRadius !== undefined) {
        const u = effect.uniforms.get("uMaskRadius");
        if (u) u.value = props.maskRadius;
      }
      if (props.maskFeather !== undefined) {
        const u = effect.uniforms.get("uMaskFeather");
        if (u) u.value = props.maskFeather;
      }
    }, [
      effect,
      props.blurStrength,
      props.chromaticAberration,
      props.zoomBlurStrength,
      props.maskRadius,
      props.maskFeather,
    ]);

    return <primitive ref={ref} object={effect} dispose={null} />;
  }
);

LoopMaskTransition.displayName = "LoopMaskTransition";
