import { useEffect, useRef } from "react";
import type { TutorMessage } from "../engine/types";
import { speak, stop } from "./elevenLabsVoice";

/**
 * Plays the latest tutor message via ElevenLabs whenever a new one
 * appears. Student messages are ignored. In-flight playback is
 * cancelled if a newer tutor message arrives before the previous
 * one finishes. When `muted` flips to true, current playback stops
 * and new messages are not spoken.
 */
export function useTutorVoice(
  messages: TutorMessage[],
  muted: boolean = false
): void {
  const lastSpokenId = useRef<string | null>(null);

  // Stop any in-flight audio the moment the user mutes.
  useEffect(() => {
    if (muted) stop();
  }, [muted]);

  useEffect(() => {
    if (muted) return;

    let latest: TutorMessage | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === "tutor") {
        latest = messages[i];
        break;
      }
    }
    if (!latest) return;
    if (latest.id === lastSpokenId.current) return;

    lastSpokenId.current = latest.id;
    void speak(latest.text);
  }, [messages, muted]);
}
