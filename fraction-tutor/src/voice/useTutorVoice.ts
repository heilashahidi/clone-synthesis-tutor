import { useEffect, useRef, useState } from "react";
import type { TutorMessage } from "../engine/types";
import { speak, stop } from "./elevenLabsVoice";

/**
 * Plays the latest tutor message via ElevenLabs whenever a new one
 * appears. Student messages are ignored. In-flight playback is
 * cancelled if a newer tutor message arrives before the previous
 * one finishes. When `muted` flips to true, current playback stops
 * and new messages are not spoken.
 *
 * Returns `isSpeaking` — true between the moment a new tutor message
 * starts and the moment its audio finishes (or fails / is muted).
 * Used to gate the Continue button so kids hear the full sentence
 * before they can advance. When muted or when no proxy is configured,
 * `isSpeaking` stays false so the UI doesn't get stuck.
 */
export function useTutorVoice(
  messages: TutorMessage[],
  muted: boolean = false
): { isSpeaking: boolean } {
  const lastSpokenId = useRef<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Stop any in-flight audio the moment the user mutes. The stop()
  // call fires the in-flight onEnd, which flips isSpeaking to false.
  useEffect(() => {
    if (muted) stop();
  }, [muted]);

  useEffect(() => {
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
    const myId = latest.id;

    if (muted) {
      // Don't speak, but also don't gate the UI on speech that's
      // never going to play.
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    void speak(latest.text, () => {
      // Only clear isSpeaking if we're still on this message. If a
      // newer message has arrived, it has already set isSpeaking back
      // to true and we'd be clobbering that.
      if (lastSpokenId.current === myId) {
        setIsSpeaking(false);
      }
    });
  }, [messages, muted]);

  return { isSpeaking };
}
