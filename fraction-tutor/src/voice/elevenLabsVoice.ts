// ElevenLabs text-to-speech.
// Fetch synthesized audio from ElevenLabs and play it via an
// <audio> element. Each new call cancels the previous request and
// stops the previous audio so the tutor only speaks the latest line.

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
const VOICE_ID =
  (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined) ??
  "NoOVOzCQFLOvtsMoNcdT"; // Lila

// flash is the lowest-latency model; for a short tutor line we don't
// need the highest-quality multilingual one.
const MODEL = "eleven_flash_v2_5";

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let abortController: AbortController | null = null;

export function isVoiceConfigured(): boolean {
  return Boolean(API_KEY);
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
  if (!API_KEY || !text.trim()) return;

  stop();

  abortController = new AbortController();
  const signal = abortController.signal;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": API_KEY,
          "Content-Type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
        signal,
      }
    );

    if (signal.aborted) return;

    if (!res.ok) {
      console.warn(
        `ElevenLabs TTS failed: ${res.status} ${res.statusText}`
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
      console.warn("ElevenLabs TTS error:", err);
    }
  }
}
