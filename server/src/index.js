// Senim tutor backend (Cloudflare Worker). The OpenAI API key lives only in this server's
// environment (env.OPENAI_API_KEY) and is never sent to the browser.
// For now there is one endpoint, to check the setup; the tutor endpoints come next.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") {
      // Reports only WHETHER a key is configured, never the key itself.
      return Response.json({ ok: true, openaiKeyConfigured: Boolean(env.OPENAI_API_KEY) });
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }
};
