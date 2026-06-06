// GLSL Shaders for the 3D Model Particle System

export const ModelParticleShader = {
  vertexShader: `
    // Simplex 3D Noise by Stefan Gustavson
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    
    float snoise(vec3 v){
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 =   v - i + dot(i, C.xxx) ;
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + 1.0 * C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
      i = mod(i, 289.0 );
      vec4 p = permute( permute( permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                    dot(p2,x2), dot(p3,x3) ) );
    }

    uniform float uTime;
    uniform float uNoiseStrength;
    uniform float uNoiseSpeed;
    uniform float uPointSize;
    uniform float uGlitchStrength;
    uniform float uGlitchSeed;
    uniform vec2 uMouse;
    uniform float uAspect;

    // Focus settings
    uniform float uFocusDepth;
    uniform float uFocusRange;
    uniform float uBokehScale;

    // Color attribute (from vertex colors or computed)
    attribute vec3 aColor;
    attribute float aScatter;

    varying vec3 vColor;
    varying float vDepth;
    varying float vBlur;
    varying vec2 vScreenPos;
    varying float vScatter;

    // 2D hash for block grid randomization
    float hash2D(vec2 p, float seed) {
      return fract(sin(dot(p, vec2(127.1, 311.7)) + seed) * 43758.5453);
    }

    void main() {
      vec3 pos = position;

      // Pass through the per-vertex color
      vColor = aColor;

      // Use the Y coordinate as a normalized depth for coloring effects
      vDepth = clamp((pos.y + 5.0) / 10.0, 0.0, 1.0);

      // Apply 3D simplex noise for organic atmospheric jitter
      vec3 noiseInput = vec3(pos.x * 0.5, pos.y * 0.5, uTime * uNoiseSpeed);
      float noiseVal = snoise(noiseInput);
      pos += vec3(
        noiseVal * uNoiseStrength,
        (noiseVal * 0.8) * uNoiseStrength,
        (noiseVal * 1.2) * uNoiseStrength
      );


      // Standard view/projection transform
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Pass screen position for fragment shader
      vScreenPos = gl_Position.xy / gl_Position.w;

      // Depth from camera
      float cameraDist = -mvPosition.z;

      // Focus/blur
      float distFromFocus = abs(cameraDist - uFocusDepth);
      vBlur = clamp((distFromFocus - uFocusRange) / max(uFocusRange, 0.1), 0.0, 1.0);

      // Point size
      float baseSize = clamp(uPointSize * (20.0 / max(cameraDist, 1.0)), 1.0, 12.0);
      gl_PointSize = baseSize;

      // Pass scatter to fragment
      vScatter = aScatter;

      // ─── SCREEN-SPACE GLITCH (applied AFTER projection) ───
      // This stays fixed in camera/screen space regardless of model rotation.
      if (uGlitchStrength > 0.01) {
        // Get normalized device coordinates (-1 to 1)
        vec2 ndc = gl_Position.xy / gl_Position.w;

        // ── Layer 1: Large block displacement ──
        vec2 blockL = floor(ndc * vec2(3.0, 5.0) + uGlitchSeed * 0.37);
        float hL = hash2D(blockL, uGlitchSeed);
        float dx = 0.0;
        float dy = 0.0;

        if (hL > 0.55) {
          dx += (hL - 0.5) * 2.8;
        }

        // ── Layer 2: Medium block displacement ──
        vec2 blockM = floor(ndc * vec2(7.0, 11.0) + uGlitchSeed * 1.13);
        float hM = hash2D(blockM, uGlitchSeed * 1.7);

        if (hM > 0.6) {
          dx += (hM - 0.5) * 1.6;
          dy += (hM - 0.65) * 0.8;
        }

        // ── Layer 3: Fine scan-line jitter ──
        float scanLine = floor(ndc.y * 35.0 + uGlitchSeed * 2.7);
        float hScan = fract(sin(scanLine * 437.585 + uGlitchSeed * 3.1) * 43758.5453);

        if (hScan > 0.78) {
          dx += (hScan - 0.5) * 0.7;
        }

        // ── Layer 4: Random rectangular block shifts ──
        vec2 blockR = floor(ndc * vec2(5.0, 8.0) + uGlitchSeed * 0.83);
        float hR = hash2D(blockR, uGlitchSeed * 2.9);
        float hR2 = hash2D(blockR + vec2(17.0, 31.0), uGlitchSeed * 3.7);

        if (hR > 0.72) {
          // Shift entire block diagonally
          dx += (hR2 - 0.5) * 2.0;
          dy += (hR - 0.72) * 3.0;
        }

        // Apply displacement in clip space (multiply by w for correct NDC offset)
        gl_Position.x += dx * uGlitchStrength * gl_Position.w * 0.12;
        gl_Position.y += dy * uGlitchStrength * gl_Position.w * 0.08;
      }
    }
  `,
  fragmentShader: `
    uniform vec3 uHazeColor;
    uniform float uHazeDensity;
    uniform vec3 uTint;
    uniform float uTintMix;
    uniform float uOpacity;
    uniform float uDensityControl;
    uniform float uTime;

    varying vec3 vColor;
    varying float vDepth;
    varying float vBlur;
    varying vec2 vScreenPos;
    varying float vScatter;

    // Simple hash for sparkle noise
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      // Circular particle shape
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;

      // Soft edge falloff
      float alpha = 1.0 - smoothstep(0.3, 0.5, dist);

      // Apply tint
      vec3 color = mix(vColor, uTint, uTintMix);

      // Apply atmospheric haze based on blur (distance from focus)
      color = mix(color, uHazeColor, vBlur * uHazeDensity);

      // --- Scatter Burn Glow ---
      // Particles displaced from rest glow like hot embers
      if (vScatter > 0.01) {
        // Fire gradient: base color -> deep orange -> bright orange -> yellow -> white-hot
        vec3 emberLow = vec3(1.0, 0.2, 0.05);    // Deep red-orange
        vec3 emberMid = vec3(1.0, 0.55, 0.1);     // Bright orange
        vec3 emberHigh = vec3(1.0, 0.9, 0.4);     // Yellow-white
        vec3 emberWhite = vec3(1.0, 1.0, 0.95);   // White-hot
        
        float s = vScatter;
        vec3 emberColor;
        if (s < 0.25) {
          emberColor = mix(color, emberLow, s * 4.0);
        } else if (s < 0.5) {
          emberColor = mix(emberLow, emberMid, (s - 0.25) * 4.0);
        } else if (s < 0.75) {
          emberColor = mix(emberMid, emberHigh, (s - 0.5) * 4.0);
        } else {
          emberColor = mix(emberHigh, emberWhite, (s - 0.75) * 4.0);
        }
        
        color = emberColor;
        // Additive bloom for intense heat
        color += vec3(1.0, 0.6, 0.2) * s * 1.5;
        // Boost alpha so scattered particles really pop
        alpha = min(1.0, alpha + s * 0.8);
      }

      // Sparkle noise effect
      float sparkle = hash(gl_FragCoord.xy + uTime * 3.0);
      float sparkleMask = step(0.97, sparkle);
      color += sparkleMask * 0.4;

      // Density control: reduce opacity of out-of-focus particles
      float focusAlpha = mix(1.0, 1.0 - vBlur, uDensityControl);

      alpha *= uOpacity * focusAlpha;

      // Drop fully transparent particles
      if (alpha < 0.01) discard;

      gl_FragColor = vec4(color, alpha);
    }
  `,
};
