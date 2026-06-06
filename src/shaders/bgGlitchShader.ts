import * as THREE from 'three';

export const BgGlitchShader = {
  uniforms: {
    uTime: { value: 0 },
    uStrength: { value: 0 },
    uSeed: { value: 0 },
    uColor: { value: new THREE.Color("#0000ff") },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      // We will place a plane far back, so standard transform is fine
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uStrength;
    uniform float uSeed;
    uniform vec3 uColor;
    
    varying vec2 vUv;
    
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233)) + uSeed) * 43758.5453123);
    }

    void main() {
      if (uStrength < 0.01) {
        discard;
      }
      
      // Fast time step so the blocks flicker rapidly (15fps style)
      float t = floor(uTime * 15.0);
      
      // Create horizontal and vertical bands to form structural blocks
      float bx1 = floor(vUv.x * 12.0);
      float by1 = floor(vUv.y * 12.0);
      float bandX1 = random(vec2(bx1, t * 0.1));
      float bandY1 = random(vec2(by1, t * 0.2));
      
      float bx2 = floor(vUv.x * 4.0);
      float by2 = floor(vUv.y * 6.0);
      float bandX2 = random(vec2(bx2, t * 0.3));
      float bandY2 = random(vec2(by2, t * 0.4));

      // Combine bands to create intersecting rectangles
      float shapeNoise = max(bandX1 * bandY2, bandX2 * bandY1);
      
      // Threshold based on strength
      float threshold = 1.0 - (uStrength * 0.8);
      if (shapeNoise < threshold) {
        discard;
      }
      
      // Hash the block coordinates to randomly select the type of glitch
      // This ensures the "Blue vs Picture" glitch is completely randomized per block
      float glitchType = random(vec2(bx2, by2) + t * 0.5);
      
      if (glitchType < 0.35) {
        // 1. PURE BLUE BLOCK (Like the reference image)
        gl_FragColor = vec4(uColor, 1.0);
        
      } else if (glitchType < 0.70) {
        // 2. DATAMOSH VERTICAL SMEAR (Looks like a stretched picture glitch)
        float smearY = floor(vUv.y * 15.0); // Low res Y (stretches vertically)
        float smearX = floor(vUv.x * 250.0); // High res X (thin vertical bars)
        float smear = random(vec2(smearX, smearY) + t);
        // Make it contrasty, mostly bright/dark streaks resembling point cloud data
        float lum = smoothstep(0.3, 0.7, smear);
        gl_FragColor = vec4(vec3(lum * 0.8 + 0.1), 1.0);
        
      } else {
        // 3. CHUNKY STATIC NOISE (Looks like corrupted picture data)
        vec2 chunkUv = floor(vUv * 120.0);
        float noise = random(chunkUv + t);
        float lum = step(0.5, noise) * 0.9; // Hard black or white pixels
        gl_FragColor = vec4(vec3(lum + 0.1), 1.0);
      }
    }
  `
};
