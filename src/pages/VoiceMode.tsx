import React from 'react';
import { cn } from '@/lib/utils';
import FlowingColorsShader from '@/components/visuals/FlowingColorsShader';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, Modality, TurnCoverage, MediaResolution, type LiveServerMessage, type Session } from '@google/genai';
import { resampleFloatToInt16, base64FromInt16, int16FromBase64, int16ToFloat32 } from '@/lib/audio/pcm';

export default function VoiceMode() {
  const [entered, setEntered] = React.useState(false);
  const [entryDone, setEntryDone] = React.useState(false);
  const [audioLevel, setAudioLevel] = React.useState(0);
  const [aiAudioLevel, setAiAudioLevel] = React.useState(0);  // For AI speech animation
  const [isListening, setIsListening] = React.useState(true);
  const [micError, setMicError] = React.useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = React.useState<string>('Disconnected');
  const nav = useNavigate();

  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const dataRef = React.useRef<Uint8Array | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = React.useRef<ScriptProcessorNode | null>(null);
  const smoothRef = React.useRef(0); // smoothed level 0..1
  const avgLevelRef = React.useRef(0); // very slow average of smoothed level
  const noiseFloorRef = React.useRef(0.008); // adaptive baseline RMS

  // Live API session + playback state
  const aiRef = React.useRef<GoogleGenAI | null>(null);
  const sessionRef = React.useRef<Session | null>(null);
  const connectingRef = React.useRef(false);
  const playbackGainRef = React.useRef<GainNode | null>(null);
  const playbackCursorRef = React.useRef(0);
  const isModelSpeakingRef = React.useRef(false);
  const activeSourcesRef = React.useRef(0);
  const recentChunksRef = React.useRef<string[]>([]);
  const recentChunkSetRef = React.useRef<Set<string>>(new Set());
  const talkActiveRef = React.useRef(false);
  const wasTalkActiveRef = React.useRef(false);
  const setupReadyRef = React.useRef(false);
  const setupFallbackTimerRef = React.useRef<number | null>(null);
  const talkStartTimeRef = React.useRef(0);
  const forceEndAtRef = React.useRef(0);
  const sentAnyFrameRef = React.useRef(false);

  React.useEffect(() => {
    // Trigger entrance after layout so initial scale(0.6) is committed
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id2);
    });
    const t = setTimeout(() => setEntryDone(true), 1300);
    return () => { cancelAnimationFrame(id1); clearTimeout(t); };
  }, []);

  const stopAudio = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    dataRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch {}
      processorRef.current = null;
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch {}
      sourceRef.current = null;
    }
    // Keep AudioContext alive for playback and analyser; do not close here
    // Reset playback / dedup state
    isModelSpeakingRef.current = false;
    activeSourcesRef.current = 0;
    playbackCursorRef.current = 0;
    recentChunksRef.current = [];
    recentChunkSetRef.current.clear();
    talkActiveRef.current = false;
    wasTalkActiveRef.current = false;
  }, []);

  const startAudio = React.useCallback(async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      streamRef.current = stream;
      // Use persistent AudioContext (create if missing)
      const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024; // enough resolution for level
      analyser.smoothingTimeConstant = 0.85; // reduce flicker
      analyserRef.current = analyser;
      source.connect(analyser);
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
      // Ensure the audio context is running and drop first frames to avoid startup stutter
      try { await ctx.resume(); } catch {}
      let warmups = 10;

      const loop = () => {
        const analyser = analyserRef.current;
        const data = dataRef.current;
        if (!analyser || !data) return;
        analyser.getByteTimeDomainData(data);
        // Compute RMS of centered waveform
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128; // -1..1
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length); // ~0..1
        if (warmups > 0) { warmups--; rafRef.current = requestAnimationFrame(loop); return; }
        // Adaptive noise floor to prevent idle jitter and device variance
        const nf = noiseFloorRef.current;
        const margin = 0.002; // small cushion above floor
        const delta = rms - (nf + margin);
        // Update noise floor slowly when near idle
        if (delta < 0.004) {
          noiseFloorRef.current = nf * 0.995 + rms * 0.005;
        }
        // Map delta to 0..1 with gentle compression
        const gain = 12.0; // amplify above floor
        const raw = Math.max(0, delta * gain);
        const level = Math.max(0, Math.min(1, raw));
        // Low-pass filter to keep orb growth slow & steady (attack/release)
        const prev = smoothRef.current || 0;
        const alphaUp = 0.18;   // faster rise for responsive growth
        const alphaDown = 0.10; // gentle decay
        const a = level > prev ? alphaUp : alphaDown;
        const smooth = prev + (level - prev) * a;
        smoothRef.current = smooth;
        // Update very slow-moving average for adaptive amplitude (UI does not depend on amplitude directly)
        avgLevelRef.current = avgLevelRef.current + (smooth - avgLevelRef.current) * 0.04;
        setAudioLevel(smooth);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      // Mic -> ScriptProcessor for PCM capture to Live API
      try {
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          const session = sessionRef.current;
          // Check if session is still valid
          if (!session) return;
          // Wait until server acknowledges setup (ensures systemInstruction is active)
          if (!setupReadyRef.current) return;
          
          // Half-duplex: don't send mic frames while model is speaking
          if (isModelSpeakingRef.current) {
            // If we were talking and now stopped, signal end of stream once
            if (wasTalkActiveRef.current) {
              try { session?.sendRealtimeInput({ audioStreamEnd: true as any }); } catch {}
              wasTalkActiveRef.current = false;
              talkActiveRef.current = false;
            }
            return;
          }

          // Simple VAD using orb level with hysteresis - ULTRA LOW THRESHOLDS
          const level = smoothRef.current || 0;
          let active = talkActiveRef.current;
          if (!active && level > 0.015) active = true; // start talking - much lower for "hello"
          else if (active && level < 0.008) active = false; // stop talking - lower threshold
          const was = wasTalkActiveRef.current;
          talkActiveRef.current = active;
          const nowMs = performance.now();
          // On rising edge of speech, start a short-turn timer
          if (!was && active) {
            talkStartTimeRef.current = nowMs;
            forceEndAtRef.current = nowMs + 1500; // 1.5s max utterance to catch short greetings
            sentAnyFrameRef.current = false;
          }

          if (!active) {
            if (was) {
              // Send EOS once when speech ends to prompt model to respond
              try { session?.sendRealtimeInput({ audioStreamEnd: true as any }); } catch {}
            }
            wasTalkActiveRef.current = active;
            return; // don't send near-silence
          }

          // If user keeps talking or noise holds level barely above threshold,
          // force a turn end after timeout to ensure a response for short phrases like "hello".
          if (nowMs >= forceEndAtRef.current && sentAnyFrameRef.current) {
            try { session?.sendRealtimeInput({ audioStreamEnd: true as any }); } catch {}
            wasTalkActiveRef.current = false;
            talkActiveRef.current = false;
            return;
          }

          // Encode and send this frame
          const inBuf = e.inputBuffer.getChannelData(0);
          const pcm16 = resampleFloatToInt16(inBuf, ctx.sampleRate, 16000);
          const b64 = base64FromInt16(pcm16);
          if (session) {
            try {
              session.sendRealtimeInput({
                audio: { data: b64, mimeType: 'audio/pcm;rate=16000' },
              });
              sentAnyFrameRef.current = true;
              // Log every 20th frame to avoid spam
              if (Math.random() < 0.05) {
                console.log('[Live API] Sending audio frame, level:', level.toFixed(3));
              }
            } catch { /* ignore transient send errors */ }
          }
          wasTalkActiveRef.current = active;
        };
        // Ensure processor stays active
        const nullGain = ctx.createGain();
        nullGain.gain.value = 0;
        source.connect(processor);
        processor.connect(nullGain);
        nullGain.connect(ctx.destination);
        processorRef.current = processor;
      } catch (e) {
        console.warn('Failed to initialize audio processor', e);
      }
    } catch (e: any) {
      console.warn('Mic error', e);
      setMicError(e?.message || 'Microphone access blocked');
      setIsListening(false);
      stopAudio();
    }
  }, [stopAudio]);

  // Initialize a persistent AudioContext on mount for playback + analysis
  React.useEffect(() => {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn('Failed to create AudioContext:', e);
      }
    }
    return () => {
      try { audioCtxRef.current?.close(); } catch {}
      audioCtxRef.current = null;
    };
  }, []);

  // --- Live API helpers ---
  const schedulePlayback = React.useCallback((b64: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      // Deduplicate repeated chunks
      const set = recentChunkSetRef.current;
      const q = recentChunksRef.current;
      if (set.has(b64)) return;
      set.add(b64);
      q.push(b64);
      if (q.length > 64) { const old = q.shift()!; set.delete(old); }

      const int16 = int16FromBase64(b64);
      const float = int16ToFloat32(int16);
      const sampleRate = 24000; // Live API audio output SR
      const buf = ctx.createBuffer(1, float.length, sampleRate);
      buf.copyToChannel(float, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      // Lazy init playback gain
      if (!playbackGainRef.current) {
        const g = ctx.createGain();
        g.gain.value = 0.85; // slightly lower to reduce acoustic echo
        g.connect(ctx.destination);
        playbackGainRef.current = g;
      }
      // Route through splitter so we can analyse and play without duplicate connections
      // Build the graph BEFORE starting playback
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const splitter = ctx.createGain();
      splitter.gain.value = 1;
      src.connect(splitter);
      splitter.connect(analyser);
      splitter.connect(playbackGainRef.current!);

      const now = ctx.currentTime + 0.05;
      const startAt = Math.max(playbackCursorRef.current || 0, now);
      src.start(startAt);
      // Track speaking state based on active sources
      activeSourcesRef.current += 1;
      isModelSpeakingRef.current = true;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let animFrame: number | null = null;
      const updateLevel = () => {
        if (!src.buffer) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAiAudioLevel(avg / 256);  // Normalize to 0-1
        if (activeSourcesRef.current > 0) {
          animFrame = requestAnimationFrame(updateLevel);
        }
      };
      animFrame = requestAnimationFrame(updateLevel);
      
      src.onended = () => {
        activeSourcesRef.current = Math.max(0, activeSourcesRef.current - 1);
        if (activeSourcesRef.current === 0) {
          isModelSpeakingRef.current = false;
          setAiAudioLevel(0);  // Reset AI audio level
          // snap cursor if we lagged
          playbackCursorRef.current = Math.max(playbackCursorRef.current || 0, ctx.currentTime);
        }
        if (animFrame) cancelAnimationFrame(animFrame);
      };
      playbackCursorRef.current = startAt + buf.duration;
    } catch (e) {
      // Ignore decoding errors for non-audio messages
    }
  }, []);

  const handleServerMessage = React.useCallback((message: LiveServerMessage) => {
    console.log('[Live API] Server message:', {
      type: (message as any)?.serverContent ? 'serverContent' : 'other',
      hasModelTurn: !!(message as any)?.serverContent?.modelTurn,
      turnComplete: (message as any)?.serverContent?.turnComplete,
      interrupted: (message as any)?.serverContent?.interrupted,
      hasGroundingMetadata: !!(message as any)?.serverContent?.groundingMetadata
    });

    // Transcriptions (if enabled)
    const tx = (message as any)?.transcription?.text;
    if (tx) {
      console.log('[Live API] Transcription:', tx);
    }

    // Check for text responses
    try {
      const textParts = (message as any)?.serverContent?.modelTurn?.parts;
      if (Array.isArray(textParts)) {
        for (const p of textParts) {
          if (p?.text) {
            console.log('[Live API] Text response:', p.text);
          }
        }
      }
    } catch {}

    // Prefer inlineData (serverContent.modelTurn.parts) if present
    let scheduled = false;
    try {
      const inParts = (message as any)?.serverContent?.modelTurn?.parts;
      if (Array.isArray(inParts)) {
        for (const p of inParts) {
          if (p?.inlineData?.data && typeof p.inlineData.data === 'string') {
            console.log('[Live API] Scheduling audio chunk, mimeType:', p.inlineData.mimeType);
            schedulePlayback(p.inlineData.data);
            scheduled = true;
          }
        }
      }
    } catch {}

    // Fallback: some SDK versions place audio base64 under message.data
    if (!scheduled && (message as any)?.data && typeof (message as any).data === 'string') {
      console.log('[Live API] Scheduling audio from message.data');
      schedulePlayback((message as any).data);
    }
  }, [schedulePlayback]);

  const connectSession = React.useCallback(async () => {
    if (connectingRef.current || sessionRef.current) return;
    connectingRef.current = true;
    try {
      // Fetch ephemeral token from dev middleware
      const model = 'models/gemini-2.5-flash-native-audio-preview-09-2025';  // Using updated native audio preview model
      const r = await fetch(`/api/ephemeral?model=${encodeURIComponent(model)}`, { method: 'GET' });
      if (!r.ok) throw new Error(`Token request failed: ${r.status}`);
      const j = await r.json();
      if (!j?.token) throw new Error('No token returned');
      const ai = new GoogleGenAI({ apiKey: j.token, apiVersion: 'v1alpha' });
      aiRef.current = ai;

      const config: any = {
        responseModalities: [Modality.AUDIO] as Modality[],
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
        },
        realtimeInputConfig: {
          turnCoverage: TurnCoverage.TURN_INCLUDES_ALL_INPUT,
        },
        // Ensure the model does not ignore short greetings
        proactivity: { proactiveAudio: false },
        contextWindowCompression: {
          triggerTokens: 25600,
          slidingWindow: { targetTokens: 12800 },
        },
        tools: [{ googleSearch: {} }],  // Keep Google Search for current info
        // Note: systemInstruction in config may not work with native-audio-dialog model
        // We send it via sendClientContent instead after connection
        systemInstruction: {
          parts: [{
            text: `You are Ojas, a helpful AI health assistant created by MedTrack. Never say you are created by Google or trained by Google. You are Ojas from MedTrack. When someone greets you, respond warmly and briefly. You have access to Google Search and should use it when asked about current events or when up-to-date information is needed.`
          }]
        },
      };

      const session = await ai.live.connect({
        model,
        config,
        callbacks: {
          onopen: () => {
            console.log('[Live API] WebSocket connected');
            setSessionStatus('Connected');
          },
          onmessage: (m: LiveServerMessage) => {
            const mt = (m as any)?.messageType;
            if (mt) console.log('[Live API] messageType:', mt);
            if ((m as any)?.setupComplete || mt === 'setupComplete' || mt === 'BidiGenerateContentSetupComplete') {
              console.log('[Live API] Setup complete — systemInstruction active');
              setupReadyRef.current = true;
              setSessionStatus('Ready');
              // After setup completes, send a short identity reinforcement as a user turn
              (async () => {
                try {
                  await sessionRef.current?.sendClientContent({
                    turns: [
                      'Remember: You are Ojas from MedTrack, not Google. Please acknowledge.'
                    ]
                  });
                  console.log('[Live API] Identity reinforcement sent after setupComplete');
                } catch (e) {
                  console.warn('[Live API] Failed to send identity reinforcement:', e);
                }
              })();
              return;
            }
            // Check for GoAway message (server warning about disconnect)
            if ((m as any)?.goAway) {
              const timeLeft = (m as any).goAway?.timeLeft;
              console.warn('[Live API] GoAway received, time left:', timeLeft);
              setSessionStatus(`Closing in ${timeLeft || 'unknown'}s`);
            }
            handleServerMessage(m);
          },
          onerror: (e: any) => {
            console.error('[Live API] WebSocket error:', e?.message || e);
            setSessionStatus('Error');
          },
          onclose: (e: any) => {
            console.log('[Live API] WebSocket closed:', e?.reason || 'Unknown');
            setSessionStatus('Disconnected');
            // Clear session reference immediately
            sessionRef.current = null;
            setupReadyRef.current = false;
          },
        },
      });
      sessionRef.current = session;
      
      // Session established; wait for setupComplete before streaming audio
      console.log('[Live API] Session ready — waiting for setupComplete');
      // Start a fallback timer in case some models don't emit setupComplete
      if (setupFallbackTimerRef.current) {
        clearTimeout(setupFallbackTimerRef.current);
      }
      setupFallbackTimerRef.current = window.setTimeout(() => {
        if (!setupReadyRef.current) {
          console.warn('[Live API] setupComplete not received; enabling fallback readiness');
          setupReadyRef.current = true;
          setSessionStatus('Ready (fallback)');
        }
      }, 2000);
    } catch (e: any) {
      console.warn('Failed to connect Live session', e);
      setMicError(e?.message || 'Failed to connect voice session');
      // ensure UI resets
      setIsListening(false);
    } finally {
      connectingRef.current = false;
    }
  }, [handleServerMessage]);

  const disconnectSession = React.useCallback(async () => {
    const s = sessionRef.current;
    sessionRef.current = null;
    try {
      if (s) {
        try { s.sendRealtimeInput({ audioStreamEnd: true as any }); } catch {}
        s.close();
      }
    } catch {}
    aiRef.current = null;
    // Clear dedup / speaking state
    isModelSpeakingRef.current = false;
    activeSourcesRef.current = 0;
    recentChunksRef.current = [];
    recentChunkSetRef.current.clear();
    talkActiveRef.current = false;
    wasTalkActiveRef.current = false;
  }, []);

  // Connect the Live session on mount and keep it alive; mic toggle only starts/stops capture.
  React.useEffect(() => {
    (async () => { await connectSession(); })();
    return () => {
      stopAudio();
      disconnectSession();
      if (setupFallbackTimerRef.current) {
        clearTimeout(setupFallbackTimerRef.current);
        setupFallbackTimerRef.current = null;
      }
    };
  }, [connectSession, disconnectSession, stopAudio]);

  // Mic toggle effect: start/stop mic without tearing down the session
  React.useEffect(() => {
    (async () => {
      if (isListening) {
        await startAudio();
      } else {
        // If we were mid-utterance, send EOS to prompt a response
        try { await sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true as any }); } catch {}
        stopAudio();
        setAudioLevel(0);
        smoothRef.current = 0;
        avgLevelRef.current = 0;
      }
    })();
  }, [isListening, startAudio, stopAudio]);

  // Adaptive amplitude: baseline 0.15, slightly increase up to 0.18 if avg voice level is low
  const baseAmp = 0.15;
  const avg = avgLevelRef.current || 0;
  const extraAmp = 0.03 * Math.max(0, Math.min(1, (0.12 - avg) / 0.12)); // if avg < 0.12, boost up to +0.03
  const amp = baseAmp + extraAmp;
  // Combine user and AI audio levels for orb animation
  const userLevel = smoothRef.current || 0;
  const combinedLevel = Math.max(userLevel, aiAudioLevel);
  const audioScale = 1 + combinedLevel * amp;
  // Pin shader speed constant to eliminate any perceived back/forward when voice starts/stops
  const speedProp = 1.14;
  const combinedScale = (entered ? 1 : 0.6) * audioScale;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Centered circular mask with flowing colors inside; outside remains transparent */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={cn(
            'rounded-full overflow-hidden will-change-transform',
            'w-[28vmin] h-[28vmin] max-w-[300px] max-h-[300px] min-w-[160px] min-h-[160px]'
          )}
          style={{
            transform: `scale(${combinedScale})`,
            opacity: entered ? 1 : 0,
            transition: `transform ${entryDone ? 220 : 1200}ms cubic-bezier(0.22,1,0.36,1), opacity 800ms ease`
          }}
          aria-label="Voice visual"
        >
          <FlowingColorsShader
            className="w-full h-full"
            speed={speedProp}
            contrast={1.12}
            brightness={1.05}
            levels={8}
            warp={1.6}
            audioLevel={combinedLevel}
          />
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-3">
        <Button
          size="icon"
          variant={isListening ? 'default' : 'outline'}
          onClick={() => setIsListening(v => !v)}
          aria-pressed={isListening}
          aria-label={isListening ? 'Mute microphone' : 'Enable microphone'}
          title={isListening ? 'Mute' : 'Enable Mic'}
          className="rounded-full h-12 w-12"
        >
          {isListening ? <MicOff /> : <Mic />}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => nav(-1)}
          aria-label="Close voice mode"
          title="Close"
          className="rounded-full h-12 w-12"
        >
          <X />
        </Button>
      </div>

      {/* Session status */}
      <div className="absolute top-4 left-4 px-3 py-1 text-xs rounded-md bg-card text-card-foreground shadow-sm">
        Status: {sessionStatus}
      </div>

      {/* Mic error banner */}
      {micError && (
        <div className="absolute top-4 inset-x-0 mx-auto w-fit px-4 py-2 text-xs rounded-md bg-destructive text-destructive-foreground shadow">
          {micError}
        </div>
      )}
    </div>
  );
}
