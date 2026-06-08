import { useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";

// ── Utilities ─────────────────────────────────────────────────────────────────
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  if (clean.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(255,255,255,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Star { x: number; y: number; r: number; opacity: number; speed: number; drift: number; twinkleSpeed: number; twinklePhase: number; color: string; }
interface ShootingStar { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; }
interface Nebula { x: number; y: number; rx: number; ry: number; color: string; opacity: number; pulse: number; pulseSpeed: number; }
interface Orb { x: number; y: number; r: number; color: string; opacity: number; floatAngle: number; floatSpeed: number; }
interface Petal { x: number; y: number; r: number; vx: number; vy: number; rot: number; rotSpeed: number; sway: number; swaySpeed: number; swayPhase: number; opacity: number; color: string; }
interface Ember { x: number; y: number; r: number; vx: number; vy: number; life: number; maxLife: number; color: string; }
interface DataDrop { x: number; y: number; chars: string[]; speed: number; opacity: number; length: number; }
interface GrassBlade { x: number; baseY: number; height: number; width: number; swayAmp: number; swaySpeed: number; swayPhase: number; color: string; }
interface Firefly { x: number; y: number; r: number; pulsePhase: number; pulseSpeed: number; vx: number; vy: number; wanderPhase: number; opacity: number; }
interface Leaf { x: number; y: number; r: number; vx: number; vy: number; rot: number; rotSpeed: number; swayPhase: number; swayAmp: number; swaySpeed: number; opacity: number; color: string; }
interface Pollen { x: number; y: number; r: number; vx: number; vy: number; floatPhase: number; floatSpeed: number; opacity: number; }
interface Butterfly {
  x: number; y: number;
  vx: number; vy: number;
  wanderPhase: number; wanderSpeed: number;
  wingPhase: number; wingSpeed: number;    // controls flap animation
  size: number;                            // wingspan radius
  colorTop: string;                        // upper wing color
  colorBottom: string;                     // lower wing color
  opacity: number;
  trail: Array<{ x: number; y: number; a: number }>; // sparkle trail
}
interface Wisp { x: number; y: number; r: number; vx: number; vy: number; floatPhase: number; floatSpeed: number; opacity: number; color: string; }

// ── Constants ────────────────────────────────────────────────────────────────
const KATAKANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノ01010110100";
const SAKURA_COLORS = ["#FFB7C5", "#FF8FAB", "#FFC0CB", "#FFD1DC", "#FF9EAF", "#FFAABB"];
const CYBER_NEON = ["#00FFFF", "#00FF41", "#FFFF00", "#39FF14", "#7FFF00", "#00E5FF"];
const RETRO_COLORS = ["#FF6B6B", "#FFE66D", "#4ECDC4", "#A8E6CF", "#FF8B94", "#C7F464"];

// ─────────────────────────────────────────────────────────────────────────────
//  THEME CANVASES
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. ANTIGRAVITY — Deep space starfield, nebula blobs, shooting stars ───────
function drawAntigravity(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  stars: Star[], shooting: ShootingStar[], nebula: Nebula[], orbs: Orb[],
  parallaxX: number, parallaxY: number,
  ts: number, lastShoot: React.MutableRefObject<number>,
  spawnShoot: () => void
) {
  ctx.clearRect(0, 0, w, h);

  // Nebula
  for (const n of nebula) {
    n.pulse += n.pulseSpeed;
    const op = n.opacity + Math.sin(n.pulse) * 0.03;
    const grad = ctx.createRadialGradient(n.x + parallaxX * 0.3, n.y + parallaxY * 0.3, 0, n.x + parallaxX * 0.3, n.y + parallaxY * 0.3, n.rx);
    grad.addColorStop(0, `${n.color}${op})`);
    grad.addColorStop(0.6, `${n.color}${op * 0.4})`);
    grad.addColorStop(1, `${n.color}0)`);
    ctx.save(); ctx.scale(1, n.ry / n.rx);
    ctx.fillStyle = grad; ctx.beginPath();
    ctx.arc(n.x + parallaxX * 0.3, (n.y + parallaxY * 0.3) * (n.rx / n.ry), n.rx, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();
  }

  // Orbs
  for (const orb of orbs) {
    orb.floatAngle += orb.floatSpeed;
    const fx = orb.x + Math.cos(orb.floatAngle) * 40 + parallaxX * 0.15;
    const fy = orb.y + Math.sin(orb.floatAngle * 0.7) * 30 + parallaxY * 0.15;
    const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, orb.r);
    grad.addColorStop(0, `rgba(${orb.color},${orb.opacity})`);
    grad.addColorStop(0.5, `rgba(${orb.color},${orb.opacity * 0.4})`);
    grad.addColorStop(1, `rgba(${orb.color},0)`);
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(fx, fy, orb.r, 0, Math.PI * 2); ctx.fill();
  }

  // Stars
  for (const s of stars) {
    s.y -= s.speed; s.x += s.drift * 0.3;
    if (s.y < -5) { s.y = h + 5; s.x = rand(0, w); }
    if (s.x < -5) s.x = w + 5;
    if (s.x > w + 5) s.x = -5;
    s.twinklePhase += s.twinkleSpeed;
    const twinkle = 0.5 + 0.5 * Math.sin(s.twinklePhase);
    const finalOp = s.opacity * (0.4 + 0.6 * twinkle);
    const px = s.x + parallaxX * (s.r / 2.8) * 0.8;
    const py = s.y + parallaxY * (s.r / 2.8) * 0.8;
    if (s.r > 1.5 && twinkle > 0.7) {
      const glow = ctx.createRadialGradient(px, py, 0, px, py, s.r * 4);
      glow.addColorStop(0, hexToRgba(s.color, finalOp * 0.3));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, s.r * 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = s.color; ctx.globalAlpha = finalOp;
    ctx.beginPath(); ctx.arc(px, py, s.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Shooting stars
  if (ts - lastShoot.current > rand(2000, 5000)) { spawnShoot(); lastShoot.current = ts; }
  for (let i = shooting.length - 1; i >= 0; i--) {
    const ss = shooting[i]; ss.x += ss.vx; ss.y += ss.vy; ss.life++;
    if (ss.life >= ss.maxLife) { shooting.splice(i, 1); continue; }
    const prog = ss.life / ss.maxLife;
    const alpha = Math.min(prog * 5, 1) * (1 - prog) * 0.9;
    const tailLen = ss.life * 2.5;
    const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.vx * tailLen * 0.4, ss.y - ss.vy * tailLen * 0.4);
    grad.addColorStop(0, `${ss.color}${alpha})`);
    grad.addColorStop(1, `${ss.color}0)`);
    ctx.strokeStyle = grad; ctx.lineWidth = 1.5 * (1 - prog * 0.5);
    ctx.beginPath(); ctx.moveTo(ss.x, ss.y);
    ctx.lineTo(ss.x - ss.vx * tailLen * 0.4, ss.y - ss.vy * tailLen * 0.4); ctx.stroke();
    ctx.globalAlpha = alpha; ctx.fillStyle = `${ss.color}${alpha})`;
    ctx.beginPath(); ctx.arc(ss.x, ss.y, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
}

// ── 2. CYBERPUNK — Neon cyan/green grid + data rain + electric particles ─────
function initCyberpunk(w: number, h: number, drops: DataDrop[]) {
  drops.length = 0;
  const cols = Math.floor(w / 18);
  for (let i = 0; i < cols; i++) {
    drops.push({
      x: i * 18 + 9,
      y: rand(-h, 0),
      chars: Array.from({ length: randInt(6, 20) }, () => KATAKANA[randInt(0, KATAKANA.length - 1)]),
      speed: rand(1.5, 5),
      opacity: rand(0.15, 0.55),
      length: randInt(6, 20),
    });
  }
}

function drawCyberpunk(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  drops: DataDrop[], stars: Star[], ts: number
) {
  ctx.clearRect(0, 0, w, h);
  const t = ts * 0.001;

  // ── Neon cyan grid ──────────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(0,255,255,0.055)";
  ctx.lineWidth = 0.5;
  const gridSize = 55;
  for (let x = 0; x < w; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // ── Moving horizontal neon scan line (cyan) ─────────────────────────────────
  const scanY = ((t * 90) % (h + 40)) - 20;
  const scanGrad = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8);
  scanGrad.addColorStop(0, "rgba(0,255,255,0)");
  scanGrad.addColorStop(0.5, "rgba(0,255,255,0.11)");
  scanGrad.addColorStop(1, "rgba(0,255,255,0)");
  ctx.fillStyle = scanGrad; ctx.fillRect(0, scanY - 8, w, 16);

  // ── Second scan line (green) offset ──────────────────────────────────────────
  const scanY2 = ((t * 55 + h * 0.5) % (h + 40)) - 20;
  const scanGrad2 = ctx.createLinearGradient(0, scanY2 - 5, 0, scanY2 + 5);
  scanGrad2.addColorStop(0, "rgba(0,255,65,0)");
  scanGrad2.addColorStop(0.5, "rgba(0,255,65,0.07)");
  scanGrad2.addColorStop(1, "rgba(0,255,65,0)");
  ctx.fillStyle = scanGrad2; ctx.fillRect(0, scanY2 - 5, w, 10);

  // ── Neon corner HUD brackets (cyan) ─────────────────────────────────────────
  const bSize = 44; const bW = 2;
  ctx.strokeStyle = "rgba(0,255,255,0.45)"; ctx.lineWidth = bW;
  ([[30, 30, 1, 1], [w - 30, 30, -1, 1], [30, h - 30, 1, -1], [w - 30, h - 30, -1, -1]] as number[][]).forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(cx, cy + sy * bSize); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * bSize, cy); ctx.stroke();
  });
  // Inner tick marks (electric green)
  ctx.strokeStyle = "rgba(57,255,20,0.35)"; ctx.lineWidth = 1;
  ([[30, 30, 1, 1], [w - 30, 30, -1, 1], [30, h - 30, 1, -1], [w - 30, h - 30, -1, -1]] as number[][]).forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(cx + sx * 10, cy); ctx.lineTo(cx + sx * 20, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + sy * 10); ctx.lineTo(cx, cy + sy * 20); ctx.stroke();
  });

  // ── Data rain — cyan head, electric-green trail (NO pink) ────────────────────
  ctx.font = "bold 13px 'Courier New', monospace";
  for (const drop of drops) {
    drop.y += drop.speed;
    if (drop.y > h + drop.length * 15) {
      drop.y = rand(-200, -50);
      drop.chars = Array.from({ length: randInt(6, 20) }, () => KATAKANA[randInt(0, KATAKANA.length - 1)]);
    }
    for (let j = 0; j < drop.chars.length; j++) {
      const cy = drop.y - j * 15;
      if (cy < 0 || cy > h) continue;
      const alpha = j === 0 ? Math.min(drop.opacity * 2.0, 1) : drop.opacity * (1 - j / drop.chars.length);
      // Lead: bright white-cyan | Mid: pure cyan | Trail: electric green
      const color = j === 0
        ? `rgba(220,255,255,${alpha})`
        : j < 3
          ? `rgba(0,255,255,${Math.min(alpha, 1)})`
          : `rgba(0,255,65,${Math.min(alpha * 0.75, 1)})`;
      ctx.fillStyle = color;
      ctx.fillText(drop.chars[j], drop.x - 6, cy);
    }
  }

  // ── Neon floating particles — cyan, green, yellow ONLY ───────────────────────
  for (const s of stars) {
    s.y += s.speed * 0.5;
    s.x += Math.sin(t * 1.2 + s.twinklePhase) * 0.5;
    if (s.y > h + 5) { s.y = -5; s.x = rand(0, w); }
    s.twinklePhase += s.twinkleSpeed;
    const pulse = 0.45 + 0.55 * Math.abs(Math.sin(s.twinklePhase));
    // Outer soft neon halo
    const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 9);
    halo.addColorStop(0, hexToRgba(s.color, pulse * 0.18));
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 9, 0, Math.PI * 2); ctx.fill();
    // Inner bright core glow
    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3);
    glow.addColorStop(0, hexToRgba(s.color, pulse * 0.85));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2); ctx.fill();
    // Solid dot
    ctx.fillStyle = s.color; ctx.globalAlpha = pulse;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── Electric spark bolts (cyan/green/yellow, never pink) ─────────────────────
  const sparkColors = ["rgba(0,255,255,", "rgba(57,255,20,", "rgba(255,255,0,", "rgba(0,229,255,"];
  if (Math.random() < 0.02) {
    const ex = rand(0, w); const ey = rand(0, h);
    const sc = sparkColors[randInt(0, sparkColors.length - 1)];
    ctx.strokeStyle = `${sc}${rand(0.4, 0.85)})`; ctx.lineWidth = rand(0.8, 1.8);
    ctx.shadowColor = sc + "0.9)"; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(ex, ey);
    for (let k = 0; k < 5; k++) { ctx.lineTo(ex + rand(-28, 28), ey + rand(-28, 28)); }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ── Ambient neon glow pools (cyan + green, zero pink) ─────────────────────────
  for (let i = 0; i < 3; i++) {
    const gx = (Math.sin(t * 0.12 + i * 2.1) * 0.35 + 0.5) * w;
    const gy = (Math.cos(t * 0.09 + i * 1.7) * 0.3 + 0.5) * h;
    const gr = rand(80, 180);
    const gc = i === 0 ? "rgba(0,255,255," : i === 1 ? "rgba(57,255,20," : "rgba(0,229,255,";
    const pool = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    pool.addColorStop(0, `${gc}0.06)`);
    pool.addColorStop(1, `${gc}0)`);
    ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();
  }
}

