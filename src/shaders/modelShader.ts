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
    uniform float uBurnProgress;
    uniform float uFlowStrength;
    uniform float uFlowSpeed;
    uniform float uFlowFrequency;
    uniform float uFlowNormalLimit;
    uniform float uFlowClumping;
    uniform float uScrollProgress;

    // Focus settings
    uniform float uFocusDepth;
    uniform float uFocusRange;
    uniform float uBokehScale;

    // Color attribute (from vertex colors or computed)
    attribute vec3 aColor;
    attribute float aScatter;
    attribute vec3 aNormal;

    varying vec3 vColor;
    varying float vDepth;
    varying float vBlur;
    varying vec2 vScreenPos;
    varying float vScatter;
    varying float vPosY;
    varying vec3 vWorldPosition;
    varying float vCameraDist;
    varying float vGpuScatter;

    // 2D hash for block grid randomization
    float hash2D(vec2 p, float seed) {
      return fract(sin(dot(p, vec2(127.1, 311.7)) + seed) * 43758.5453);
    }

    // Curl noise using snoise — divergence-free flow field on the GPU
    vec3 curlNoise(vec3 p) {
      float e = 0.1;
      // Partial derivatives via finite differences of snoise
      float nx = snoise(p + vec3(e, 0.0, 0.0)) - snoise(p - vec3(e, 0.0, 0.0));
      float ny = snoise(p + vec3(0.0, e, 0.0)) - snoise(p - vec3(0.0, e, 0.0));
      float nz = snoise(p + vec3(0.0, 0.0, e)) - snoise(p - vec3(0.0, 0.0, e));

      // Use offset noise fields for each curl component
      float nx2 = snoise(p + vec3(e, 0.0, 100.0)) - snoise(p - vec3(e, 0.0, 100.0));
      float ny2 = snoise(p + vec3(0.0, e, 200.0)) - snoise(p - vec3(0.0, e, 200.0));
      float nz2 = snoise(p + vec3(0.0, 0.0, e) + vec3(300.0)) - snoise(p - vec3(0.0, 0.0, e) + vec3(300.0));

      // curl(F) = (dFz/dy - dFy/dz, dFx/dz - dFz/dx, dFy/dx - dFx/dy)
      return vec3(
        ny2 - nz,
        nz2 - nx,
        nx2 - ny
      ) / (2.0 * e);
    }

    void main() {
      vec3 pos = position;

      // Pass through the per-vertex color
      vColor = aColor;

      // Pass raw local Y for vertical effects
      vPosY = pos.y;

      // ── Curl noise flow displacement (water-like flowing motion) ──
      // Driven by both time and scroll progress for responsive scrolling ripples
      vec3 flowInput = pos * uFlowFrequency + vec3(0.0, 0.0, uTime * uFlowSpeed + uScrollProgress * 8.0);
      vec3 flow = curlNoise(flowInput);
      
      // Low-frequency noise mask for organic uneven clumping
      vec3 maskInput = position * (uFlowFrequency * 0.4) + vec3(0.0, 0.0, uTime * uFlowSpeed * 0.3);
      float flowMask = smoothstep(-0.3, 0.5, snoise(maskInput));
      float clumpingMask = mix(1.0, flowMask, uFlowClumping);

      vec3 N = aNormal;
      float len = length(N);
      if (len > 0.01) {
        N = N / len;
        vec3 tangentFlow = flow - dot(flow, N) * N;
        vec3 normalFlow = dot(flow, N) * N;
        pos += (tangentFlow * uFlowStrength + normalFlow * uFlowNormalLimit) * clumpingMask;
      } else {
        pos += flow * uFlowStrength * clumpingMask;
      }

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPos.xyz;

      // Perturb Y world coordinate using simplex noise for cloudy transition
      float yPerturb = snoise(vec3(worldPos.xz * 0.12, uTime * 0.2));
      vWorldPosition.y += yPerturb * 6.0;

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


      // The distance the particle was displaced on the GPU
      vGpuScatter = distance(pos, position);

      // Standard view/projection transform
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Pass screen position for fragment shader
      vScreenPos = gl_Position.xy / gl_Position.w;

      // Depth from camera
      float cameraDist = -mvPosition.z;
      vCameraDist = cameraDist;

      // Focus/blur
      float distFromFocus = abs(cameraDist - uFocusDepth);
      vBlur = clamp((distFromFocus - uFocusRange) / max(uFocusRange, 0.1), 0.0, 1.0);

      // Point size
      float baseSize = clamp(uPointSize * (20.0 / max(cameraDist, 1.0)), 1.0, 12.0);
      // Increase point size as we burn to look solid
      float sizeMultiplier = 1.0 + uBurnProgress * 2.5;
      gl_PointSize = clamp(baseSize * sizeMultiplier, 1.0, 24.0);

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
    uniform vec3 uPrimaryColor;
    uniform vec3 uParticleDefaultColor;
    uniform float uBurnProgress;
    uniform float uParticleOpacity;
    uniform float uClipY;
    uniform float uClipSide;
    uniform float uGlowIntensity;

    varying vec3 vColor;
    varying float vDepth;
    varying float vBlur;
    varying vec2 vScreenPos;
    varying float vScatter;
    varying float vPosY;
    varying vec3 vWorldPosition;
    varying float vCameraDist;
    varying float vGpuScatter;
    uniform float uScatterColorScale;

    uniform float uShowFog;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    uniform float uFogAmount;

    // Simple hash for sparkle noise
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      // Vertical Wipe clipping with soft opacity transition
      float alphaWipe = 1.0;
      float feather = 12.0;
      if (uClipSide > 0.5) {
        alphaWipe = smoothstep(uClipY - feather, uClipY + feather, vWorldPosition.y);
      } else if (uClipSide < -0.5) {
        alphaWipe = 1.0 - smoothstep(uClipY - feather, uClipY + feather, vWorldPosition.y);
      }
      if (alphaWipe < 0.01) discard;

      // Circular particle shape
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;

      // Soft edge falloff
      float alpha = 1.0 - smoothstep(0.3, 0.5, dist);

      // Apply default color if vertex has no color (sentinel value of < 0.0)
      vec3 baseColor = vColor.r < 0.0 ? uParticleDefaultColor : vColor;

      // Apply tint
      vec3 color = mix(baseColor, uTint, uTintMix);

      // Apply particle glow multiplier (bloom trigger)
      color *= uGlowIntensity;

      // Blend with thick white cloud/fog color at the boundary
      vec3 cloudColor = mix(uHazeColor, vec3(0.95, 0.95, 0.98), 0.4);
      color = mix(cloudColor, color, alphaWipe);

      // Apply atmospheric haze based on blur (distance from focus)
      color = mix(color, uHazeColor, vBlur * uHazeDensity);

      // --- Scatter Burn Glow ---
      // Particles displaced from rest glow using the primary color
      float s = clamp(max(max(vScatter, vGpuScatter) * uScatterColorScale, uBurnProgress), 0.0, 1.0);
      if (s > 0.01) {
        // Direct transition from base color (white) to primary color to avoid grayish intermediate values.
        vec3 emberColor = mix(color, uPrimaryColor, s);
        
        color = emberColor;
        // Additive bloom using primary color
        color += uPrimaryColor * s * 1.5;
        // Boost alpha so scattered particles really pop
        alpha = min(1.0, alpha + s * 0.8);
      }

      // --- Vertical Scanning Wave Glow ---
      // Creates a continuous light pulse moving from bottom to top
      float wavePhase = vPosY * 0.15 - uTime * 2.5; 
      float wavePulse = (sin(wavePhase) + 1.0) * 0.5;
      wavePulse = pow(wavePulse, 16.0); // Make the wave a sharp, tight band

      // Add intense glow based on the primary color
      vec3 waveGlowColor = mix(vec3(1.0), uPrimaryColor, 0.6);
      color += waveGlowColor * wavePulse * 1.5;
      alpha = min(1.0, alpha + wavePulse * 0.8);

      // Sparkle noise effect
      float sparkle = hash(gl_FragCoord.xy + uTime * 3.0);
      float sparkleMask = step(0.97, sparkle);
      color += sparkleMask * 0.4;

      // Density control: reduce opacity of out-of-focus particles
      float focusAlpha = mix(1.0, 1.0 - vBlur, uDensityControl);

      alpha *= uOpacity * focusAlpha * uParticleOpacity * alphaWipe;

      // Apply environmental fog (depth-based fading for model particles)
      float fogFactor = clamp((uFogFar - vCameraDist) / max(uFogFar - uFogNear, 0.0001), 0.0, 1.0);
      float fogMix = uShowFog * uFogAmount * (1.0 - fogFactor);
      color = mix(color, uFogColor, fogMix);
      alpha = mix(alpha, 0.0, fogMix);

      // Drop fully transparent particles
      if (alpha < 0.01) discard;

      gl_FragColor = vec4(color, alpha);
    }
  `,
};
