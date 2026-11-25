// Decap CMS 登录第一步：把登录弹窗重定向到 GitHub 的授权页。
// 需要在 Vercel 里配置环境变量 GITHUB_CLIENT_ID（来自 GitHub OAuth App）。
const crypto = require("crypto");

module.exports = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("GITHUB_CLIENT_ID is not configured");
    return;
  }
  const state = crypto.randomBytes(16).toString("hex");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const redirectUri = proto + "://" + host + "/api/callback";
  res.setHeader(
    "Set-Cookie",
    "oauth_state=" + state + "; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=600"
  );
  const url =
    "https://github.com/login/oauth/authorize" +
    "?client_id=" + encodeURIComponent(clientId) +
    "&redirect_uri=" + encodeURIComponent(redirectUri) +
    "&scope=" + encodeURIComponent("repo") +
    "&state=" + encodeURIComponent(state);
  res.writeHead(302, { Location: url });
  res.end();
};
