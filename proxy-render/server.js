// Decap CMS GitHub OAuth proxy (plain Node, no dependencies).
// Routes:
//   /api/auth     -> redirect the login popup to GitHub's authorize page
//   /api/callback -> exchange the code for a token, post it to the opener
// Env vars: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET (from the GitHub OAuth App).
const http = require("http");
const crypto = require("crypto");

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach(function (part) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function resultPage(res, status, payload) {
  const message = "authorization:github:" + status + ":" + JSON.stringify(payload);
  const html =
    "<!doctype html><html><body><script>" +
    "window.opener.postMessage(" + JSON.stringify(message) + ", '*');window.close();" +
    "</script><p>You can close this window.</p></body></html>";
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": "oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=0",
  });
  res.end(html);
}

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  const proto = req.headers["x-forwarded-proto"] || "https";
  const origin = proto + "://" + (req.headers["x-forwarded-host"] || req.headers.host);

  if (url.pathname === "/api/auth") {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("GITHUB_CLIENT_ID is not configured");
      return;
    }
    const state = crypto.randomBytes(16).toString("hex");
    const redirectUri = origin + "/api/callback";
    const loc =
      "https://github.com/login/oauth/authorize" +
      "?client_id=" + encodeURIComponent(clientId) +
      "&redirect_uri=" + encodeURIComponent(redirectUri) +
      "&scope=" + encodeURIComponent("repo") +
      "&state=" + encodeURIComponent(state);
    res.writeHead(302, {
      Location: loc,
      "Set-Cookie": "oauth_state=" + state + "; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=600",
    });
    res.end();
    return;
  }

  if (url.pathname === "/api/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookies = parseCookies(req.headers.cookie);
    if (!code || !state || cookies.oauth_state !== state) {
      return resultPage(res, "error", { message: "Invalid OAuth state" });
    }
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return resultPage(res, "error", { message: "OAuth is not configured" });
    }
    try {
      const r = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: origin + "/api/callback",
        }),
      });
      const data = await r.json();
      if (!data.access_token) {
        return resultPage(res, "error", {
          message: (data && data.error_description) || "GitHub did not return a token",
        });
      }
      return resultPage(res, "success", { token: data.access_token, provider: "github" });
    } catch (e) {
      return resultPage(res, "error", { message: "Token exchange failed" });
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

const port = process.env.PORT || 10000;
server.listen(port, function () {
  console.log("OAuth proxy listening on " + port);
});