// ── 3. SAKURA — Falling cherry blossom petals ────────────────────────────────
function initSakura(w: number, h: number, petals: Petal[]) {
  petals.length = 0;
  for (let i = 0; i < 80; i++) {
    petals.push({
      x: rand(0, w), y: rand(-h, h),
      r: rand(4, 10),
      vx: rand(-0.6, 0.6), vy: rand(0.6, 2.2),
      rot: rand(0, Math.PI * 2), rotSpeed: rand(-0.025, 0.025),
      sway: rand(8, 24), swaySpeed: rand(0.006, 0.02),
      swayPhase: rand(0, Math.PI * 2),
      opacity: rand(0.4, 0.9),
      color: SAKURA_COLORS[randInt(0, SAKURA_COLORS.length - 1)],
    });
  }
}

/** Draw a proper cherry blossom flower with 5 heart-shaped bezier petals + stamens */
function drawFlower(ctx: CanvasRenderingContext2D, p: Petal) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = p.opacity;

  const r = p.r;
  const petals = 5;

  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.rotate(angle);

    // Heart-shaped petal using two bezier curves
    // Tip at (0, -r*1.1), wide at sides
    const tipY = -r * 1.15;
    const midY = -r * 0.3;
    const baseY = 0;
    const halfW = r * 0.62;

    // Gradient fill for each petal — lighter at tip, darker at base
    const pg = ctx.createLinearGradient(0, tipY, 0, baseY);
    pg.addColorStop(0, p.color + "ee");
    pg.addColorStop(1, p.color + "88");
    ctx.fillStyle = pg;

    ctx.beginPath();
    ctx.moveTo(0, baseY);
    // Left side of petal
    ctx.bezierCurveTo(-halfW, midY, -halfW * 0.6, tipY + r * 0.18, 0, tipY);
    // Right side of petal
    ctx.bezierCurveTo(halfW * 0.6, tipY + r * 0.18, halfW, midY, 0, baseY);
    ctx.closePath();
    ctx.fill();

    // Petal edge highlight
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Petal notch at tip (classic sakura detail)
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(0, tipY + r * 0.08, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Center disk ──────────────────────────────────────────────────────────────
  const centerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.28);
  centerGrad.addColorStop(0, "#FFF0F5");
  centerGrad.addColorStop(1, "#FFD1DC");
  ctx.fillStyle = centerGrad;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2); ctx.fill();

  // ── Stamens (tiny yellow dots radiating out) ─────────────────────────────────
  const stamenCount = 8;
  for (let s = 0; s < stamenCount; s++) {
    const sa = (s / stamenCount) * Math.PI * 2;
    const sx = Math.cos(sa) * r * 0.52;
    const sy = Math.sin(sa) * r * 0.52;
    // Stamen stem
    ctx.strokeStyle = "rgba(255,220,100,0.55)";
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sx, sy); ctx.stroke();
    // Stamen tip
    ctx.fillStyle = "rgba(255,220,60,0.8)";
    ctx.beginPath(); ctx.arc(sx, sy, r * 0.07, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

function drawSakura(ctx: CanvasRenderingContext2D, w: number, h: number, petals: Petal[], ts: number) {
  ctx.clearRect(0, 0, w, h);
  const t = ts * 0.001;

  // Soft pink mist overlay
  const mist = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.7);
  mist.addColorStop(0, "rgba(255,182,193,0.04)");
  mist.addColorStop(1, "rgba(255,105,135,0)");
  ctx.fillStyle = mist; ctx.fillRect(0, 0, w, h);

  // Bokeh blobs
  for (let i = 0; i < 6; i++) {
    const bx = (Math.sin(t * 0.15 + i * 1.7) * 0.4 + 0.5) * w;
    const by = (Math.cos(t * 0.1 + i * 2.3) * 0.35 + 0.5) * h;
    const br = rand(60, 160);
    const bokeh = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    bokeh.addColorStop(0, "rgba(255,160,180,0.06)");
    bokeh.addColorStop(1, "rgba(255,160,180,0)");
    ctx.fillStyle = bokeh; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
  }

  // Petals
  for (const p of petals) {
    p.swayPhase += p.swaySpeed;
    p.x += p.vx + Math.sin(p.swayPhase) * 0.5;
    p.y += p.vy;
    p.rot += p.rotSpeed;
    if (p.y > h + 20) { p.y = -20; p.x = rand(0, w); }
    if (p.x < -20) p.x = w + 20;
    if (p.x > w + 20) p.x = -20;
    drawFlower(ctx, p);
  }
  ctx.globalAlpha = 1;
}

