import { useEffect, useRef, useCallback } from "react";

interface Star {
  x: number; y: number;
  r: number; opacity: number;
  speed: number; drift: number;
  twinkleSpeed: number; twinklePhase: number;
  color: string;
}

interface ShootingStar {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string;
}

interface Nebula {
  x: number; y: number;
  rx: number; ry: number;
  color: string; opacity: number;
  pulse: number; pulseSpeed: number;
}

interface Orb {
  x: number; y: number;
  targetX: number; targetY: number;
  r: number; color: string; opacity: number;
  floatAngle: number; floatSpeed: number;
}

const STAR_COLORS = [
  "#ffffff", "#c8d8ff", "#ffd8c8", "#d8c8ff",
  "#a8c8ff", "#ffe8a8", "#c8ffe8", "#ff9cf0"
];

const NEBULA_COLORS = [
  "rgba(139,92,246,", // purple
  "rgba(99,102,241,", // indigo
  "rgba(168,85,247,", // violet
  "rgba(59,130,246,", // blue
  "rgba(236,72,153,", // pink
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function AntigravityCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);
  const starsRef = useRef<Star[]>([]);
  const shootingRef = useRef<ShootingStar[]>([]);
  const nebulaRef = useRef<Nebula[]>([]);
  const orbsRef = useRef<Orb[]>([]);
  const timeRef = useRef(0);
  const lastShootRef = useRef(0);

  const initScene = useCallback((w: number, h: number) => {
    // Stars — 3 layers: tiny background, medium, and bright foreground
    starsRef.current = Array.from({ length: 180 }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      r: rand(0.3, 2.8),
      opacity: rand(0.2, 1),
      speed: rand(0.05, 0.4),
      drift: rand(-0.15, 0.15),
      twinkleSpeed: rand(0.005, 0.025),
      twinklePhase: rand(0, Math.PI * 2),
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    }));

    // Nebula blobs
    nebulaRef.current = Array.from({ length: 5 }, () => ({
      x: rand(0.05, 0.95) * w,
      y: rand(0.05, 0.95) * h,
      rx: rand(120, 340),
      ry: rand(100, 280),
      color: NEBULA_COLORS[Math.floor(Math.random() * NEBULA_COLORS.length)],
      opacity: rand(0.06, 0.14),
      pulse: rand(0, Math.PI * 2),
      pulseSpeed: rand(0.003, 0.009),
    }));

    // Floating orbs (large glowing spheres)
    orbsRef.current = [
      { x: w * 0.2, y: h * 0.3, targetX: w * 0.2, targetY: h * 0.3, r: 180, color: "139,92,246", opacity: 0.07, floatAngle: 0, floatSpeed: 0.004 },
      { x: w * 0.8, y: h * 0.65, targetX: w * 0.8, targetY: h * 0.65, r: 240, color: "99,102,241", opacity: 0.09, floatAngle: Math.PI, floatSpeed: 0.003 },
      { x: w * 0.5, y: h * 0.15, targetX: w * 0.5, targetY: h * 0.15, r: 140, color: "236,72,153", opacity: 0.05, floatAngle: Math.PI / 2, floatSpeed: 0.006 },
    ];
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = canvas.offsetWidth;
    let h = canvas.offsetHeight;
    canvas.width = w;
    canvas.height = h;
    initScene(w, h);

    const onResize = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = w;
      canvas.height = h;
      initScene(w, h);
    };
    window.addEventListener("resize", onResize);

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMouse);

    const spawnShootingStar = () => {
      const angle = rand(-Math.PI * 0.25, Math.PI * 0.15);
      const speed = rand(8, 18);
      const colors = ["rgba(255,255,255,", "rgba(200,200,255,", "rgba(255,220,255,"];
      shootingRef.current.push({
        x: rand(0, w),
        y: rand(0, h * 0.4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: rand(30, 60),
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    };

    const draw = (ts: number) => {
      timeRef.current = ts * 0.001;
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const parallaxX = (mx / w - 0.5) * 20;
      const parallaxY = (my / h - 0.5) * 20;

      // ── Nebula blobs ────────────────────────────────────────────────────────
      for (const n of nebulaRef.current) {
        n.pulse += n.pulseSpeed;
        const pulsedOpacity = n.opacity + Math.sin(n.pulse) * 0.03;
        const grad = ctx.createRadialGradient(
          n.x + parallaxX * 0.3, n.y + parallaxY * 0.3, 0,
          n.x + parallaxX * 0.3, n.y + parallaxY * 0.3, n.rx
        );
        grad.addColorStop(0, `${n.color}${pulsedOpacity})`);
        grad.addColorStop(0.6, `${n.color}${pulsedOpacity * 0.4})`);
        grad.addColorStop(1, `${n.color}0)`);
        ctx.save();
        ctx.scale(1, n.ry / n.rx);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x + parallaxX * 0.3, (n.y + parallaxY * 0.3) * (n.rx / n.ry), n.rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── Floating orbs ───────────────────────────────────────────────────────
      for (const orb of orbsRef.current) {
        orb.floatAngle += orb.floatSpeed;
        const fx = orb.x + Math.cos(orb.floatAngle) * 40 + parallaxX * 0.15;
        const fy = orb.y + Math.sin(orb.floatAngle * 0.7) * 30 + parallaxY * 0.15;
        const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, orb.r);
        grad.addColorStop(0, `rgba(${orb.color},${orb.opacity})`);
        grad.addColorStop(0.5, `rgba(${orb.color},${orb.opacity * 0.4})`);
        grad.addColorStop(1, `rgba(${orb.color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(fx, fy, orb.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Stars ───────────────────────────────────────────────────────────────
      for (const s of starsRef.current) {
        // drift upward slowly
        s.y -= s.speed;
        s.x += s.drift * 0.3;
        if (s.y < -5) { s.y = h + 5; s.x = rand(0, w); }
        if (s.x < -5) s.x = w + 5;
        if (s.x > w + 5) s.x = -5;

        s.twinklePhase += s.twinkleSpeed;
        const twinkle = 0.5 + 0.5 * Math.sin(s.twinklePhase);
        const finalOpacity = s.opacity * (0.4 + 0.6 * twinkle);

        // Parallax offset based on star size (bigger = closer = more parallax)
        const px = s.x + parallaxX * (s.r / 2.8) * 0.8;
        const py = s.y + parallaxY * (s.r / 2.8) * 0.8;

        // Glow for bright stars
        if (s.r > 1.5 && twinkle > 0.7) {
          const glow = ctx.createRadialGradient(px, py, 0, px, py, s.r * 4);
          glow.addColorStop(0, s.color.replace("#", "rgba(").replace(/(.{2})(.{2})(.{2})/, (_, r, g, b) =>
            `${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)},`) + `${finalOpacity * 0.3})`);
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(px, py, s.r * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = s.color;
        ctx.globalAlpha = finalOpacity;
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── Shooting stars ──────────────────────────────────────────────────────
      if (ts - lastShootRef.current > rand(1800, 5000)) {
        spawnShootingStar();
        lastShootRef.current = ts;
      }

      shootingRef.current = shootingRef.current.filter(ss => ss.life < ss.maxLife);
      for (const ss of shootingRef.current) {
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life++;
        const progress = ss.life / ss.maxLife;
        const fadeIn = Math.min(progress * 5, 1);
        const fadeOut = 1 - progress;
        const alpha = fadeIn * fadeOut * 0.9;
        const tailLen = ss.life * 2.5;

        const grad = ctx.createLinearGradient(
          ss.x, ss.y,
          ss.x - ss.vx * tailLen * 0.4, ss.y - ss.vy * tailLen * 0.4
        );
        grad.addColorStop(0, `${ss.color}${alpha})`);
        grad.addColorStop(0.3, `${ss.color}${alpha * 0.6})`);
        grad.addColorStop(1, `${ss.color}0)`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5 * (1 - progress * 0.5);
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(ss.x - ss.vx * tailLen * 0.4, ss.y - ss.vy * tailLen * 0.4);
        ctx.stroke();

        // bright head
        ctx.fillStyle = `${ss.color}${alpha})`;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── Mouse hover sparkle cluster ─────────────────────────────────────────
      const mDist = 80;
      ctx.globalAlpha = 0.15;
      const mGrad = ctx.createRadialGradient(mx, my, 0, mx, my, mDist);
      mGrad.addColorStop(0, "rgba(168,85,247,0.5)");
      mGrad.addColorStop(1, "transparent");
      ctx.fillStyle = mGrad;
      ctx.beginPath();
      ctx.arc(mx, my, mDist, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, [initScene]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 0.95 }}
    />
  );
}
