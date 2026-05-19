// Tutor proxy (Cloudflare Worker).
//
// Holds the Anthropic and ElevenLabs API keys server-side so they
// never leak into the public frontend bundle.
//
// Routes:
//   POST /tutor   { system, user }            -> { text }
//   POST /tts     { text, voiceId? }          -> audio/mpeg stream
//
// Local dev setup:
//   cd proxy
//   npm install
//   cat > .dev.vars <<EOF
//   ANTHROPIC_API_KEY=sk-ant-...
//   ELEVENLABS_API_KEY=...
//   EOF
//   npm run dev                                       # http://localhost:8787
//
// Deploy:
//   npx wrangler deploy
//   npx wrangler secret put ANTHROPIC_API_KEY
//   npx wrangler secret put ELEVENLABS_API_KEY

type Env = {
  ANTHROPIC_API_KEY: string;
  ELEVENLABS_API_KEY: string;
};

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_MAX_TOKENS = 160;

const ELEVENLABS_DEFAULT_VOICE = "NoOVOzCQFLOvtsMoNcdT"; // Lila
const ELEVENLABS_MODEL = "eleven_flash_v2_5";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function handleTutor(req: Request, env: Env): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) {
    return json(
      { text: "", error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: { system?: unknown; user?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ text: "", error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.system !== "string" || typeof body.user !== "string") {
    return json(
      { text: "", error: "Body must be { system: string, user: string }" },
      { status: 400 }
    );
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: body.system,
      messages: [{ role: "user", content: body.user }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Anthropic error:", res.status, errText.slice(0, 500));
    return json(
      { text: "", error: `Anthropic ${res.status}` },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.[0]?.text ?? "";
  return json({ text });
}

async function handleTts(req: Request, env: Env): Promise<Response> {
  if (!env.ELEVENLABS_API_KEY) {
    return json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: { text?: unknown; voiceId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.text !== "string" || !body.text.trim()) {
    return json({ error: "text must be a non-empty string" }, { status: 400 });
  }
  const voiceId =
    typeof body.voiceId === "string" && body.voiceId
      ? body.voiceId
      : ELEVENLABS_DEFAULT_VOICE;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: body.text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    console.error("ElevenLabs error:", res.status, errText.slice(0, 300));
    return json({ error: `ElevenLabs ${res.status}` }, { status: 502 });
  }

  // Stream the audio bytes straight through.
  return new Response(res.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(req.url);
    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: CORS_HEADERS,
      });
    }

    try {
      if (url.pathname === "/tutor") return await handleTutor(req, env);
      if (url.pathname === "/tts") return await handleTts(req, env);
    } catch (err) {
      console.error("Worker error:", err);
      return json({ error: "Internal error" }, { status: 500 });
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
} satisfies ExportedHandler<Env>;