// ── 4. NETFLIX — Cinematic dark + rising red embers + film grain ─────────────
function initNetflix(w: number, h: number, embers: Ember[]) {
  embers.length = 0;
  for (let i = 0; i < 60; i++) {
    const maxLife = randInt(80, 180);
    embers.push({
      x: rand(0, w), y: rand(0, h),
      r: rand(0.8, 3.2),
      vx: rand(-0.4, 0.4), vy: rand(-0.8, -2.2),
      life: randInt(0, maxLife), maxLife,
      color: Math.random() < 0.7 ? "#E50914" : Math.random() < 0.5 ? "#FF4500" : "#FF6347",
    });
  }
}

function drawNetflix(ctx: CanvasRenderingContext2D, w: number, h: number, embers: Ember[], ts: number) {
  ctx.clearRect(0, 0, w, h);
  const t = ts * 0.001;

  // Deep red cinematic vignette
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.1, w * 0.5, h * 0.5, h * 0.85);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(20,0,0,0.7)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);

  // Subtle red glow pool at bottom
  const pool = ctx.createRadialGradient(w * 0.5, h, 0, w * 0.5, h, w * 0.6);
  pool.addColorStop(0, "rgba(229,9,20,0.08)");
  pool.addColorStop(1, "rgba(229,9,20,0)");
  ctx.fillStyle = pool; ctx.fillRect(0, 0, w, h);

  // Slow pulsing top glow (like a projector)
  const topPulse = 0.03 + Math.sin(t * 0.4) * 0.01;
  const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.3);
  topGrad.addColorStop(0, `rgba(229,9,20,${topPulse})`);
  topGrad.addColorStop(1, "rgba(229,9,20,0)");
  ctx.fillStyle = topGrad; ctx.fillRect(0, 0, w, h * 0.3);

  // Embers
  for (const e of embers) {
    e.life++;
    e.x += e.vx + Math.sin(e.life * 0.05) * 0.3;
    e.y += e.vy;
    if (e.life >= e.maxLife || e.y < -10) {
      e.x = rand(0, w); e.y = h + 5;
      e.life = 0; e.maxLife = randInt(80, 180);
      e.vy = rand(-0.8, -2.2); e.vx = rand(-0.4, 0.4);
    }
    const prog = e.life / e.maxLife;
    const alpha = Math.sin(prog * Math.PI) * 0.85;
    // Glow
    const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 5);
    glow.addColorStop(0, hexToRgba(e.color, alpha * 0.6));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = e.color; ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Film grain overlay
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const step = 6; // skip pixels for performance
  for (let i = 0; i < data.length; i += 4 * step) {
    const noise = (Math.random() - 0.5) * 14;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise * 0.3));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise * 0.3));
  }
  ctx.putImageData(imageData, 0, 0);

  // Horizontal scanline flicker
  ctx.fillStyle = "rgba(0,0,0,0.03)";
  for (let y = 0; y < h; y += 3) { ctx.fillRect(0, y, w, 1); }
}

