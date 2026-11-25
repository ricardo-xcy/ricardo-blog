// Decap CMS 登录第二步：GitHub 回调回来后，用 code 换 token，
// 再把 token 通过 postMessage 交给后台页面的 Decap，完成登录。
// 需要在 Vercel 里配置环境变量 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET
//（来自同一个 GitHub OAuth App）。

module.exports = async (req, res) => {
  const query = req.query || {};
  const code = query.code;
  const state = query.state;
  const cookies = parseCookies(req.headers.cookie || "");
  if (!code || !state || cookies.oauth_state !== state) {
    return sendResult(res, "error", { message: "Invalid OAuth state" });
  }
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return sendResult(res, "error", { message: "OAuth is not configured" });
  }
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const redirectUri = proto + "://" + host + "/api/callback";
  try {
    const r = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    });
    const data = await r.json();
    if (!data.access_token) {
      return sendResult(res, "error", {
        message: (data && data.error_description) || "GitHub did not return a token",
      });
    }
    return sendResult(res, "success", { token: data.access_token, provider: "github" });
  } catch (e) {
    return sendResult(res, "error", { message: "Token exchange failed" });
  }
};

function parseCookies(header) {
  const out = {};
  header.split(";").forEach(function (part) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function sendResult(res, status, payload) {
  const message = "authorization:github:" + status + ":" + JSON.stringify(payload);
  const html =
    "<!doctype html><html><body><script>" +
    "window.opener.postMessage(" + JSON.stringify(message) + ", '*');" +
    "window.close();" +
    "</script><p>You can close this window.</p></body></html>";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Set-Cookie",
    "oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=0"
  );
  res.status(200).send(html);
}
