// GLSL Shaders for the static City Particle System
// Simplified version of modelShader — no mouse interaction, no glitch, no scatter.
// Designed for high-performance rendering of a massive city point cloud.

export const CityParticleShader = {
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

    // Focus settings
    uniform float uFocusDepth;
    uniform float uFocusRange;
    uniform float uBokehScale;

    // Color attribute (from vertex colors or computed)
    attribute vec3 aColor;

    varying vec3 vColor;
    varying float vDepth;
    varying float vBlur;

    void main() {
      vec3 pos = position;

      // Pass through the per-vertex color
      vColor = aColor;

      // Use the Y coordinate as a normalized depth for coloring effects
      vDepth = clamp((pos.y + 5.0) / 10.0, 0.0, 1.0);

      // Apply very subtle 3D simplex noise for atmospheric jitter
      vec3 noiseInput = vec3(pos.x * 0.3, pos.y * 0.3, uTime * uNoiseSpeed * 0.3);
      float noiseVal = snoise(noiseInput);
      pos += vec3(
        noiseVal * uNoiseStrength * 0.3,
        (noiseVal * 0.8) * uNoiseStrength * 0.3,
        (noiseVal * 1.2) * uNoiseStrength * 0.3
      );

      // Standard view/projection transform
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Depth from camera
      float cameraDist = -mvPosition.z;

      // Focus/blur
      float distFromFocus = abs(cameraDist - uFocusDepth);
      vBlur = clamp((distFromFocus - uFocusRange) / max(uFocusRange, 0.1), 0.0, 1.0);

      // Point size — scale with distance
      float baseSize = clamp(uPointSize * (20.0 / max(cameraDist, 1.0)), 1.0, 12.0);
      gl_PointSize = baseSize;
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