// ── 5. RETRO — Pixel stars + neon scanlines + CRT glow ───────────────────────
function drawRetro(ctx: CanvasRenderingContext2D, w: number, h: number, stars: Star[], ts: number) {
  ctx.clearRect(0, 0, w, h);
  const t = ts * 0.001;

  // CRT scanlines
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  for (let y = 0; y < h; y += 4) { ctx.fillRect(0, y, w, 2); }

  // Moving neon grid
  const gOff = (t * 20) % 40;
  ctx.strokeStyle = "rgba(78,205,196,0.07)";
  ctx.lineWidth = 1;
  for (let x = -40 + (gOff % 40); x < w + 40; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = -40 + (gOff % 40); y < h + 40; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Pixel stars (square)
  for (const s of stars) {
    s.y -= s.speed * 0.8; s.x += s.drift * 0.2;
    if (s.y < -5) { s.y = h + 5; s.x = rand(0, w); }
    s.twinklePhase += s.twinkleSpeed;
    const twinkle = 0.5 + 0.5 * Math.sin(s.twinklePhase);
    const finalOp = s.opacity * (0.3 + 0.7 * twinkle);
    // Pixel square instead of circle
    const sz = Math.max(1, Math.round(s.r));
    ctx.fillStyle = s.color; ctx.globalAlpha = finalOp;
    ctx.fillRect(Math.round(s.x) - sz / 2, Math.round(s.y) - sz / 2, sz, sz);
    ctx.globalAlpha = 1;
  }

  // Neon corner scan line
  const cy2 = ((t * 60) % (h + 80)) - 40;
  ctx.strokeStyle = `rgba(78,205,196,${0.12 + Math.sin(t * 3) * 0.05})`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, cy2); ctx.lineTo(w, cy2); ctx.stroke();

  // Retro glow burst in center
  const burst = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.min(w, h) * 0.4);
  burst.addColorStop(0, `rgba(78,205,196,${0.025 + Math.sin(t * 0.7) * 0.01})`);
  burst.addColorStop(1, "rgba(78,205,196,0)");
  ctx.fillStyle = burst; ctx.fillRect(0, 0, w, h);
}

// ── 6. DARK-DEATH — Blood embers + rising ash + crimson nebula ───────────────
function initDarkDeath(w: number, h: number, embers: Ember[]) {
  embers.length = 0;
  for (let i = 0; i < 100; i++) {
    const maxLife = randInt(60, 160);
    embers.push({
      x: rand(0, w), y: rand(0, h),
      r: rand(0.5, 2.8),
      vx: rand(-0.5, 0.5), vy: rand(-0.3, -1.8),
      life: randInt(0, maxLife), maxLife,
      color: Math.random() < 0.5 ? "#CC0000" : Math.random() < 0.5 ? "#FF3300" : "#880000",
    });
  }
}

function drawDarkDeath(ctx: CanvasRenderingContext2D, w: number, h: number, embers: Ember[], ts: number) {
  ctx.clearRect(0, 0, w, h);
  const t = ts * 0.001;

  // Dark red vignette
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
  vig.addColorStop(0, "rgba(30,0,0,0.2)");
  vig.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);

  // Pulsing crimson glow from bottom
  const floor = ctx.createLinearGradient(0, h, 0, h * 0.55);
  floor.addColorStop(0, `rgba(140,0,0,${0.14 + Math.sin(t * 0.8) * 0.04})`);
  floor.addColorStop(1, "rgba(140,0,0,0)");
  ctx.fillStyle = floor; ctx.fillRect(0, 0, w, h);

  // Ash / embers rising
  for (const e of embers) {
    e.life++;
    e.x += e.vx + Math.sin(e.life * 0.06 + e.x * 0.01) * 0.4;
    e.y += e.vy;
    if (e.life >= e.maxLife || e.y < -10) {
      e.x = rand(0, w); e.y = h + 5; e.life = 0;
      e.maxLife = randInt(60, 160);
      e.vy = rand(-0.3, -1.8); e.vx = rand(-0.5, 0.5);
    }
    const prog = e.life / e.maxLife;
    const alpha = Math.sin(prog * Math.PI) * 0.75;
    // Inner glow
    const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4);
    glow.addColorStop(0, hexToRgba(e.color, alpha * 0.5));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = e.color; ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Occasional lightning crack
  if (Math.random() < 0.005) {
    ctx.strokeStyle = "rgba(180,0,0,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath();
    let lx = rand(0, w); let ly = 0;
    ctx.moveTo(lx, ly);
    while (ly < h) {
      lx += rand(-30, 30); ly += rand(20, 60);
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
  }
}

// ── 8. BUTTERFLY — Enchanted Midnight Garden ─────────────────────────────────
// Bioluminescent butterflies glowing against deep teal-black, aurora ribbons,
// moonbeam shafts, golden ember sparks. Completely unique dark-light aesthetic.

// Vivid bioluminescent palettes — glow against dark background
const BUTTERFLY_PALETTES = [
  { top: "#00FFD4", bottom: "#00B8A0" }, // electric teal-aqua
  { top: "#FFD700", bottom: "#FFA500" }, // molten gold-amber
  { top: "#39FF14", bottom: "#00CC44" }, // neon lime-emerald
  { top: "#00CFFF", bottom: "#0080CC" }, // electric sky-cerulean
  { top: "#FF6EFF", bottom: "#CC00CC" }, // neon magenta-orchid
  { top: "#FFAA00", bottom: "#FF6600" }, // vivid tangerine-orange
  { top: "#7FFFD4", bottom: "#00CED1" }, // aquamarine-dark-teal
  { top: "#E0FF00", bottom: "#AACC00" }, // electric chartreuse
];

// Deep teal-emerald aurora wisps — unique to this theme
const WISP_COLORS = [
  "rgba(0,200,160,",   // teal
  "rgba(0,160,220,",   // cerulean
  "rgba(80,220,160,",  // emerald
  "rgba(0,240,200,",   // aqua
];

