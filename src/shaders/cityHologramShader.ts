// GLSL Shaders for the Holographic City Particle System
// Inspired by architectural hologram/blueprint aesthetics:
// - Blue/cyan holographic color palette
// - Animated horizontal scan lines
// - Grid overlay pattern
// - Edge glow / Fresnel-style brightness
// - Flickering data noise & sparkle
// - Depth-based atmospheric fade

export const CityHologramShader = {
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
    uniform float uPointSize;
    uniform float uNoiseStrength;
    uniform float uNoiseSpeed;
    uniform float uGlitchStrength;
    uniform float uGlitchSeed;

    attribute vec3 aColor;

    varying vec3 vColor;
    varying vec3 vWorldPos;
    varying float vDepth;
    varying vec2 vScreenPos;

    // 2D hash for glitch
    float hash2D(vec2 p, float seed) {
      return fract(sin(dot(p, vec2(127.1, 311.7)) + seed) * 43758.5453);
    }

    void main() {
      vec3 pos = position;

      // Pass vertex color through
      vColor = aColor;
      vWorldPos = pos;

      // Subtle noise jitter for organic hologram feel
      vec3 noiseInput = vec3(pos.x * 0.4, pos.y * 0.4, uTime * uNoiseSpeed * 0.2);
      float noiseVal = snoise(noiseInput);
      pos += vec3(
        noiseVal * uNoiseStrength * 0.15,
        (noiseVal * 0.6) * uNoiseStrength * 0.15,
        (noiseVal * 1.0) * uNoiseStrength * 0.15
      );

      // Standard transform
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Screen-space coords for fragment effects
      vScreenPos = gl_Position.xy / gl_Position.w;

      // Depth for atmospheric effects
      float cameraDist = -mvPosition.z;
      vDepth = cameraDist;

      // Point size with distance attenuation
      float baseSize = clamp(uPointSize * (20.0 / max(cameraDist, 1.0)), 1.0, 14.0);
      gl_PointSize = baseSize;

      // ─── SCREEN-SPACE GLITCH ───
      if (uGlitchStrength > 0.01) {
        vec2 ndc = gl_Position.xy / gl_Position.w;

        // Large block displacement
        vec2 blockL = floor(ndc * vec2(3.0, 5.0) + uGlitchSeed * 0.37);
        float hL = hash2D(blockL, uGlitchSeed);
        float dx = 0.0;
        float dy = 0.0;

        if (hL > 0.55) {
          dx += (hL - 0.5) * 2.8;
        }

        // Medium block displacement
        vec2 blockM = floor(ndc * vec2(7.0, 11.0) + uGlitchSeed * 1.13);
        float hM = hash2D(blockM, uGlitchSeed * 1.7);
        if (hM > 0.6) {
          dx += (hM - 0.5) * 1.6;
          dy += (hM - 0.65) * 0.8;
        }

        // Scan line jitter
        float scanLine = floor(ndc.y * 35.0 + uGlitchSeed * 2.7);
        float hScan = fract(sin(scanLine * 437.585 + uGlitchSeed * 3.1) * 43758.5453);
        if (hScan > 0.78) {
          dx += (hScan - 0.5) * 0.7;
        }

        gl_Position.x += dx * uGlitchStrength * gl_Position.w * 0.12;
        gl_Position.y += dy * uGlitchStrength * gl_Position.w * 0.08;
      }
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uOpacity;
    uniform float uScanLineSpeed;
    uniform float uScanLineDensity;
    uniform float uScanLineIntensity;
    uniform float uGridScale;
    uniform float uGridIntensity;
    uniform float uFlickerSpeed;
    uniform float uFlickerIntensity;
    uniform vec3 uHoloColorPrimary;    // Main blue
    uniform vec3 uHoloColorSecondary;  // Accent cyan
    uniform vec3 uHoloColorEdge;       // Edge/highlight glow
    uniform float uEdgeGlow;
    uniform float uAtmosphericFade;

    varying vec3 vColor;
    varying vec3 vWorldPos;
    varying float vDepth;
    varying vec2 vScreenPos;

    // Hash functions
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float hash1(float n) {
      return fract(sin(n) * 43758.5453123);
    }

    void main() {
      // Circular particle shape
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;

      // Soft edge falloff with glow halo
      float coreFalloff = 1.0 - smoothstep(0.1, 0.35, dist);
      float haloFalloff = 1.0 - smoothstep(0.2, 0.5, dist);
      float alpha = mix(haloFalloff * 0.6, coreFalloff, 0.5);

      // ─── HOLOGRAPHIC COLOR GRADIENT ───
      // Height-based color blend: deep blue at bottom → cyan at top
      float heightNorm = clamp((vWorldPos.y + 2.0) / 12.0, 0.0, 1.0);
      vec3 holoBase = mix(uHoloColorPrimary, uHoloColorSecondary, heightNorm * 0.7);

      // Mix in original vertex color subtly for structural variation
      vec3 color = mix(holoBase, vColor * uHoloColorSecondary, 0.15);

      // ─── SCAN LINES ───
      // Horizontal scan lines scrolling upward
      float scanY = vWorldPos.y * uScanLineDensity + uTime * uScanLineSpeed;
      float scanLine = abs(fract(scanY) - 0.5) * 2.0;
      scanLine = smoothstep(0.3, 0.5, scanLine);
      // Brighten particles on scan lines
      color += uHoloColorEdge * scanLine * uScanLineIntensity;
      alpha += scanLine * 0.15 * uScanLineIntensity;

      // ─── GRID OVERLAY ───
      // Architectural blueprint grid based on world position
      float gridX = abs(fract(vWorldPos.x * uGridScale) - 0.5) * 2.0;
      float gridZ = abs(fract(vWorldPos.z * uGridScale) - 0.5) * 2.0;
      float gridY = abs(fract(vWorldPos.y * uGridScale) - 0.5) * 2.0;
      float gridLine = max(
        smoothstep(0.85, 0.95, gridX),
        max(smoothstep(0.85, 0.95, gridZ), smoothstep(0.85, 0.95, gridY))
      );
      color += uHoloColorEdge * gridLine * uGridIntensity;
      alpha += gridLine * 0.1 * uGridIntensity;

      // ─── EDGE GLOW / FRESNEL ───
      // Particles at the edges of geometry (based on normal approximation via position variation)
      // Use screen-space position derivative as a proxy for edges
      float edgeFactor = 1.0 - smoothstep(0.0, 0.3, dist);
      color += uHoloColorEdge * edgeFactor * uEdgeGlow * 0.5;

      // ─── DATA FLICKER ───
      // Random per-particle flicker for digital noise feel
      float flickerSeed = hash(floor(vWorldPos.xz * 5.0) + floor(uTime * uFlickerSpeed));
      float flicker = smoothstep(0.7, 1.0, flickerSeed);
      alpha *= mix(1.0, 0.3, flicker * uFlickerIntensity);

      // Occasional bright data sparkle
      float sparkle = hash(gl_FragCoord.xy + uTime * 5.0);
      float sparkleMask = step(0.985, sparkle);
      color += uHoloColorEdge * sparkleMask * 0.8;

      // ─── DEPTH-BASED ATMOSPHERIC FADE ───
      float depthFade = 1.0 - smoothstep(5.0, 60.0, vDepth);
      alpha *= mix(1.0, depthFade, uAtmosphericFade);

      // Very distant particles get a faint blue fog
      color = mix(color, uHoloColorPrimary * 0.3, (1.0 - depthFade) * 0.5);

      // ─── GLOBAL OPACITY & ADDITIVE BLOOM ───
      alpha *= uOpacity;

      // Additive brightness for glow
      color *= 1.3;

      if (alpha < 0.01) discard;

      gl_FragColor = vec4(color, alpha);
    }
  `,
};
