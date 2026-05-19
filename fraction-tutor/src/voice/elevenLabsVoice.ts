// Tutor text-to-speech, routed through the Cloudflare Worker proxy.
//
// The browser never sees the ElevenLabs API key — it's a Cloudflare
// secret on the Worker side. The frontend asks the proxy for audio
// via `POST /tts`; the proxy talks to ElevenLabs and streams the
// audio back as audio/mpeg.

const PROXY_URL = (import.meta.env.VITE_TUTOR_API_URL as string | undefined) ?? "";

// Voice id isn't a secret — it's safe to keep as a Vite env var.
// If unset, the worker falls back to its default.
const VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined;

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let abortController: AbortController | null = null;

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;

function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/**
 * Rewrite "X/Y" fractions to the spoken form "X over Y"
 * (e.g., "1/2" -> "one over two") so TTS reads fractions
 * consistently. The chat bubble keeps the compact "1/2" display.
 */
export function toSpokenFractions(text: string): string {
  return text.replace(/\b(\d+)\/(\d+)\b/g, (_, n: string, d: string) => {
    return `${numberWord(parseInt(n, 10))} over ${numberWord(parseInt(d, 10))}`;
  });
}

export function isVoiceConfigured(): boolean {
  return Boolean(PROXY_URL);
}

export function stop(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

export async function speak(text: string): Promise<void> {
  if (!PROXY_URL || !text.trim()) return;

  stop();

  abortController = new AbortController();
  const signal = abortController.signal;

  try {
    const res = await fetch(`${PROXY_URL}/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: toSpokenFractions(text),
        ...(VOICE_ID ? { voiceId: VOICE_ID } : {}),
      }),
      signal,
    });

    if (signal.aborted) return;

    if (!res.ok) {
      console.warn(
        `Tutor proxy /tts failed: ${res.status} ${res.statusText}`
      );
      return;
    }

    const blob = await res.blob();
    if (signal.aborted) return;

    const url = URL.createObjectURL(blob);
    currentObjectUrl = url;

    const audio = new Audio(url);
    currentAudio = audio;

    audio.addEventListener("ended", () => {
      if (currentObjectUrl === url) {
        URL.revokeObjectURL(url);
        currentObjectUrl = null;
      }
      if (currentAudio === audio) currentAudio = null;
    });

    try {
      await audio.play();
    } catch (err) {
      // Browsers (especially iOS Safari) block audio until the user
      // has interacted with the page. Subsequent calls after a tap
      // will succeed.
      console.warn("Audio playback blocked:", err);
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      console.warn("TTS proxy error:", err);
    }
  }
}
