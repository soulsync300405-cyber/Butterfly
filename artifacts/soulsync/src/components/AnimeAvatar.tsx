import { motion } from "framer-motion";

type AvatarStyle = "soft-pastel" | "bold-bright" | "calm-forest" | "urban-cool" | "classic-elegant" | "cosmic-dreamer";
type Gender = "male" | "female" | "nonbinary";

interface AnimeAvatarProps {
  speaking?: boolean;
  size?: number;
  style?: AvatarStyle;
  gender?: Gender;
  name?: string;
}

const STYLE_CONFIGS: Record<AvatarStyle, { skin: string; hair: string; eyes: string; accent: string; bg: string }> = {
  "soft-pastel": { skin: "#FFD9C0", hair: "#F9C784", eyes: "#6B8FD4", accent: "#FFB3D1", bg: "from-pink-200 to-purple-200" },
  "bold-bright": { skin: "#E8B89A", hair: "#2C2C2C", eyes: "#E84040", accent: "#FF6B35", bg: "from-orange-400 to-red-500" },
  "calm-forest": { skin: "#D4A574", hair: "#4A3728", eyes: "#3A7A52", accent: "#6BAA75", bg: "from-green-300 to-emerald-500" },
  "urban-cool": { skin: "#C8956C", hair: "#1A1A2E", eyes: "#00D4FF", accent: "#9B59B6", bg: "from-slate-600 to-purple-700" },
  "classic-elegant": { skin: "#F5CBA7", hair: "#8B6914", eyes: "#5D4037", accent: "#C9A96E", bg: "from-amber-100 to-yellow-200" },
  "cosmic-dreamer": { skin: "#D4B8E0", hair: "#6A0DAD", eyes: "#E040FB", accent: "#00BCD4", bg: "from-purple-600 to-indigo-800" },
};

export function AnimeAvatar({ speaking = false, size = 120, style = "soft-pastel", gender = "female", name }: AnimeAvatarProps) {
  const cfg = STYLE_CONFIGS[style] || STYLE_CONFIGS["soft-pastel"];
  const bars = Array.from({ length: 10 });
  const isMale = gender === "male";

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      {/* Outer glow ring */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: size * 1.35, height: size * 1.35, background: `radial-gradient(circle, ${cfg.accent}30, transparent 70%)` }}
        animate={{ scale: [1, 1.05, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Core circle */}
      <motion.div
        className={`relative rounded-full overflow-hidden bg-gradient-to-br ${cfg.bg} flex items-end justify-center`}
        style={{ width: size, height: size, boxShadow: `0 4px 24px ${cfg.accent}50` }}
        animate={speaking ? { scale: [1, 1.02, 1] } : { scale: 1 }}
        transition={{ duration: 0.8, repeat: speaking ? Infinity : 0, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: "absolute", top: 0, left: 0 }}>
          {/* Body/Shoulders */}
          <ellipse cx="50" cy="95" rx="28" ry="18" fill={cfg.skin} opacity="0.9" />
          {/* Neck */}
          <rect x="44" y="72" width="12" height="14" rx="4" fill={cfg.skin} />
          {/* Head */}
          <ellipse cx="50" cy="52" rx={isMale ? "22" : "20"} ry={isMale ? "24" : "26"} fill={cfg.skin} />
          {/* Hair */}
          {isMale ? (
            <>
              <ellipse cx="50" cy="31" rx="22" ry="10" fill={cfg.hair} />
              <rect x="28" y="31" width="44" height="10" rx="2" fill={cfg.hair} />
            </>
          ) : (
            <>
              <ellipse cx="50" cy="29" rx="20" ry="12" fill={cfg.hair} />
              <ellipse cx="28" cy="55" rx="7" ry="20" fill={cfg.hair} />
              <ellipse cx="72" cy="55" rx="7" ry="20" fill={cfg.hair} />
              <ellipse cx="50" cy="29" rx="20" ry="10" fill={cfg.hair} />
            </>
          )}
          {/* Left eye */}
          <motion.g animate={speaking ? {} : { scaleY: [1, 0.05, 1] }} transition={{ duration: 4, repeat: Infinity, delay: 2 }}>
            <ellipse cx="41" cy="50" rx="4" ry="5" fill="white" />
            <circle cx="42" cy="50.5" r="2.8" fill={cfg.eyes} />
            <circle cx="43" cy="49" r="1" fill="white" opacity="0.8" />
          </motion.g>
          {/* Right eye */}
          <motion.g animate={speaking ? {} : { scaleY: [1, 0.05, 1] }} transition={{ duration: 4, repeat: Infinity, delay: 2 }}>
            <ellipse cx="59" cy="50" rx="4" ry="5" fill="white" />
            <circle cx="60" cy="50.5" r="2.8" fill={cfg.eyes} />
            <circle cx="61" cy="49" r="1" fill="white" opacity="0.8" />
          </motion.g>
          {/* Nose */}
          <ellipse cx="50" cy="58" rx="2" ry="1.5" fill={cfg.skin} style={{ filter: "brightness(0.85)" }} />
          {/* Mouth */}
          {speaking ? (
            <motion.ellipse cx="50" cy="65" rx="5" ry="3"
              fill={cfg.accent} opacity="0.9"
              animate={{ ry: [2, 4, 2, 3, 2] }}
              transition={{ duration: 0.4, repeat: Infinity }}
            />
          ) : (
            <path d="M 44 64 Q 50 69 56 64" stroke={cfg.accent} strokeWidth="2" fill="none" strokeLinecap="round" />
          )}
          {/* Blush */}
          <ellipse cx="36" cy="57" rx="4" ry="2.5" fill={cfg.accent} opacity="0.25" />
          <ellipse cx="64" cy="57" rx="4" ry="2.5" fill={cfg.accent} opacity="0.25" />
          {/* Clothing hint */}
          <rect x="36" y="86" width="28" height="10" rx="4" fill={cfg.accent} opacity="0.7" />
        </svg>
      </motion.div>

      {/* Voice waveform */}
      {speaking && size > 50 && (
        <div className="absolute flex items-end gap-0.5" style={{ bottom: -8, height: 16 }}>
          {bars.map((_, i) => (
            <motion.div key={i} className="rounded-full" style={{ width: 2.5, background: cfg.accent }}
              animate={{ height: [3, Math.random() * 10 + 4, 3] }}
              transition={{ duration: 0.25 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.05 }}
            />
          ))}
        </div>
      )}

      {/* Name label */}
      {name && size >= 80 && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-semibold whitespace-nowrap px-2 py-0.5 rounded-full"
          style={{ background: cfg.accent + "30", color: cfg.accent, border: `1px solid ${cfg.accent}40` }}>
          {name}
        </div>
      )}
    </div>
  );
}
