// Lightweight Google Cloud Text-to-Speech helper using fetch.
// Expects an API key with access to Text-to-Speech v1 (can reuse existing Google API key if enabled).
// Falls back gracefully if key missing.

// Simplified fixed-voice TTS. Always uses Chirp3 HD Achird male voice via v1beta1 endpoint.
// Keeps only essential adjustable parameters for pacing if needed.
export interface SimpleTTSOptions {
  speakingRate?: number; // default 1.0
  pitch?: number;        // default 0
}
// Per user request: use ONLY the Google Search API key (must belong to a GCP project with Text-to-Speech API enabled)
const API_KEY = (import.meta.env?.VITE_GOOGLE_SEARCH_API_KEY as string) || '';

// Cache to prevent repeated synth of same text
const audioCache = new Map<string, string>();
const CHIRP_VOICE = 'en-IN-Chirp3-HD-Despina';

function hashText(t: string): string {
  return `${t.length}:${t.slice(0,64)}`; // lightweight, sufficient for cache
}

export async function synthesizeSpeech(text: string, opts: SimpleTTSOptions = {}): Promise<string | null> {
  if (!API_KEY) {
    console.warn('TTS API key missing (VITE_GOOGLE_SEARCH_API_KEY).');
    return null;
  }
  try {
    const key = hashText(text + JSON.stringify({ r: opts.speakingRate, p: opts.pitch }));
    if (audioCache.has(key)) return audioCache.get(key)!;
    const sanitized = text
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const plain = sanitized.replace(/<[^>]+>/g,'');
    const body = {
      input: { text: plain.slice(0,5000) },
      voice: { languageCode: 'en-IN', name: CHIRP_VOICE },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: opts.speakingRate ?? 1.0,
        pitch: opts.pitch ?? 0,
        effectsProfileId: ['small-bluetooth-speaker-class-device']
      }
    };
    const resp = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const raw = await resp.text();
    if (resp.ok) {
      try {
        const json = JSON.parse(raw) as { audioContent?: string };
        if (json.audioContent) {
          const uri = `data:audio/mp3;base64,${json.audioContent}`;
          audioCache.set(key, uri);
          return uri;
        }
      } catch {/* ignore */}
    } else {
      console.error('Chirp synth failed', resp.status, raw.slice(0,200));
    }
    return null;
  } catch (e) {
    console.error('TTS synthesis failed', e);
    return null;
  }
}

// Browser fallback using Web Speech API (not cached, no consistent voice across browsers)
export function speakWithWebAPI(text: string, lang = 'en-US'): boolean {
  if (typeof window === 'undefined') return false;
  const synth = window.speechSynthesis as SpeechSynthesis | undefined;
  if (!synth) return false;
  const utter = new SpeechSynthesisUtterance(text.replace(/\n+/g,' '));
  utter.lang = lang;
  utter.rate = 1.0;
  synth.speak(utter);
  return true;
}

// Convenience helper: try cloud TTS then fallback to Web Speech API
export async function speakSmart(text: string, opts?: SimpleTTSOptions): Promise<boolean> {
  const audio = await synthesizeSpeech(text, opts || {});
  if (audio) {
    const el = new Audio(audio);
    el.play().catch(err => console.error('Audio play failed', err));
    return true;
  }
  return speakWithWebAPI(text);
}