function initButterfly(w: number, h: number, butterflies: Butterfly[], wisps: Wisp[]) {
  butterflies.length = 0; wisps.length = 0;

  for (let i = 0; i < 16; i++) {
    const palette = BUTTERFLY_PALETTES[randInt(0, BUTTERFLY_PALETTES.length - 1)];
    butterflies.push({
      x: rand(0, w), y: rand(h * 0.05, h * 0.92),
      vx: rand(-0.6, 0.6), vy: rand(-0.4, 0.4),
      wanderPhase: rand(0, Math.PI * 2), wanderSpeed: rand(0.004, 0.012),
      wingPhase: rand(0, Math.PI * 2), wingSpeed: rand(0.05, 0.11),
      size: rand(12, 28),
      colorTop: palette.top, colorBottom: palette.bottom,
      opacity: rand(0.75, 1.0),
      trail: [],
    });
  }

  // Large slow-moving aurora glow pools
  for (let i = 0; i < 30; i++) {
    wisps.push({
      x: rand(0, w), y: rand(0, h * 0.7),
      r: rand(80, 240),
      vx: rand(-0.06, 0.06), vy: rand(-0.04, 0.04),
      floatPhase: rand(0, Math.PI * 2), floatSpeed: rand(0.002, 0.006),
      opacity: rand(0.04, 0.10),
      color: WISP_COLORS[randInt(0, WISP_COLORS.length - 1)],
    });
  }
}

