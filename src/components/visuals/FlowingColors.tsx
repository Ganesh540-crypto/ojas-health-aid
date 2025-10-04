import React from 'react';

// 2D Canvas flowing colors renderer (no dependencies)
// Draws multiple blurred radial gradients that move over time and blend additively
// to create a smooth orange/yellow/peach "flow".

export interface FlowingColorsProps {
  className?: string;
  speed?: number; // 0.5 - 2 typical
  blur?: number;  // px
  alpha?: number; // 0-1 intensity per gradient
  palette?: string[]; // hex strings
  blobs?: number; // number of moving sources (default 8)
}

const defaultPalette = ['#FF5C00', '#FF6A00', '#FF8A00', '#FFA000', '#FFC107', '#FFD447', '#FFE08A', '#FFF1CC'];

export default function FlowingColors({ className, speed = 1, blur = 40, alpha = 0.7, palette = defaultPalette, blobs = 8 }: FlowingColorsProps){
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;

    // --- Build a tileable rough noise pattern to add texture/roughness ---
    const noise = document.createElement('canvas');
    noise.width = noise.height = 256;
    const nctx = noise.getContext('2d')!;
    nctx.clearRect(0,0,256,256);
    // Base fill
    nctx.fillStyle = 'rgba(0,0,0,0)';
    nctx.fillRect(0,0,256,256);
    // Multi-layer blotches (dark and light) for rough texture
    const drawBlotches = (count: number, dark = true) => {
      for (let i = 0; i < count; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const r = 6 + Math.random() * 32;
        const a = dark ? (0.06 + Math.random() * 0.08) : (0.04 + Math.random() * 0.08);
        const col = dark ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
        const g = nctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        nctx.fillStyle = g;
        nctx.beginPath();
        nctx.arc(x, y, r, 0, Math.PI * 2);
        nctx.fill();
      }
    };
    drawBlotches(220, true);
    drawBlotches(220, false);
    // Add a few rough strokes
    nctx.globalCompositeOperation = 'multiply';
    nctx.strokeStyle = 'rgba(0,0,0,0.04)';
    nctx.lineWidth = 1.2;
    for (let i = 0; i < 28; i++) {
      nctx.beginPath();
      const x1 = Math.random() * 256;
      const y1 = Math.random() * 256;
      const x2 = x1 + (Math.random() * 60 - 30);
      const y2 = y1 + (Math.random() * 60 - 30);
      nctx.moveTo(x1, y1);
      nctx.lineTo(x2, y2);
      nctx.stroke();
    }
    nctx.globalCompositeOperation = 'source-over';
    const noisePattern = ctx.createPattern(noise, 'repeat');

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const start = performance.now();

    const draw = (t: number) => {
      const time = (t - start) / 1000 * speed;
      const { width: W, height: H } = canvas;
      ctx.clearRect(0, 0, W, H);
      // Warm base tint helps preserve saturation on white backgrounds
      ctx.fillStyle = 'rgba(255, 240, 210, 0.16)';
      ctx.fillRect(0, 0, W, H);

      // Optional background tint as very dark warm tone
      // ctx.fillStyle = '#0a0704';
      // ctx.fillRect(0, 0, W, H);

      // Base pass: source-over to preserve multi-tone differences
      ctx.globalCompositeOperation = 'source-over';
      const baseBlur = Math.max(1, Math.floor(blur * 0.25));
      ctx.filter = `blur(${baseBlur}px)`;

      // Compute centers moving over time
      const cx = W * 0.5;
      const cy = H * 0.5;
      const rBase = Math.hypot(W, H) * 0.42; // base radius (slightly smaller to reduce flat center)

      // Multiple asynchronous blobs following Lissajous-like paths
      const count = Math.max(1, blobs);
      // Global drift so the whole field gently moves and avoids a static center
      const gdx = Math.cos(time * 0.20) * (W * 0.05);
      const gdy = Math.sin(time * 0.17) * (H * 0.05);
      for (let i = 0; i < count; i++) {
        const col = palette[i % palette.length];
        // Amplitudes and phase per blob (avoid symmetry)
        const ax = 0.30 + 0.22 * ((i * 1.37) % 1);
        const ay = 0.26 + 0.22 * ((i * 0.91) % 1);
        const px = i * 0.87;
        const py = i * 1.19 + 0.6;
        const x = cx + Math.cos(time * (0.9 + 0.08 * i) + px) * (W * ax) + gdx;
        const y = cy + Math.sin(time * (0.75 + 0.06 * i) + py) * (H * ay) + gdy;
        const rad = rBase * (0.66 + 0.30 * Math.sin(time * (0.58 + 0.04 * i) + i * 1.11));

        // Elliptical orientation per blob for silk folds
        const rot = Math.sin(time * (0.22 + 0.02 * i) + i) * 1.1;
        const sx = 1.0 + 0.65 * Math.sin(time * (0.28 + 0.02 * i) + i * 0.7);
        const sy = 1.0 + 0.30 * Math.cos(time * (0.24 + 0.015 * i) + i * 0.3);
        // Per-blob alpha modulation for subtle pulsation
        const aMod = Math.max(0.0, Math.min(1.0, alpha * (0.82 + 0.26 * Math.sin(time * (0.9 + 0.05 * i) + i * 1.3))));

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.scale(sx, sy);

        const colB = palette[(i + 1) % palette.length];
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
        grad.addColorStop(0.00, hexWithAlpha(col, aMod));
        grad.addColorStop(0.18, mixHexToRgba(col, colB, 0.5, aMod * 0.85));
        grad.addColorStop(0.38, hexWithAlpha(colB, aMod * 0.65));
        grad.addColorStop(0.70, mixHexToRgba(colB, '#FFFFFF', 0.6, aMod * 0.22));
        grad.addColorStop(1.00, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;

        // Rough-edged polygonal blob
        const seg = 96;
        const roughBase = 0.20 + 0.06 * Math.sin(time * (0.25 + 0.02 * i) + i);
        const rough = Math.max(0.14, Math.min(0.28, roughBase)); // dynamic roughness
        ctx.beginPath();
        for (let k = 0; k <= seg; k++) {
          const th = (k / seg) * Math.PI * 2;
          const jitter = (
            0.55 * Math.sin(th * 3.0 + time * (0.9 + 0.03 * i) + i) +
            0.30 * Math.sin(th * 7.0 + time * (1.4 + 0.02 * i) + i * 0.7) +
            0.15 * Math.sin(th * 13.0 + time * (2.0 + 0.01 * i) + i * 1.3)
          );
          const rr = rad * (1.0 + rough * jitter);
          const px2 = rr * Math.cos(th);
          const py2 = rr * Math.sin(th);
          if (k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
        }
        ctx.closePath();
        ctx.fill();
        // Edge strokes for crisp boundaries
        const lw = Math.max(0.8, Math.min(W, H) * 0.0030);
        ctx.globalCompositeOperation = 'hard-light';
        ctx.filter = 'none';
        ctx.lineWidth = lw;
        ctx.strokeStyle = mixHexToRgba(col, '#FFFFFF', 0.65, 0.35);
        ctx.stroke();
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.stroke();
        ctx.restore();
      }

      // --- Silk-like elliptical highlights and folds ---
      // Soft peach sheen (elliptical)
      ctx.save();
      ctx.translate(
        cx + Math.cos(time * 0.42) * (W * 0.10),
        cy - Math.sin(time * 0.35) * (H * 0.08)
      );
      ctx.rotate(Math.sin(time * 0.20) * 0.25);
      ctx.scale(1.6, 1.0);
      {
        const r = rBase * 0.90;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0.0, hexWithAlpha('#FFF4D6', alpha * 0.55));
        g.addColorStop(0.6, hexWithAlpha('#FFE9BD', alpha * 0.18));
        g.addColorStop(1.0, hexWithAlpha('#FFF4D6', 0));
        ctx.fillStyle = g;
        ctx.fillRect(-W, -H, W * 2, H * 2);
      }
      ctx.restore();

      // Warm yellow fold
      ctx.save();
      ctx.translate(
        cx + Math.cos(time * 0.55 + 1.2) * (W * 0.18),
        cy + Math.sin(time * 0.48 + 0.6) * (H * 0.22)
      );
      ctx.rotate(Math.sin(time * 0.15 + 0.5) * 0.35);
      ctx.scale(1.8, 0.85);
      {
        const r = rBase * 0.80;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0.0, hexWithAlpha('#FFE96A', alpha * 0.50));
        g.addColorStop(0.7, hexWithAlpha('#FFD658', alpha * 0.22));
        g.addColorStop(1.0, hexWithAlpha('#FFE96A', 0));
        ctx.fillStyle = g;
        ctx.fillRect(-W, -H, W * 2, H * 2);
      }
      ctx.restore();

      // Orange lobe enrichment
      ctx.save();
      ctx.translate(
        cx - Math.cos(time * 0.36 + 0.8) * (W * 0.22),
        cy + Math.sin(time * 0.44 + 1.1) * (H * 0.18)
      );
      ctx.rotate(Math.sin(time * 0.12 + 1.4) * 0.20);
      ctx.scale(1.25, 1.15);
      {
        const r = rBase * 0.88;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0.0, hexWithAlpha('#FFA54A', alpha * 0.50));
        g.addColorStop(0.65, hexWithAlpha('#FF9C33', alpha * 0.22));
        g.addColorStop(1.0, hexWithAlpha('#FFA54A', 0));
        ctx.fillStyle = g;
        ctx.fillRect(-W, -H, W * 2, H * 2);
      }
      ctx.restore();

      // Subtle dynamic shading overlays to prevent static bright center
      // Draw two moving soft dark lobes in multiply mode
      ctx.globalCompositeOperation = 'multiply';
      const shadeBlur = Math.max(8, blur * 0.5);
      ctx.filter = `blur(${shadeBlur}px)`;
      ctx.save();
      const sx2 = cx + Math.cos(time * 0.33 + 2.1) * (W * 0.12);
      const sy2 = cy + Math.sin(time * 0.29 + 1.3) * (H * 0.10);
      ctx.translate(sx2, sy2);
      ctx.rotate(Math.sin(time * 0.2) * 0.15);
      ctx.scale(1.3, 1.0);
      {
        const r = rBase * 0.85;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0.0, 'rgba(0,0,0,0.09)');
        g.addColorStop(0.6, 'rgba(0,0,0,0.04)');
        g.addColorStop(1.0, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-W, -H, W * 2, H * 2);
      }
      ctx.restore();

      // Second shading lobe
      ctx.save();
      const sx3 = cx + Math.cos(time * 0.27 + 0.8) * (W * 0.10);
      const sy3 = cy + Math.sin(time * 0.23 + 2.5) * (H * 0.12);
      ctx.translate(sx3, sy3);
      ctx.rotate(Math.sin(time * 0.18 + 0.7) * 0.2);
      ctx.scale(1.0, 1.4);
      {
        const r = rBase * 0.80;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0.0, 'rgba(0,0,0,0.08)');
        g.addColorStop(0.7, 'rgba(0,0,0,0.035)');
        g.addColorStop(1.0, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-W, -H, W * 2, H * 2);
      }
      ctx.restore();

      // Bright highlight glaze on top (overlay)
      ctx.globalCompositeOperation = 'overlay';
      const hiBlur = Math.max(6, blur * 0.4);
      ctx.filter = `blur(${hiBlur}px)`;
      ctx.save();
      ctx.translate(cx - Math.cos(time * 0.31) * (W * 0.08), cy - Math.sin(time * 0.27) * (H * 0.06));
      ctx.rotate(Math.sin(time * 0.14) * 0.25);
      ctx.scale(1.6, 1.2);
      {
        const r = rBase * 0.95;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0.0, 'rgba(255,252,235,0.42)');
        g.addColorStop(0.7, 'rgba(255,252,235,0.12)');
        g.addColorStop(1.0, 'rgba(255,252,235,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-W, -H, W * 2, H * 2);
      }
      ctx.restore();

      // Vibrant flowing ribbons using color-dodge for distinct shade differences
      ctx.globalCompositeOperation = 'color-dodge';
      const ribBlur = Math.max(2, blur * 0.25);
      ctx.filter = `blur(${ribBlur}px)`;

      const drawRibbon = (angle: number, phase: number, strength = 0.35, c1 = '255,210,90', c2 = '255,180,60') => {
        ctx.save();
        ctx.translate(cx + Math.cos(time * 0.22 + phase) * (W * 0.06), cy + Math.sin(time * 0.18 + phase) * (H * 0.06));
        ctx.rotate(angle + Math.sin(time * 0.12 + phase) * 0.15);
        const w = W * 1.6;
        const h = H * 0.6;
        const lg = ctx.createLinearGradient(-w/2, 0, w/2, 0);
        lg.addColorStop(0.0, `rgba(${c1},0)`);
        lg.addColorStop(0.42, `rgba(${c1},${strength})`);
        lg.addColorStop(0.58, `rgba(${c2},${strength * 0.95})`);
        lg.addColorStop(1.0, `rgba(${c2},0)`);
        ctx.fillStyle = lg;
        ctx.fillRect(-w/2, -h/2, w, h);
        ctx.restore();
      };

      drawRibbon(Math.PI * 0.15, 0.0, 0.32, '255,210,90', '255,180,60');
      drawRibbon(-Math.PI * 0.28, 1.1, 0.28, '255,190,70', '255,160,50');
      drawRibbon(Math.PI * 0.42, 0.55, 0.24, '255,230,160', '255,210,120');
      drawRibbon(-Math.PI * 0.05, 1.85, 0.22, '255,200,80', '255,170,60');

      // Extra sharp ribbons (thin, hard-light) for crisper transitions
      ctx.globalCompositeOperation = 'hard-light';
      const sharpBlur = Math.max(1, Math.floor(blur * 0.12));
      ctx.filter = `blur(${sharpBlur}px)`;
      const drawSharpRibbon = (angle: number, phase: number, strength = 0.22) => {
        ctx.save();
        ctx.translate(cx + Math.cos(time * 0.28 + phase) * (W * 0.05), cy + Math.sin(time * 0.23 + phase) * (H * 0.05));
        ctx.rotate(angle + Math.sin(time * 0.15 + phase) * 0.18);
        const w = W * 1.2;
        const h = Math.max(4, H * 0.08); // narrower for crisper edges
        const lg = ctx.createLinearGradient(-w/2, 0, w/2, 0);
        lg.addColorStop(0.0, 'rgba(255, 200, 90, 0)');
        lg.addColorStop(0.48, `rgba(255, 180, 60, ${strength})`);
        lg.addColorStop(0.52, `rgba(255, 240, 200, ${strength * 0.8})`);
        lg.addColorStop(1.0, 'rgba(255, 200, 90, 0)');
        ctx.fillStyle = lg;
        ctx.fillRect(-w/2, -h/2, w, h);
        ctx.restore();
      };
      drawSharpRibbon(Math.PI * 0.12, 0.35, 0.24);
      drawSharpRibbon(-Math.PI * 0.22, 1.45, 0.20);
      drawSharpRibbon(Math.PI * 0.33, 2.10, 0.18);
      drawSharpRibbon(-Math.PI * 0.05, 0.95, 0.16);

      // Dynamic edge warmth ring (soft-light) to increase tonal contrast
      ctx.globalCompositeOperation = 'soft-light';
      const edgeBlur = Math.max(6, blur * 0.35);
      ctx.filter = `blur(${edgeBlur}px)`;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(time * 0.1) * 0.08);
      {
        const rOuter = Math.hypot(W, H) * 0.52;
        const rInner = rOuter * (0.62 + 0.06 * Math.sin(time * 0.22));
        const g = ctx.createRadialGradient(0, 0, rInner, 0, 0, rOuter);
        g.addColorStop(0.0, 'rgba(255,190,80,0.18)');
        g.addColorStop(0.8, 'rgba(255,170,60,0.10)');
        g.addColorStop(1.0, 'rgba(255,170,60,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-W, -H, W * 2, H * 2);
      }
      ctx.restore();

      // Rough noise overlay to break smoothness and add texture
      ctx.globalCompositeOperation = 'overlay';
      ctx.filter = 'none';
      ctx.globalAlpha = 0.22;
      ctx.save();
      // Drift the pattern slowly
      ctx.translate((time * 18) % 256, (time * 14) % 256);
      if (noisePattern) {
        ctx.fillStyle = noisePattern;
        ctx.fillRect(-256, -256, W + 512, H + 512);
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // reset
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if(rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [speed, blur, alpha, blobs, JSON.stringify(palette)]);

  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height: '100%' }} />;
}

