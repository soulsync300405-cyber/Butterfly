import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, Volume2, ChevronUp, ChevronDown, Music2 } from "lucide-react";
import { MUSIC_TRACKS } from "@/lib/data";
import { useAmbientAudio, type Playlist } from "@/hooks/useAmbientAudio";
import { fetchTopTracks, redirectToAuthCodeFlow, SPOTIFY_CLIENT_ID } from "@/lib/spotify";

const PLAYLIST_COLORS: Record<string, string> = {
  Focus:      "from-violet-500 to-indigo-600",
  Calm:       "from-teal-400 to-cyan-500",
  Meditation: "from-rose-400 to-pink-500",
  Energy:     "from-amber-400 to-orange-500",
};

const PLAYLIST_EMOJI: Record<string, string> = {
  Focus: "🎯", Calm: "🌊", Meditation: "🧘", Energy: "⚡",
};

export function MusicPlayer() {
  const [playing, setPlaying] = useState(false);
  const [trackIdx, setTrackIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(70);
  
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [connectingSpotify, setConnectingSpotify] = useState(false);
  const [topTracks, setTopTracks] = useState<any[]>([]);
  const [spotifyIframeUrl, setSpotifyIframeUrl] = useState("https://open.spotify.com/embed/playlist/0vvXsWCC9xrXsKd4FyS8kM?utm_source=generator&theme=0");

  const audio = useAmbientAudio();
  const track = MUSIC_TRACKS[trackIdx];
  const gradient = PLAYLIST_COLORS[track.playlist] || "from-primary to-teal-500";
  const bars = Array.from({ length: 10 });

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setProgress(x => (x + 0.08) % 100), 300);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    // Check if token exists on mount or when expanded
    const token = localStorage.getItem("spotify_access_token");
    if (token) {
      setSpotifyConnected(true);
      fetchTopTracks(token)
        .then(data => {
          if (data && data.items) {
            setTopTracks(data.items);
          }
        })
        .catch(err => {
          console.error("Spotify fetch error:", err);
          // If token is invalid/expired
          if (err.status === 401 || err.message?.includes("401")) {
            localStorage.removeItem("spotify_access_token");
            setSpotifyConnected(false);
          }
        });
    }
  }, [expanded]);

  useEffect(() => {
    if (playing) {
      audio.play(track.playlist as Playlist, volume);
    }
  }, [trackIdx]);

  const togglePlay = () => {
    if (playing) {
      audio.stop();
      setPlaying(false);
    } else {
      audio.play(track.playlist as Playlist, volume);
      setPlaying(true);
    }
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    audio.setVolume(v);
  };

  const next = () => setTrackIdx(i => (i + 1) % MUSIC_TRACKS.length);
  const prev = () => setTrackIdx(i => (i - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length);

  return (
    <div className="overflow-hidden">
      {/* ── Collapsed bar ── */}
      <motion.div
        className={`relative bg-gradient-to-r ${gradient} overflow-hidden`}
        animate={{ height: "auto" }}>

        {/* Sheen sweep when playing */}
        {playing && (
          <motion.div
            className="absolute inset-0 bg-white/10"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            style={{ skewX: "-20deg" }}
          />
        )}

        <button
          onClick={() => setExpanded(e => !e)}
          className="relative w-full flex items-center gap-3 px-4 py-2.5">

          {/* Album disc */}
          <motion.div
            animate={playing ? { rotate: 360 } : { rotate: 0 }}
            transition={playing ? { duration: 3, repeat: Infinity, ease: "linear" } : {}}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center shadow-inner">
            <div className="w-3 h-3 rounded-full bg-white/80 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-black/40" />
            </div>
          </motion.div>

          {/* Track info */}
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              {playing ? (
                <div className="flex items-end gap-[2px] h-3">
                  {bars.map((_, i) => (
                    <motion.div key={i}
                      className="rounded-full bg-white w-[2px]"
                      animate={{ height: [2, Math.random() * 8 + 4, 2] }}
                      transition={{ duration: 0.25 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.05 }}
                    />
                  ))}
                </div>
              ) : (
                <Music2 size={11} className="text-white/70" />
              )}
              <p className="text-white text-xs font-bold truncate">{track.title}</p>
            </div>
            <p className="text-white/60 text-[10px] truncate">{track.artist} · {PLAYLIST_EMOJI[track.playlist]} {track.playlist}</p>
          </div>

          {/* Play button */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <motion.button
              whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
              onClick={e => { e.stopPropagation(); togglePlay(); }}
              className="w-8 h-8 rounded-full bg-white/25 border border-white/40 flex items-center justify-center backdrop-blur-sm hover:bg-white/35 transition-colors shadow-lg">
              {playing
                ? <Pause size={12} className="text-white" />
                : <Play size={12} className="text-white ml-0.5" />}
            </motion.button>
            {expanded
              ? <ChevronDown size={13} className="text-white/70" />
              : <ChevronUp size={13} className="text-white/70" />}
          </div>
        </button>

        {/* Mini progress strip at bottom */}
        <div className="h-0.5 bg-white/20">
          <motion.div className="h-full bg-white/70 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </motion.div>

      {/* ── Expanded panel ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden">

            <div className="bg-card border-x border-border px-4 pt-3 pb-4 space-y-3">
              {/* Big album art + track name */}
              <div className="flex items-center gap-3">
                <motion.div
                  animate={playing ? { rotate: 360 } : {}}
                  transition={playing ? { duration: 4, repeat: Infinity, ease: "linear" } : {}}
                  className={`w-14 h-14 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg flex-shrink-0 border-4 border-white/30`}>
                  <div className="w-5 h-5 rounded-full bg-white/70 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-black/30" />
                  </div>
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm leading-snug">{track.title}</p>
                  <p className="text-muted-foreground text-xs">{track.artist}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${gradient} text-white font-semibold`}>
                      {PLAYLIST_EMOJI[track.playlist]} {track.playlist}
                    </span>
                    {playing && (
                      <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                        className="text-[10px] text-primary font-semibold">● Live</motion.span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden cursor-pointer"
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setProgress(((e.clientX - rect.left) / rect.width) * 100);
                  }}>
                  <motion.div className={`h-full bg-gradient-to-r ${gradient} rounded-full`}
                    style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{Math.floor(progress * 0.36)}:{String(Math.floor((progress * 0.36 % 1) * 60)).padStart(2, "0")}</span>
                  <span>∞</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-5">
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={prev} className="text-muted-foreground hover:text-foreground transition-colors">
                  <SkipBack size={16} />
                </motion.button>

                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={togglePlay}
                  className={`w-11 h-11 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
                  {playing
                    ? <Pause size={16} className="text-white" />
                    : <Play size={16} className="text-white ml-0.5" />}
                </motion.button>

                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={next} className="text-muted-foreground hover:text-foreground transition-colors">
                  <SkipForward size={16} />
                </motion.button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Volume2 size={12} className="text-muted-foreground flex-shrink-0" />
                <input type="range" min={0} max={100} value={volume}
                  onChange={e => changeVolume(+e.target.value)}
                  className="flex-1 h-1 accent-primary" />
                <span className="text-[10px] text-muted-foreground w-5 text-right">{volume}</span>
              </div>

              {/* Playlist chips */}
              <div className="flex gap-1.5 flex-wrap">
                {["Focus", "Calm", "Meditation", "Energy"].map(p => (
                  <motion.button key={p} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const found = MUSIC_TRACKS.findIndex(t => t.playlist === p);
                      if (found >= 0) setTrackIdx(found);
                    }}
                    className={`text-[10px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                      track.playlist === p
                        ? `bg-gradient-to-r ${PLAYLIST_COLORS[p]} text-white border-transparent shadow-sm`
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/30"
                    }`}>
                    {PLAYLIST_EMOJI[p]} {p}
                  </motion.button>
                ))}
              </div>

              {/* Spotify connect */}
              {spotifyConnected ? (
                <div className="w-full mt-2 space-y-2">
                  <div className="rounded-xl overflow-hidden">
                    <iframe 
                      style={{ borderRadius: '12px' }} 
                      src={spotifyIframeUrl} 
                      width="100%" 
                      height="152" 
                      frameBorder="0" 
                      allowFullScreen={false} 
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                      loading="lazy">
                    </iframe>
                  </div>
                  {topTracks.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase font-serif px-1">Your Top Tracks</p>
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1" style={{ scrollbarWidth: "thin" }}>
                        {topTracks.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setSpotifyIframeUrl(`https://open.spotify.com/embed/track/${t.id}?utm_source=generator&theme=0`)}
                            className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                          >
                            <img src={t.album?.images[2]?.url || t.album?.images[0]?.url} alt="" className="w-8 h-8 rounded object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-foreground truncate">{t.name}</p>
                              <p className="text-[9px] text-muted-foreground truncate">{t.artists.map((a: any) => a.name).join(", ")}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button 
                  onClick={() => {
                    setConnectingSpotify(true);
                    redirectToAuthCodeFlow(SPOTIFY_CLIENT_ID);
                  }}
                  disabled={connectingSpotify}
                  className="w-full text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-border rounded-xl disabled:opacity-50 cursor-pointer">
                  <span className="text-[#1DB954] text-xs">♪</span>
                  {connectingSpotify ? "Redirecting to Spotify..." : "Connect Spotify for your own music"}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
