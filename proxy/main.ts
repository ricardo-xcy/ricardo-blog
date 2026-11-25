// Decap CMS GitHub OAuth proxy for Deno Deploy.
// Routes:
//   /api/auth     -> redirect the login popup to GitHub's authorize page
//   /api/callback -> exchange the code for a token, post it to the opener
// Env vars (set in the Deno Deploy dashboard):
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET (from the GitHub OAuth App)

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function resultPage(status: string, payload: unknown): Response {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const html =
    `<!doctype html><html><body><script>` +
    `window.opener.postMessage(${JSON.stringify(message)}, '*');window.close();` +
    `</script><p>You can close this window.</p></body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "set-cookie":
        "oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=0",
    },
  });
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  if (url.pathname === "/api/auth") {
    const clientId = Deno.env.get("GITHUB_CLIENT_ID");
    if (!clientId) return new Response("GITHUB_CLIENT_ID is not configured", { status: 500 });
    const state = randomState();
    const redirectUri = `${url.origin}/api/callback`;
    const headers = new Headers({
      "set-cookie":
        `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=600`,
      location:
        "https://github.com/login/oauth/authorize" +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent("repo")}` +
        `&state=${encodeURIComponent(state)}`,
    });
    return new Response(null, { status: 302, headers });
  }

  if (url.pathname === "/api/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookies = parseCookies(req.headers.get("cookie") ?? "");
    if (!code || !state || cookies.oauth_state !== state) {
      return resultPage("error", { message: "Invalid OAuth state" });
    }
    const clientId = Deno.env.get("GITHUB_CLIENT_ID");
    const clientSecret = Deno.env.get("GITHUB_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return resultPage("error", { message: "OAuth is not configured" });
    }
    try {
      const r = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: `${url.origin}/api/callback`,
        }),
      });
      const data = await r.json();
      if (!data.access_token) {
        return resultPage("error", {
          message: data.error_description || "GitHub did not return a token",
        });
      }
      return resultPage("success", { token: data.access_token, provider: "github" });
    } catch {
      return resultPage("error", { message: "Token exchange failed" });
    }
  }

  return new Response("Not found", { status: 404 });
});