function hexWithAlpha(hex: string, a: number){
  // Accepts #RRGGBB or #RGB; returns rgba()
  let r = 255, g = 255, b = 255;
  const s = hex.replace('#','');
  if (s.length === 3) {
    r = parseInt(s[0]+s[0], 16);
    g = parseInt(s[1]+s[1], 16);
    b = parseInt(s[2]+s[2], 16);
  } else if (s.length >= 6) {
    r = parseInt(s.slice(0,2), 16);
    g = parseInt(s.slice(2,4), 16);
    b = parseInt(s.slice(4,6), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`;
}

function hexToRgb(hex: string): { r: number, g: number, b: number } {
  const s = hex.replace('#','');
  let r = 255, g = 255, b = 255;
  if (s.length === 3) {
    r = parseInt(s[0]+s[0], 16);
    g = parseInt(s[1]+s[1], 16);
    b = parseInt(s[2]+s[2], 16);
  } else if (s.length >= 6) {
    r = parseInt(s.slice(0,2), 16);
    g = parseInt(s.slice(2,4), 16);
    b = parseInt(s.slice(4,6), 16);
  }
  return { r, g, b };
}

function mixHexToRgba(hexA: string, hexB: string, t: number, alpha: number) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(a.r + (b.r - a.r) * k);
  const g = Math.round(a.g + (b.g - a.g) * k);
  const bch = Math.round(a.b + (b.b - a.b) * k);
  const aOut = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${bch}, ${aOut})`;
}