/** Draw a single bioluminescent butterfly with glowing bezier wings */
function drawSingleButterfly(ctx: CanvasRenderingContext2D, bf: Butterfly, t: number) {
  const flapOpen = Math.abs(Math.cos(bf.wingPhase)); // 0=closed 1=fully open
  const s = bf.size;

  ctx.save();
  ctx.translate(bf.x, bf.y);

  // ── Outer glow halo (bioluminescence) ──────────────────────────────────────
  ctx.globalAlpha = bf.opacity * 0.25;
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.8);
  halo.addColorStop(0, bf.colorTop + "99");
  halo.addColorStop(1, bf.colorTop + "00");
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, s * 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = bf.opacity;

  // ── Upper wings ─────────────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    const wx = s * 1.4 * flapOpen;
    const wy = s * 1.0;

    // Glowing gradient — brighter core fades to transparent edge
    const wg = ctx.createRadialGradient(wx * 0.35, -wy * 0.3, 0, wx * 0.35, -wy * 0.3, wx * 1.3);
    wg.addColorStop(0, bf.colorTop + "ff");
    wg.addColorStop(0.5, bf.colorTop + "bb");
    wg.addColorStop(1, bf.colorBottom + "22");
    ctx.fillStyle = wg;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(wx * 0.45, -wy * 1.15, wx * 1.15, -wy * 0.55, wx, -wy * 0.04);
    ctx.bezierCurveTo(wx * 0.85, wy * 0.28, wx * 0.28, wy * 0.12, 0, 0);
    ctx.closePath();
    ctx.fill();

    // Glowing vein lines
    ctx.shadowColor = bf.colorTop; ctx.shadowBlur = 4;
    ctx.strokeStyle = bf.colorTop + "88"; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(wx * 0.25, -wy * 0.55, wx * 0.75, -wy * 0.42, wx * 0.88, -wy * 0.08);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.bezierCurveTo(wx * 0.5, -wy * 0.82, wx * 1.05, -wy * 0.5, wx, -wy * 0.04);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── Lower wings ─────────────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    const lx = s * 0.95 * flapOpen;
    const ly = s * 0.7;
    const lg2 = ctx.createRadialGradient(lx * 0.3, ly * 0.45, 0, lx * 0.3, ly * 0.45, lx * 1.1);
    lg2.addColorStop(0, bf.colorBottom + "dd");
    lg2.addColorStop(1, bf.colorBottom + "22");
    ctx.fillStyle = lg2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(lx * 0.28, ly * 0.62, lx * 1.08, ly * 0.5, lx * 0.88, ly * 0.06);
    ctx.bezierCurveTo(lx * 0.7, -ly * 0.06, lx * 0.18, ly * 0.1, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── Body ────────────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, -s * 0.7, 0, s * 0.55);
  bg.addColorStop(0, "rgba(0,40,30,0.95)");
  bg.addColorStop(1, "rgba(0,20,15,0.7)");
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.ellipse(0, -s * 0.08, s * 0.11, s * 0.62, 0, 0, Math.PI * 2); ctx.fill();

  // Head with glow
  ctx.shadowColor = bf.colorTop; ctx.shadowBlur = 6;
  ctx.fillStyle = "rgba(0,30,20,0.98)";
  ctx.beginPath(); ctx.arc(0, -s * 0.68, s * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // ── Antennae ────────────────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(0,200,160,0.6)"; ctx.lineWidth = 0.9;
  for (const side of [-1, 1]) {
    const atx = side * s * 0.48; const aty = -s * 1.42;
    ctx.beginPath();
    ctx.moveTo(side * s * 0.1, -s * 0.68);
    ctx.quadraticCurveTo(side * s * 0.28, -s * 1.1, atx, aty);
    ctx.stroke();
    ctx.shadowColor = bf.colorTop; ctx.shadowBlur = 5;
    ctx.fillStyle = bf.colorTop;
    ctx.beginPath(); ctx.arc(atx, aty, s * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawButterflyScene(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  butterflies: Butterfly[], wisps: Wisp[], ts: number
) {
  ctx.clearRect(0, 0, w, h);
  const t = ts * 0.001;

  // ── Deep background gradient — semi-transparent so UI cards/chats remain readable
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "rgba(0,22,32,0.82)");
  bg.addColorStop(0.5, "rgba(0,16,24,0.80)");
  bg.addColorStop(1, "rgba(0,10,16,0.82)");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  // ── Aurora ribbon waves across the sky ──────────────────────────────────────
  const auroraColors = [
    { r: 0, g: 200, b: 140 },
    { r: 0, g: 160, b: 220 },
    { r: 80, g: 240, b: 180 },
  ];
  for (let a = 0; a < 3; a++) {
    const ac = auroraColors[a];
    const yOff = h * (0.18 + a * 0.1);
    const amp = 28 + a * 12;
    const spd = 0.18 + a * 0.07;
    ctx.beginPath();
    ctx.moveTo(0, yOff);
    for (let x = 0; x <= w; x += 6) {
      const y = yOff + Math.sin((x / w) * Math.PI * 3 + t * spd + a * 1.4) * amp
                     + Math.cos((x / w) * Math.PI * 2 + t * (spd * 0.6)) * (amp * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, 0); ctx.lineTo(0, 0); ctx.closePath();
    const auroraAlpha = 0.04 + 0.02 * Math.sin(t * 0.4 + a);
    const aGrad = ctx.createLinearGradient(0, yOff - amp, 0, yOff + amp * 2);
    aGrad.addColorStop(0, `rgba(${ac.r},${ac.g},${ac.b},${auroraAlpha})`);
    aGrad.addColorStop(0.5, `rgba(${ac.r},${ac.g},${ac.b},${auroraAlpha * 3})`);
    aGrad.addColorStop(1, `rgba(${ac.r},${ac.g},${ac.b},0)`);
    ctx.fillStyle = aGrad; ctx.fill();
  }

  // ── Moonbeam light shafts ────────────────────────────────────────────────────
  for (let m = 0; m < 3; m++) {
    const mx = (Math.sin(t * 0.04 + m * 2.1) * 0.25 + 0.25 + m * 0.28) * w;
    const mbAlpha = 0.03 + 0.015 * Math.sin(t * 0.3 + m);
    const mb = ctx.createLinearGradient(mx, 0, mx + 40, h);
    mb.addColorStop(0, `rgba(180,255,220,${mbAlpha * 2})`);
    mb.addColorStop(0.5, `rgba(120,220,180,${mbAlpha})`);
    mb.addColorStop(1, `rgba(0,180,140,0)`);
    ctx.fillStyle = mb;
    ctx.beginPath();
    ctx.moveTo(mx - 15, 0); ctx.lineTo(mx + 55, 0);
    ctx.lineTo(mx + w * 0.12, h); ctx.lineTo(mx - w * 0.05, h);
    ctx.closePath(); ctx.fill();
  }

  // ── Aurora glow pools ────────────────────────────────────────────────────────
  for (const ws of wisps) {
    ws.floatPhase += ws.floatSpeed;
    ws.x += ws.vx + Math.sin(ws.floatPhase * 0.6) * 0.1;
    ws.y += ws.vy + Math.cos(ws.floatPhase * 0.4) * 0.08;
    if (ws.x < -ws.r) ws.x = w + ws.r;
    if (ws.x > w + ws.r) ws.x = -ws.r;
    if (ws.y < -ws.r) ws.y = h + ws.r;
    if (ws.y > h + ws.r) ws.y = -ws.r;
    const op = ws.opacity * (0.55 + 0.45 * Math.sin(ws.floatPhase));
    const wg = ctx.createRadialGradient(ws.x, ws.y, 0, ws.x, ws.y, ws.r);
    wg.addColorStop(0, `${ws.color}${op})`);
    wg.addColorStop(1, `${ws.color}0)`);
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(ws.x, ws.y, ws.r, 0, Math.PI * 2); ctx.fill();
  }

  // ── Golden ember sparks floating upward ─────────────────────────────────────
  const sparkCount = 55;
  for (let i = 0; i < sparkCount; i++) {
    const sx = ((Math.sin(t * 0.15 + i * 0.42) * 0.5 + 0.5 + i / sparkCount * 0.8) % 1) * w;
    const sy = ((1.0 - ((t * 0.04 + i * 0.019) % 1)) ) * h;
    const sa = 0.12 + 0.25 * Math.abs(Math.sin(t * 1.1 + i * 0.7));
    const sr = 0.6 + 0.8 * Math.abs(Math.sin(t * 0.8 + i));
    const sc = i % 4 === 0 ? `rgba(255,210,0,${sa})` :
               i % 4 === 1 ? `rgba(0,220,160,${sa})` :
               i % 4 === 2 ? `rgba(255,160,0,${sa * 0.7})` :
                              `rgba(100,255,200,${sa * 0.6})`;
    ctx.fillStyle = sc;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  }

  // ── Butterflies with glowing trails ─────────────────────────────────────────
  for (const bf of butterflies) {
    bf.wingPhase += bf.wingSpeed;
    bf.wanderPhase += bf.wanderSpeed;
    bf.vx += Math.cos(bf.wanderPhase * 1.2) * 0.022;
    bf.vy += Math.sin(bf.wanderPhase * 0.85) * 0.018;
    const spd = Math.sqrt(bf.vx * bf.vx + bf.vy * bf.vy);
    if (spd > 1.2) { bf.vx *= 0.9; bf.vy *= 0.9; }
    bf.x += bf.vx; bf.y += bf.vy;
    const m = bf.size * 2;
    if (bf.x < -m) bf.x = w + m; if (bf.x > w + m) bf.x = -m;
    if (bf.y < -m) bf.y = h + m; if (bf.y > h + m) bf.y = -m;

    // Glowing trail
    bf.trail.push({ x: bf.x, y: bf.y, a: 0.6 });
    if (bf.trail.length > 18) bf.trail.shift();
    for (let ti = 0; ti < bf.trail.length; ti++) {
      const tp = bf.trail[ti];
      const frac = ti / bf.trail.length;
      const ta = frac * 0.35;
      if (ta < 0.01) continue;
      const tr = frac * bf.size * 0.22 + 0.8;
      const glowR = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, tr * 3);
      glowR.addColorStop(0, `${bf.colorTop}${Math.floor(ta * 255).toString(16).padStart(2, "0")}`);
      glowR.addColorStop(1, `${bf.colorTop}00`);
      ctx.fillStyle = glowR;
      ctx.beginPath(); ctx.arc(tp.x, tp.y, tr * 3, 0, Math.PI * 2); ctx.fill();
    }

    const angle = Math.atan2(bf.vy, bf.vx) + Math.PI / 2;
    ctx.save();
    ctx.translate(bf.x, bf.y); ctx.rotate(angle); ctx.translate(-bf.x, -bf.y);
    drawSingleButterfly(ctx, bf, t);
    ctx.restore();
  }

  // ── Edge vignette (deepen the midnight atmosphere) ───────────────────────────
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.25, w * 0.5, h * 0.5, h * 0.85);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,8,12,0.55)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);
}

// ── 7. BEIGE FOREST — swaying grass, fireflies, falling leaves, pollen ────────
const LEAF_COLORS = ["#5a8a3a", "#7ab648", "#a8c87c", "#c8a84a", "#d4884a", "#8ab84a", "#4a8a2a"];
const GRASS_COLORS = ["#3d6b2a", "#4a7a30", "#5a8a38", "#6aaa40", "#2d5a20", "#4d7a2a"];

