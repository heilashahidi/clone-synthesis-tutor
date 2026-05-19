// Tutor LLM proxy (Cloudflare Worker).
//
// Holds the Anthropic API key server-side and forwards
// short-prompt requests from the fraction-tutor frontend.
//
// Contract:
//   POST /tutor   { system: string, user: string }  ->  { text: string }
//
// Setup (local dev):
//   cd proxy
//   npm install
//   echo "ANTHROPIC_API_KEY=sk-ant-..." > .dev.vars   (gitignored)
//   npm run dev                                       # http://localhost:8787
//   (in fraction-tutor/.env set VITE_TUTOR_API_URL=http://localhost:8787)
//
// Setup (deploy):
//   npx wrangler login
//   npx wrangler deploy
//   npx wrangler secret put ANTHROPIC_API_KEY        # paste your key
//   Set VITE_TUTOR_API_URL in fraction-tutor/.env to the worker URL.

type Env = {
  ANTHROPIC_API_KEY: string;
};

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 160;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(
  body: unknown,
  init: ResponseInit = {}
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(req.url);
    if (url.pathname !== "/tutor") {
      return new Response("Not found", { status: 404, headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: CORS_HEADERS,
      });
    }

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

    try {
      const anthropicRes = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: body.system,
            messages: [{ role: "user", content: body.user }],
          }),
        }
      );

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        console.error(
          "Anthropic API error:",
          anthropicRes.status,
          errText.slice(0, 500)
        );
        return json(
          { text: "", error: `Anthropic ${anthropicRes.status}` },
          { status: 502 }
        );
      }

      const data = (await anthropicRes.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = data.content?.[0]?.text ?? "";
      return json({ text });
    } catch (err) {
      console.error("Worker error:", err);
      return json({ text: "", error: "Internal error" }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
