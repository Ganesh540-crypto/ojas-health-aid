import React from 'react';

// Minimal raw WebGL fragment shader renderer that draws an animated glowing orb
// with smooth orange/yellow/peach gradients (no visible stripes), subtle motion,
// and gentle rim lighting.
// No external deps beyond React. Works in any page.

const frag = `#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_time;

// Hash and noise helpers (iq)
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

// Orange palette tuned to reference: deep orange -> warm orange -> soft peach/yellow
vec3 palette(float t){
  vec3 cDeep = vec3(1.00, 0.58, 0.00);   // ~#FF9400
  vec3 cMid  = vec3(1.00, 0.74, 0.20);   // ~#FFBD33
  vec3 cHi   = vec3(1.00, 0.90, 0.60);   // ~#FFE59A
  return mix(mix(cDeep, cMid, smoothstep(0.0, 0.65, t)), cHi, smoothstep(0.55, 1.0, t));
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float r = length(uv);
  float radius = 0.62;

  // Background tint (very subtle)
  vec3 bg = vec3(0.06, 0.03, 0.01);
  vec3 col = bg;

  // Very soft vignette
  col *= smoothstep(1.2, 0.4, r);

  if(r < radius){
    // Sphere normal (z from sphere equation x^2+y^2+z^2=radius^2)
    float z = sqrt(max(radius*radius - r*r, 0.0));
    vec3 n = normalize(vec3(uv, z));

    // Subtle animated warp to move shades
    vec2 p = uv * 1.6;
    p += 0.10*sin(u_time*0.5 + vec2(0.0, 1.2));
    float f = fbm(p + 1.2*n.xy);

    // Two soft light lobes (bottom-left warm, top-right peach highlight)
    vec3 l1 = normalize(vec3(-0.55, -0.25, 0.75));
    vec3 l2 = normalize(vec3( 0.45,  0.35, 0.85));
    float d1 = clamp(dot(n, l1), 0.0, 1.0);
    float d2 = clamp(dot(n, l2), 0.0, 1.0);

    // Fresnel (very gentle)
    float fres = pow(1.0 - max(n.z, 0.0), 2.2);

    // Shade factor (smooth, no stripes)
    float t = 0.35 + 0.45*d1 + 0.35*d2 + 0.18*f + 0.15*fres;
    t = clamp(t, 0.0, 1.0);
    vec3 shade = palette(t);

    // Edge glow kept soft
    float edge = smoothstep(radius, radius-0.02, r);
    vec3 edgeGlow = vec3(1.0, 0.82, 0.50) * pow(edge, 1.6) * 0.7;

    // Combine
    col = shade + edgeGlow;
  }

  // Final gamma
  col = pow(col, vec3(0.95));
  gl_FragColor = vec4(col, 1.0);
}
`;

const vert = `#ifdef GL_ES
precision highp float;
#endif
attribute vec2 a_position;
void main(){
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

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

export default function GlowingOrb({ className }: { className?: string }){
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if(!gl){
      console.warn('WebGL not supported');
      return;
    }

    const program = createProgram(gl, vert, frag);
    gl.useProgram(program);

    // Fullscreen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const data = new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w*dpr));
      canvas.height = Math.max(1, Math.floor(h*dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let start = performance.now();
    const loop = (t: number) => {
      const time = (t - start) / 1000;
      gl.clearColor(0.02, 0.01, 0.01, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, canvas.width.toFixed ? canvas.width : (canvas as any).width, canvas.height.toFixed ? canvas.height : (canvas as any).height);
      gl.uniform1f(uTime, time);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if(rafRef.current) cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      gl.deleteProgram(program);
      if(buf) gl.deleteBuffer(buf);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height: '100%' }} />;
}