function initForest(
  w: number, h: number,
  grass: GrassBlade[], fireflies: Firefly[], leaves: Leaf[], pollen: Pollen[]
) {
  grass.length = 0; fireflies.length = 0; leaves.length = 0; pollen.length = 0;

  // Fireflies
  for (let i = 0; i < 35; i++) {
    fireflies.push({
      x: rand(0, w), y: rand(h * 0.15, h * 0.85),
      r: rand(1.5, 4),
      pulsePhase: rand(0, Math.PI * 2), pulseSpeed: rand(0.02, 0.06),
      vx: rand(-0.4, 0.4), vy: rand(-0.25, 0.25),
      wanderPhase: rand(0, Math.PI * 2),
      opacity: rand(0.5, 1),
    });
  }

  // Falling / drifting leaves
  for (let i = 0; i < 40; i++) {
    leaves.push({
      x: rand(0, w), y: rand(-h, h),
      r: rand(4, 11),
      vx: rand(-0.5, 0.5), vy: rand(0.4, 1.4),
      rot: rand(0, Math.PI * 2), rotSpeed: rand(-0.02, 0.02),
      swayPhase: rand(0, Math.PI * 2), swayAmp: rand(6, 18), swaySpeed: rand(0.006, 0.018),
      opacity: rand(0.45, 0.85),
      color: LEAF_COLORS[randInt(0, LEAF_COLORS.length - 1)],
    });
  }

  // Floating pollen
  for (let i = 0; i < 60; i++) {
    pollen.push({
      x: rand(0, w), y: rand(0, h),
      r: rand(1, 2.5),
      vx: rand(-0.2, 0.2), vy: rand(-0.5, -0.1),
      floatPhase: rand(0, Math.PI * 2), floatSpeed: rand(0.008, 0.025),
      opacity: rand(0.15, 0.55),
    });
  }
}

function drawLeafShape(ctx: CanvasRenderingContext2D, leaf: Leaf) {
  ctx.save();
  ctx.translate(leaf.x, leaf.y);
  ctx.rotate(leaf.rot);
  ctx.globalAlpha = leaf.opacity;
  const r = leaf.r;
  // Simple oval leaf shape
  const lg = ctx.createLinearGradient(-r, 0, r, 0);
  lg.addColorStop(0, leaf.color + "cc");
  lg.addColorStop(0.5, leaf.color + "ff");
  lg.addColorStop(1, leaf.color + "88");
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  // Midrib
  ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(r * 0.8, 0); ctx.stroke();
  ctx.restore();
}

