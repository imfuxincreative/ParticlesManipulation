// GLSL Shaders for the RGB-D Particle Simulation

export const DepthParticleShader = {
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

    uniform sampler2D uVideoTexture;
    uniform float uDepthScale;
    uniform float uTime;
    uniform float uNoiseStrength;
    uniform float uNoiseSpeed;
    uniform float uPointSize;
    uniform float uUseFallback;     // 1.0 = use GPU procedural waves, 0.0 = use texture
    uniform float uIsDoubleWidth;   // 1.0 = RGB-D SBS format, 0.0 = single normal video format
    uniform float uScrollProgress;

    // Focus settings
    uniform float uFocusDepth;
    uniform float uFocusRange;
    uniform float uBokehScale;

    varying vec3 vColor;
    varying float vDepth;
    varying float vBlur;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      float depth = 0.0;
      vec3 pos = position;

      if (uUseFallback > 0.5) {
        // High-performance GPU-based procedural landscape
        float t = uScrollProgress;
        
        // Animated rolling mountain wave 1
        float peak1X = 0.5 + 0.12 * sin(t * 6.2831);
        float peak1Y = 0.45 + 0.08 * cos(t * 6.2831);
        float distSq1 = (uv.x - peak1X)*(uv.x - peak1X) + (uv.y - peak1Y)*(uv.y - peak1Y);
        float h1 = exp(-6.0 * distSq1) * 0.8;

        // Wave 2
        float peak2X = 0.3 + 0.08 * cos(t * 9.4247 + 1.2);
        float peak2Y = 0.6 + 0.05 * sin(t * 6.2831 + 0.5);
        float distSq2 = (uv.x - peak2X)*(uv.x - peak2X) + (uv.y - peak2Y)*(uv.y - peak2Y);
        float h2 = exp(-8.0 * distSq2) * 0.5;

        // Micro ripples/terrain details using high-frequency waves
        float ripple = 0.09 * sin(uv.x * 26.0 + t * 9.4247) * cos(uv.y * 18.0 + t * 6.2831);
        float rippleFade = 1.0 - clamp(distSq1 * 2.0, 0.0, 1.0);
        
        depth = clamp(h1 + h2 + ripple * rippleFade, 0.0, 1.0);

        // Procedural color mapping: deep purple valley to emerald/cyan peak
        vColor = mix(
          vec3(0.08, 0.06, 0.22), // Valleys
          vec3(0.06, 0.88, 0.65), // Peaks
          depth
        );
        if (depth > 0.7) {
          vColor = mix(vColor, vec3(0.9, 0.95, 1.0), (depth - 0.7) / 0.3); // Snow caps
        }
      } else {
        // Use video texture
        if (uIsDoubleWidth > 0.5) {
          // SBS format: Left half color, Right half depth
          vec2 colorUv = vec2(uv.x * 0.5, uv.y);
          vec2 depthUv = vec2(uv.x * 0.5 + 0.5, uv.y);
          vec4 colorSample = texture2D(uVideoTexture, colorUv);
          vColor = colorSample.rgb;
          depth = texture2D(uVideoTexture, depthUv).r;
        } else {
          // Standard color format (demo.mp4): Full width color, luminance as pseudo-depth
          vec2 colorUv = uv;
          vec4 colorSample = texture2D(uVideoTexture, colorUv);
          vColor = colorSample.rgb;
          // Standard RGB to Grayscale Luminance conversion
          depth = dot(vColor, vec3(0.299, 0.587, 0.114));
        }
      }

      vDepth = depth;

      pos.z -= depth * uDepthScale;

      // Apply 3D simplex noise for organic atmospheric jitter
      // OPTIMIZATION: Calculate noise only once per vertex instead of 3 times to prevent GPU crash
      vec3 noiseInput = vec3(pos.x * 0.5, pos.y * 0.5, uTime * uNoiseSpeed);
      float noiseVal = snoise(noiseInput);
      pos += vec3(
        noiseVal * uNoiseStrength,
        (noiseVal * 0.8) * uNoiseStrength, // Cheap pseudo-random offset based on the same noise value
        (noiseVal * 1.2) * uNoiseStrength  // Cheap pseudo-random offset
      );

      // View space transform
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Depth from camera (view space Z is negative, make positive)
      float cameraDist = -mvPosition.z;

      // Calculate how far the particle is from the focal plane
      float distFromFocus = abs(cameraDist - uFocusDepth);
      
      // Compute blur factor: 0.0 is perfectly in focus, 1.0 is fully out of focus
      vBlur = clamp((distFromFocus - uFocusRange) / max(uFocusRange, 0.1), 0.0, 1.0);

      // NO PERSPECTIVE SCALING: Force particles to stay tiny (like noise) regardless of camera distance
      // We clamp the size so they don't get excessively huge, but allow them to grow based on uPointSize
      gl_PointSize = clamp(uPointSize * (20.0 / max(cameraDist, 1.0)), 1.0, 12.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uHazeColor;
    uniform float uHazeDensity;
    uniform vec3 uTint;
    uniform float uTintMix;
    uniform float uOpacity;
    uniform float uDensityControl; // 0 = standard, 1 = drop out-of-focus particles
    uniform float uTime; // ADDED: time uniform for the sparkling noise effect

    varying vec3 vColor;
    varying float vDepth;
    varying float vBlur;
    varying vec2 vUv;

    // Pseudo-random function based on UV coordinates
    float rand(vec2 co){
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      // Create a soft round particle
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;

      // Calculate luminance (brightness) of the particle's original color
      float luminance = dot(vColor, vec3(0.299, 0.587, 0.114));

      // Dynamic density control: create a harsh, noisy dissolve effect
      if (uDensityControl > 0.05) {
        // Base falloff on blur, BUT ALSO heavily penalize bright areas (luminance)
        // This causes the white sky/background to dissolve into noise, while dark mountain stays dense
        float dropFactor = (pow(vBlur, 0.8) * 0.4) + (pow(luminance, 1.2) * 0.8);
        float threshold = 1.0 - clamp(dropFactor * uDensityControl * 1.5, 0.0, 0.99);
        
        float r = rand(gl_PointCoord + vUv * uTime); // Add time for subtle sparkling
        if (r > threshold) {
          discard;
        }
      }

      // Edge falloff: blurrier particles have softer edges
      float edgeSoftness = 0.05 + vBlur * 0.4;
      float alpha = smoothstep(0.5, 0.5 - edgeSoftness, dist);

      // Fade out particles that are extremely blurred to keep things clean
      alpha *= uOpacity * mix(1.0, 0.15, vBlur);

      // Add atmospheric haze: blend particle color with background haze color based on depth
      // In MiDaS depth, 1 is close, 0 is far.
      // So haze is stronger when vDepth is small (far away).
      float hazeFactor = clamp((1.0 - vDepth) * uHazeDensity, 0.0, 1.0);
      vec3 colorWithHaze = mix(vColor, uHazeColor, hazeFactor);

      // Apply creative color tint
      vec3 finalColor = mix(colorWithHaze, uTint, uTintMix);

      gl_FragColor = vec4(finalColor, alpha);
    }
  `
};
