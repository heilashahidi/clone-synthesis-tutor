const API_URL = import.meta.env.VITE_TUTOR_API_URL ?? "";
const TIMEOUT_MS = 2000;

type TutorApiResponse = {
  text: string;
  ok: boolean;
};

/** True when a proxy endpoint is configured. The LLM safety net
 *  short-circuits when this is false (no fetch is made). */
export function isLlmConfigured(): boolean {
  return Boolean(API_URL);
}

export async function callTutorLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<TutorApiResponse> {
  if (!API_URL) {
    return { text: "", ok: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}/tutor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: systemPrompt, user: userPrompt }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { text: "", ok: false };
    }

    const data = await res.json();
    return { text: data.text ?? "", ok: true };
  } catch {
    clearTimeout(timeout);
    return { text: "", ok: false };
  }
}