function drawForest(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  grass: GrassBlade[], fireflies: Firefly[], leaves: Leaf[], pollen: Pollen[],
  ts: number
) {
  ctx.clearRect(0, 0, w, h);
  const t = ts * 0.001;

  // ── Warm background bokeh light pools ──────────────────────────────────────────
  const lightPools = [
    { cx: 0.15, cy: 0.2, r: 180, col: "rgba(255,220,100," },
    { cx: 0.75, cy: 0.1, r: 220, col: "rgba(200,240,160," },
    { cx: 0.5, cy: 0.5, r: 160, col: "rgba(255,200,80," },
    { cx: 0.88, cy: 0.7, r: 140, col: "rgba(160,210,120," },
  ];
  for (const lp of lightPools) {
    const lx = (Math.sin(t * 0.08 + lp.cx * 6) * 0.04 + lp.cx) * w;
    const ly = (Math.cos(t * 0.06 + lp.cy * 4) * 0.03 + lp.cy) * h;
    const pulse = 0.04 + Math.sin(t * 0.5 + lp.cx * 3) * 0.015;
    const pool = ctx.createRadialGradient(lx, ly, 0, lx, ly, lp.r);
    pool.addColorStop(0, `${lp.col}${pulse})`);
    pool.addColorStop(1, `${lp.col}0)`);
    ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(lx, ly, lp.r, 0, Math.PI * 2); ctx.fill();
  }

  // ── Pollen motes floating upward ────────────────────────────────────────────────
  for (const p of pollen) {
    p.floatPhase += p.floatSpeed;
    p.x += p.vx + Math.sin(p.floatPhase) * 0.3;
    p.y += p.vy;
    if (p.y < -5) { p.y = h + 5; p.x = rand(0, w); }
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
    glow.addColorStop(0, `rgba(240,220,80,${p.opacity})`);
    glow.addColorStop(1, "rgba(240,220,80,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,235,100,0.8)"; ctx.globalAlpha = p.opacity;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── Falling / tumbling leaves ────────────────────────────────────────────────
  for (const leaf of leaves) {
    leaf.swayPhase += leaf.swaySpeed;
    leaf.x += leaf.vx + Math.sin(leaf.swayPhase) * 0.5;
    leaf.y += leaf.vy;
    leaf.rot += leaf.rotSpeed;
    if (leaf.y > h + 20) { leaf.y = -20; leaf.x = rand(0, w); }
    if (leaf.x < -20) leaf.x = w + 20;
    if (leaf.x > w + 20) leaf.x = -20;
    drawLeafShape(ctx, leaf);
  }
  ctx.globalAlpha = 1;

  // ── Fireflies ────────────────────────────────────────────────────────────────────────
  for (const ff of fireflies) {
    ff.pulsePhase += ff.pulseSpeed;
    ff.wanderPhase += 0.008;
    ff.x += ff.vx + Math.cos(ff.wanderPhase * 1.3) * 0.4;
    ff.y += ff.vy + Math.sin(ff.wanderPhase * 0.9) * 0.3;
    // Soft bounce within scene
    if (ff.x < 0) ff.x = w; if (ff.x > w) ff.x = 0;
    if (ff.y < h * 0.05) ff.vy = Math.abs(ff.vy) * 0.5;
    if (ff.y > h * 0.92) ff.vy = -Math.abs(ff.vy) * 0.5;

    const pulse = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(ff.pulsePhase));
    const alpha = ff.opacity * pulse;

    // Outer soft green-gold glow
    const outerGlow = ctx.createRadialGradient(ff.x, ff.y, 0, ff.x, ff.y, ff.r * 10);
    outerGlow.addColorStop(0, `rgba(180,255,100,${alpha * 0.2})`);
    outerGlow.addColorStop(1, "rgba(180,255,100,0)");
    ctx.fillStyle = outerGlow; ctx.beginPath(); ctx.arc(ff.x, ff.y, ff.r * 10, 0, Math.PI * 2); ctx.fill();

    // Inner bright core
    const innerGlow = ctx.createRadialGradient(ff.x, ff.y, 0, ff.x, ff.y, ff.r * 3);
    innerGlow.addColorStop(0, `rgba(220,255,120,${alpha * 0.9})`);
    innerGlow.addColorStop(1, "rgba(180,255,100,0)");
    ctx.fillStyle = innerGlow; ctx.beginPath(); ctx.arc(ff.x, ff.y, ff.r * 3, 0, Math.PI * 2); ctx.fill();

    // Bright dot
    ctx.fillStyle = `rgba(240,255,180,${alpha})`;
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(ff.x, ff.y, ff.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── Warm bottom vignette (forest ground shadow) ─────────────────────────────────
  const groundShadow = ctx.createLinearGradient(0, h * 0.65, 0, h);
  groundShadow.addColorStop(0, "rgba(45,90,61,0)");
  groundShadow.addColorStop(1, "rgba(30,60,35,0.22)");
  ctx.fillStyle = groundShadow; ctx.fillRect(0, 0, w, h);
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function AntigravityCanvas() {
  const theme = useStore((s) => s.settings.theme);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);

  // Antigravity / retro
  const starsRef = useRef<Star[]>([]);
  const shootingRef = useRef<ShootingStar[]>([]);
  const nebulaRef = useRef<Nebula[]>([]);
  const orbsRef = useRef<Orb[]>([]);
  const lastShootRef = useRef(0);

  // Cyberpunk
  const dropsRef = useRef<DataDrop[]>([]);

  // Sakura
  const petalsRef = useRef<Petal[]>([]);

  // Netflix / dark-death
  const embersRef = useRef<Ember[]>([]);

  // Beige Forest
  const grassRef = useRef<GrassBlade[]>([]);
  const firefliesRef = useRef<Firefly[]>([]);
  const leavesRef = useRef<Leaf[]>([]);
  const pollenRef = useRef<Pollen[]>([]);

  // Butterfly
  const butterfliesRef = useRef<Butterfly[]>([]);
  const wispsRef = useRef<Wisp[]>([]);

  const initScene = useCallback((w: number, h: number) => {
    if (theme === "cyberpunk") {
      // Neon floating particles
      starsRef.current = Array.from({ length: 50 }, () => ({
        x: rand(0, w), y: rand(0, h), r: rand(1, 3.5), opacity: rand(0.4, 0.9),
        speed: rand(0.3, 1.2), drift: rand(-0.3, 0.3),
        twinkleSpeed: rand(0.02, 0.06), twinklePhase: rand(0, Math.PI * 2),
        color: CYBER_NEON[randInt(0, CYBER_NEON.length - 1)],
      }));
      initCyberpunk(w, h, dropsRef.current);

    } else if (theme === "sakura") {
      initSakura(w, h, petalsRef.current);

    } else if (theme === "netflix") {
      initNetflix(w, h, embersRef.current);

    } else if (theme === "dark-death") {
      initDarkDeath(w, h, embersRef.current);

    } else if (theme === "beige-forest") {
      initForest(w, h, grassRef.current, firefliesRef.current, leavesRef.current, pollenRef.current);

    } else if (theme === "butterfly") {
      initButterfly(w, h, butterfliesRef.current, wispsRef.current);

    } else if (theme === "retro") {
      starsRef.current = Array.from({ length: 120 }, () => ({
        x: rand(0, w), y: rand(0, h), r: rand(1, 3), opacity: rand(0.3, 1),
        speed: rand(0.2, 1), drift: rand(-0.1, 0.1),
        twinkleSpeed: rand(0.01, 0.04), twinklePhase: rand(0, Math.PI * 2),
        color: RETRO_COLORS[randInt(0, RETRO_COLORS.length - 1)],
      }));

    } else {
      // Antigravity default
      const starColors = ["#ffffff", "#c8d8ff", "#ffd8c8", "#d8c8ff", "#a8c8ff", "#ffe8a8", "#c8ffe8", "#00c8ff"];
      starsRef.current = Array.from({ length: 180 }, () => ({
        x: rand(0, w), y: rand(0, h), r: rand(0.3, 2.8), opacity: rand(0.2, 1),
        speed: rand(0.05, 0.4), drift: rand(-0.15, 0.15),
        twinkleSpeed: rand(0.005, 0.025), twinklePhase: rand(0, Math.PI * 2),
        color: starColors[randInt(0, starColors.length - 1)],
      }));
      const nebulaColors = ["rgba(139,92,246,", "rgba(99,102,241,", "rgba(168,85,247,", "rgba(59,130,246,", "rgba(79,70,229,"];
      nebulaRef.current = Array.from({ length: 5 }, () => ({
        x: rand(0.05, 0.95) * w, y: rand(0.05, 0.95) * h,
        rx: rand(120, 340), ry: rand(100, 280),
        color: nebulaColors[randInt(0, nebulaColors.length - 1)],
        opacity: rand(0.06, 0.14), pulse: rand(0, Math.PI * 2), pulseSpeed: rand(0.003, 0.009),
      }));
      const orbColors = [
        { color: "139,92,246", opacity: 0.07 },
        { color: "99,102,241", opacity: 0.09 },
        { color: "236,72,153", opacity: 0.05 },
      ];
      orbsRef.current = orbColors.map((oc, i) => ({
        x: w * [0.2, 0.8, 0.5][i], y: h * [0.3, 0.65, 0.15][i],
        r: [180, 240, 140][i], color: oc.color, opacity: oc.opacity,
        floatAngle: [0, Math.PI, Math.PI / 2][i], floatSpeed: [0.004, 0.003, 0.006][i],
      }));
    }
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = canvas.offsetWidth;
    let h = canvas.offsetHeight;
    canvas.width = w; canvas.height = h;
    initScene(w, h);

    const onResize = () => {
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = w; canvas.height = h;
      initScene(w, h);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", (e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; });

    const spawnShoot = () => {
      const angle = rand(-Math.PI * 0.25, Math.PI * 0.15);
      const speed = rand(8, 18);
      shootingRef.current.push({
        x: rand(0, w), y: rand(0, h * 0.4),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0, maxLife: rand(30, 60),
        color: "rgba(255,255,255,",
      });
    };

    const draw = (ts: number) => {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const parallaxX = (mx / w - 0.5) * 20;
      const parallaxY = (my / h - 0.5) * 20;

      if (theme === "cyberpunk") {
        drawCyberpunk(ctx, w, h, dropsRef.current, starsRef.current, ts);
      } else if (theme === "sakura") {
        drawSakura(ctx, w, h, petalsRef.current, ts);
      } else if (theme === "netflix") {
        drawNetflix(ctx, w, h, embersRef.current, ts);
      } else if (theme === "dark-death") {
        drawDarkDeath(ctx, w, h, embersRef.current, ts);
      } else if (theme === "beige-forest") {
        drawForest(ctx, w, h, grassRef.current, firefliesRef.current, leavesRef.current, pollenRef.current, ts);
      } else if (theme === "butterfly") {
        drawButterflyScene(ctx, w, h, butterfliesRef.current, wispsRef.current, ts);
      } else if (theme === "retro") {
        drawRetro(ctx, w, h, starsRef.current, ts);
      } else {
        drawAntigravity(ctx, w, h, starsRef.current, shootingRef.current, nebulaRef.current, orbsRef.current, parallaxX, parallaxY, ts, lastShootRef, spawnShoot);
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [initScene, theme]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: theme === "butterfly" ? 0.55 : 0.95 }}
    />
  );
}
