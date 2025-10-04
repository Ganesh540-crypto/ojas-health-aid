import React from 'react';

// WebGL fragment-shader version of flowing colors: cloud-like multi-shade mixing
// Uses FBM + domain warping + band quantization for crisp transitions.
// Designed to render inside a circular mask (parent sets border-radius/overflow).

export interface FlowingColorsShaderProps {
  className?: string;
  speed?: number;      // overall animation speed
  contrast?: number;   // 0.8 - 1.4 typical
  brightness?: number; // 0.8 - 1.2 typical
  levels?: number;     // 4 - 12 (more = more shade steps)
  warp?: number;       // 0.6 - 2.0 (domain warp strength)
  audioLevel?: number; // 0..1 live reactivity input
}

const frag = `#ifdef GL_ES
precision highp float;
#endif
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_contrast;
uniform float u_brightness;
uniform float u_levels;
uniform float u_warp;
uniform float u_audio;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
}

float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<5;i++){
    v += a*noise(p);
    p = m*p + 0.7;
    a *= 0.5;
  }
  return v;
}

vec3 palette(float t){
  // warm orange range: light -> peach -> golden -> orange -> deep
  vec3 c0 = vec3(1.00, 0.98, 0.93);
  vec3 c1 = vec3(1.00, 0.90, 0.60);
  vec3 c2 = vec3(1.00, 0.80, 0.30);
  vec3 c3 = vec3(1.00, 0.63, 0.10);
  vec3 c4 = vec3(0.95, 0.47, 0.04);
  // multi-step blend
  vec3 col = mix(c0, c1, smoothstep(0.18, 0.35, t));
  col = mix(col, c2, smoothstep(0.35, 0.55, t));
  col = mix(col, c3, smoothstep(0.55, 0.75, t));
  col = mix(col, c4, smoothstep(0.75, 0.95, t));
  return col;
}

void main(){
  vec2 res = u_resolution;
  vec2 uv = (gl_FragCoord.xy - 0.5*res)/min(res.x,res.y); // -0.5..0.5 square
  uv *= 1.3; // zoom

  // base warping: speed is controlled by React via u_speed prop (no audio coupling here)
  float baseSpeed = u_speed;
  float startEase = smoothstep(0.0, 3.5, u_time); // 0 -> 1 over ~3.5s
  float baseSpeedVis = baseSpeed * mix(0.6, 1.0, startEase);
  float t = u_time * baseSpeedVis; // rock-solid motion, eased start
  vec2 p = uv * 2.2;
  // forward advection along a mostly constant direction with slow noise wobble
  vec2 dirBase = normalize(vec2(0.8, 0.45));
  vec2 dir = dirBase; // no directional noise to avoid any backtracking perception
  p += dir * t * 0.12;
  vec2 w = vec2(
    fbm(p + vec2(1.3, 4.2) + t*0.35),
    fbm(p + vec2(-2.7, 0.9) + t*0.28)
  );
  w *= (u_warp * mix(0.85, 1.0, startEase));
  float f1 = fbm(p + 1.9*w + t*0.35 + vec2(0.0, 0.5));
  float f2 = fbm(p*1.7 + 1.1*w + t*0.48 + vec2(0.3, -0.2));
  float f = mix(f1, f2, 0.58);

  // quantize to create crisp shade boundaries (band-limited to avoid flicker)
  float levels = max(2.0, u_levels);
  float dither = (hash(gl_FragCoord.xy) - 0.5) * 0.003; // minimal dither for smooth bands
  float q = floor((f + dither) * levels) / levels;

  // additional detail overlay, and mix quantized with continuous field to prevent temporal jitter
  float detail = fbm(p*3.0 + w*1.0 + t*0.28) * 0.14;
  float quantMix = 0.58; // fixed to avoid audio-driven band jitter
  float v = clamp(mix(f, q, quantMix) + detail, 0.0, 1.0);

  // map to warm palette
  vec3 col = palette(v);

  // apply contrast/brightness
  col = (col - 0.5) * u_contrast + 0.5;
  col *= u_brightness;

  // microstructure (noise-based to avoid oscillation)
  float micro = 0.99 + 0.01*noise(uv*10.0 + t*0.18);
  col *= micro;

  gl_FragColor = vec4(col, 1.0);
}
`;

const vert = `#ifdef GL_ES
precision highp float;
#endif
attribute vec2 a_position;
void main(){ gl_Position = vec4(a_position, 0.0, 1.0); }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string){
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    throw new Error('Shader compile failed');
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string){
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
    console.error('Program link error:', gl.getProgramInfoLog(program));
    throw new Error('Program link failed');
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

export default function FlowingColorsShader({ className, speed = 1.0, contrast = 1.05, brightness = 1.0, levels = 8, warp = 1.4, audioLevel = 0 }: FlowingColorsShaderProps){
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const audioRef = React.useRef<number>(audioLevel);
  React.useEffect(() => { audioRef.current = audioLevel; }, [audioLevel]);
  // Uniform value refs to avoid tearing down WebGL on prop updates
  const speedRef = React.useRef<number>(speed);
  const contrastRef = React.useRef<number>(contrast);
  const brightnessRef = React.useRef<number>(brightness);
  const levelsRef = React.useRef<number>(levels);
  const warpRef = React.useRef<number>(warp);
  React.useEffect(() => { speedRef.current = speed; }, [speed]);
  React.useEffect(() => { contrastRef.current = contrast; }, [contrast]);
  React.useEffect(() => { brightnessRef.current = brightness; }, [brightness]);
  React.useEffect(() => { levelsRef.current = levels; }, [levels]);
  React.useEffect(() => { warpRef.current = warp; }, [warp]);

  React.useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if(!gl){ console.warn('WebGL not supported'); return; }

    const program = createProgram(gl, vert, frag);
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uSpeed = gl.getUniformLocation(program, 'u_speed');
    const uContrast = gl.getUniformLocation(program, 'u_contrast');
    const uBrightness = gl.getUniformLocation(program, 'u_brightness');
    const uLevels = gl.getUniformLocation(program, 'u_levels');
    const uWarp = gl.getUniformLocation(program, 'u_warp');
    const uAudio = gl.getUniformLocation(program, 'u_audio');

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w*dpr));
      canvas.height = Math.max(1, Math.floor(h*dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let start = performance.now();
    const loop = (tt: number) => {
      const time = (tt - start) / 1000;
      gl.clearColor(1,1,1,1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uSpeed, speedRef.current);
      gl.uniform1f(uContrast, contrastRef.current);
      gl.uniform1f(uBrightness, brightnessRef.current);
      gl.uniform1f(uLevels, levelsRef.current);
      gl.uniform1f(uWarp, warpRef.current);
      // Soften low-level reactivity to avoid jitter at idle noise
      const a = Math.max(0, Math.min(1, audioRef.current || 0));
      const eased = Math.pow(a, 1.5);
      gl.uniform1f(uAudio, eased);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if(rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      gl.deleteProgram(program);
      if(buf) gl.deleteBuffer(buf);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height: '100%' }} />;
}
