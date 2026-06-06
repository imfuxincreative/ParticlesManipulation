import React, { forwardRef, useMemo } from 'react';
import { Effect } from 'postprocessing';
import * as THREE from 'three';

const fragmentShader = `
  uniform float time;
  uniform float strength;
  uniform float seed;
  
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233)) + seed) * 43758.5453123);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (strength < 0.01) {
      outputColor = inputColor;
      return;
    }
    
    // Fast time step so the blocks flicker rapidly (15fps style)
    float t = floor(time * 15.0);
    
    // Create horizontal and vertical bands to form structural blocks
    float bx1 = floor(uv.x * 12.0);
    float by1 = floor(uv.y * 12.0);
    float bandX1 = random(vec2(bx1, t * 0.1));
    float bandY1 = random(vec2(by1, t * 0.2));
    
    float bx2 = floor(uv.x * 4.0);
    float by2 = floor(uv.y * 6.0);
    float bandX2 = random(vec2(bx2, t * 0.3));
    float bandY2 = random(vec2(by2, t * 0.4));

    // Combine bands to create intersecting rectangles
    float shapeNoise = max(bandX1 * bandY2, bandX2 * bandY1);
    
    // Threshold based on strength
    float threshold = 1.0 - (strength * 0.8);
    if (shapeNoise < threshold) {
      outputColor = inputColor; // Unglitched area
      return;
    }
    
    // Hash the block coordinates to randomly select the type of glitch
    float glitchType = random(vec2(bx2, by2) + t * 0.5);
    
    if (glitchType < 0.30) {
      // 1. PURE BLUE BLOCK
      outputColor = vec4(0.0, 0.0, 1.0, 1.0);
      
    } else if (glitchType < 0.65) {
      // 2. DATAMOSH VERTICAL SMEAR (Read from a stretched/shifted UV)
      float smearShift = random(vec2(bx2, by2) + t) * 0.4 - 0.2;
      vec2 smearUv = fract(vec2(uv.x + smearShift, floor(uv.y * 10.0) / 10.0));
      outputColor = texture2D(inputBuffer, smearUv);
      
    } else {
      // 3. DATAMOSH BLOCK SHIFT (Read from completely different block)
      float shiftX = random(vec2(bx1, by1) + t) * 0.8 - 0.4;
      float shiftY = random(vec2(by1, bx1) + t) * 0.8 - 0.4;
      vec2 shiftUv = fract(uv + vec2(shiftX, shiftY));
      
      // Optionally tint it slightly to make it look corrupted
      vec4 shiftedColor = texture2D(inputBuffer, shiftUv);
      outputColor = vec4(shiftedColor.rgb, 1.0);
    }
  }
`;

class DatamoshEffectImpl extends Effect {
  constructor() {
    super('DatamoshEffect', fragmentShader, {
      uniforms: new Map([
        ['time', new THREE.Uniform(0)],
        ['strength', new THREE.Uniform(0)],
        ['seed', new THREE.Uniform(0)]
      ])
    });
  }

  update(renderer: any, inputBuffer: any, deltaTime: number) {
    const timeUniform = this.uniforms.get('time');
    if (timeUniform) {
      timeUniform.value += deltaTime;
    }
  }
}

interface DatamoshProps {
  strength?: number;
  seed?: number;
}

export const Datamosh = forwardRef<DatamoshEffectImpl, DatamoshProps>(({ strength = 0, seed = 0 }, ref) => {
  const effect = useMemo(() => new DatamoshEffectImpl(), []);
  
  // Set initial values
  const strengthUniform = effect.uniforms.get('strength');
  const seedUniform = effect.uniforms.get('seed');
  if (strengthUniform) strengthUniform.value = strength;
  if (seedUniform) seedUniform.value = seed;
  
  return <primitive ref={ref} object={effect} dispose={null} />;
});
Datamosh.displayName = 'Datamosh';
