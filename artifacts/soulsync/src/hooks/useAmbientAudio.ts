import { useRef, useCallback, useEffect } from "react";

export type Playlist = "Focus" | "Calm" | "Meditation" | "Energy";

export function useAmbientAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<(OscillatorNode | AudioBufferSourceNode)[]>([]);
  const masterGainRef = useRef<GainNode | null>(null);

  const stop = useCallback(() => {
    if (masterGainRef.current && ctxRef.current) {
      const master = masterGainRef.current;
      const now = ctxRef.current.currentTime;
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.8);
    }
    setTimeout(() => {
      nodesRef.current.forEach(n => {
        try { n.stop(); } catch { /* already stopped */ }
      });
      nodesRef.current = [];
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
      masterGainRef.current = null;
    }, 900);
  }, []);

  const play = useCallback((playlist: Playlist, volumePct = 70) => {
    if (ctxRef.current) {
      stop();
      setTimeout(() => startPlayback(playlist, volumePct), 950);
    } else {
      startPlayback(playlist, volumePct);
    }
  }, [stop]);

  function startPlayback(playlist: Playlist, volumePct: number) {
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime((volumePct / 100) * 0.35, ctx.currentTime + 2);
      master.connect(ctx.destination);
      masterGainRef.current = master;

      if (playlist === "Focus") {
        const leftOsc = ctx.createOscillator();
        leftOsc.frequency.value = 200;
        leftOsc.type = "sine";
        const leftPan = ctx.createStereoPanner();
        leftPan.pan.value = -1;
        leftOsc.connect(leftPan);
        leftPan.connect(master);

        const rightOsc = ctx.createOscillator();
        rightOsc.frequency.value = 240;
        rightOsc.type = "sine";
        const rightPan = ctx.createStereoPanner();
        rightPan.pan.value = 1;
        rightOsc.connect(rightPan);
        rightPan.connect(master);

        const noiseBuffer = makeNoiseBuffer(ctx, "pink");
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.04;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1200;
        filter.Q.value = 0.5;
        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(master);

        leftOsc.start();
        rightOsc.start();
        noiseSource.start();
        nodesRef.current = [leftOsc, rightOsc, noiseSource];

      } else if (playlist === "Calm") {
        const noiseBuffer = makeNoiseBuffer(ctx, "brown");
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;
        const lpf = ctx.createBiquadFilter();
        lpf.type = "lowpass";
        lpf.frequency.value = 600;
        lpf.Q.value = 0.7;
        noiseSource.connect(lpf);
        lpf.connect(master);

        const droneOsc = ctx.createOscillator();
        droneOsc.frequency.value = 110;
        droneOsc.type = "sine";
        const droneGain = ctx.createGain();
        droneGain.gain.value = 0.08;
        droneOsc.connect(droneGain);
        droneGain.connect(master);

        noiseSource.start();
        droneOsc.start();
        nodesRef.current = [noiseSource, droneOsc];

      } else if (playlist === "Meditation") {
        const freqs = [108, 216, 432];
        const oscs: OscillatorNode[] = freqs.map((f, i) => {
          const osc = ctx.createOscillator();
          osc.frequency.value = f;
          osc.type = "sine";
          const g = ctx.createGain();
          g.gain.value = i === 2 ? 0.6 : 0.2;
          osc.connect(g);
          g.connect(master);
          return osc;
        });

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.12;
        lfo.type = "sine";
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.06;
        lfo.connect(lfoGain);
        lfoGain.connect(master.gain);
        lfo.start();

        oscs.forEach(o => o.start());
        nodesRef.current = [...oscs, lfo];

      } else if (playlist === "Energy") {
        const chord = [261.63, 329.63, 392.00, 523.25];
        const oscs: OscillatorNode[] = chord.map(f => {
          const osc = ctx.createOscillator();
          osc.frequency.value = f;
          osc.type = "triangle";
          const g = ctx.createGain();
          g.gain.value = 0.18;
          osc.connect(g);
          g.connect(master);
          return osc;
        });

        const arp = ctx.createOscillator();
        arp.frequency.value = 523.25;
        arp.type = "square";
        const arpGain = ctx.createGain();
        arpGain.gain.value = 0.06;
        const arpFilter = ctx.createBiquadFilter();
        arpFilter.type = "lowpass";
        arpFilter.frequency.value = 1000;
        arp.connect(arpFilter);
        arpFilter.connect(arpGain);
        arpGain.connect(master);

        oscs.forEach(o => o.start());
        arp.start();
        nodesRef.current = [...oscs, arp];
      }
    } catch (e) {
      console.warn("Web Audio not available:", e);
    }
  }

  function makeNoiseBuffer(ctx: AudioContext, type: "pink" | "brown") {
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    if (type === "pink") {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    }
    return buffer;
  }

  const setVolume = useCallback((pct: number) => {
    if (masterGainRef.current && ctxRef.current) {
      masterGainRef.current.gain.linearRampToValueAtTime(
        (pct / 100) * 0.35,
        ctxRef.current.currentTime + 0.1
      );
    }
  }, []);

  useEffect(() => () => {
    nodesRef.current.forEach(n => { try { n.stop(); } catch {} });
    if (ctxRef.current) ctxRef.current.close().catch(() => {});
  }, []);

  return { play, stop, setVolume };
}
