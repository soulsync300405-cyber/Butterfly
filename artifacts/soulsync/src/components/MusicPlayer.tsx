import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, ChevronUp, ChevronDown } from "lucide-react";
import { MUSIC_TRACKS } from "@/lib/data";

export function MusicPlayer() {
  const [playing, setPlaying] = useState(false);
  const [trackIdx, setTrackIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(32);
  const [volume, setVolume] = useState(70);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const track = MUSIC_TRACKS[trackIdx];
  const bars = Array.from({ length: 8 });

  const togglePlay = () => {
    setPlaying(p => {
      if (!p) {
        intervalRef.current = setInterval(() => setProgress(x => (x + 0.1) % 100), 300);
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
      return !p;
    });
  };

  const next = () => setTrackIdx(i => (i + 1) % MUSIC_TRACKS.length);
  const prev = () => setTrackIdx(i => (i - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length);

  return (
    <div className="border-t border-border bg-card rounded-b-xl overflow-hidden">
      {/* Collapsed header */}
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="flex-shrink-0">
            {playing ? (
              <div className="flex items-end gap-0.5 h-4">
                {bars.map((_, i) => (
                  <motion.div key={i} className="rounded-full bg-primary w-0.5"
                    animate={{ height: [3, Math.random() * 10 + 4, 3] }}
                    transition={{ duration: 0.3 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.06 }}
                  />
                ))}
              </div>
            ) : (
              <Music size={14} className="text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{track.title}</p>
            <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); togglePlay(); }}
            className="w-6 h-6 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-opacity">
            {playing ? <Pause size={10} className="text-primary-foreground" /> : <Play size={10} className="text-primary-foreground ml-0.5" />}
          </button>
          {expanded ? <ChevronDown size={12} className="text-muted-foreground" /> : <ChevronUp size={12} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-2">
              {/* Progress bar */}
              <div className="space-y-1">
                <div className="w-full h-1 bg-muted rounded-full overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setProgress(((e.clientX - rect.left) / rect.width) * 100);
                  }}>
                  <motion.div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{Math.floor(progress * 0.36)}:{String(Math.floor((progress * 0.36 % 1) * 60)).padStart(2, "0")}</span>
                  <span>∞</span>
                </div>
              </div>
              {/* Controls */}
              <div className="flex items-center justify-between">
                <button onClick={prev} className="text-muted-foreground hover:text-foreground transition-colors">
                  <SkipBack size={14} />
                </button>
                <button onClick={togglePlay}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-opacity">
                  {playing ? <Pause size={14} className="text-primary-foreground" /> : <Play size={14} className="text-primary-foreground ml-0.5" />}
                </button>
                <button onClick={next} className="text-muted-foreground hover:text-foreground transition-colors">
                  <SkipForward size={14} />
                </button>
              </div>
              {/* Volume */}
              <div className="flex items-center gap-2">
                <Volume2 size={12} className="text-muted-foreground flex-shrink-0" />
                <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(+e.target.value)}
                  className="w-full h-1 accent-primary" />
              </div>
              {/* Playlist chips */}
              <div className="flex gap-1 flex-wrap">
                {["Focus", "Calm", "Meditation", "Energy"].map(p => (
                  <button key={p} onClick={() => {
                    const found = MUSIC_TRACKS.findIndex(t => t.playlist === p);
                    if (found >= 0) setTrackIdx(found);
                  }}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                    {p}
                  </button>
                ))}
              </div>
              {/* Spotify connect hint */}
              <button className="w-full text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1 py-1">
                <span className="text-[#1DB954]">&#9654;</span> Connect Spotify for your own music
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
