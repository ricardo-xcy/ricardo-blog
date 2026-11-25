// Build script: reads posts/*.md, renders each article to HTML,
// writes posts.json (article list) and feed.xml (RSS), and copies
// static files into dist/.
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");

const SITE_URL = "https://xcy1.de5.net";
const SITE_TITLE = "ricardo 的传记";
const SITE_DESC = "一些事，一些人。";

const root = __dirname;
const dist = path.join(root, "dist");
const postsDir = path.join(root, "posts");

// YAML dates parse to Date objects; format them as YYYY-MM-DD in UTC
// so the day never shifts with the build server's timezone.
function fmtDate(d) {
  if (!d) return "";
  if (d instanceof Date && !isNaN(d)) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  return String(d).slice(0, 10);
}

function toRfcDate(d) {
  if (!d) return new Date().toUTCString();
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt) ? new Date().toUTCString() : dt.toUTCString();
}

function escXml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normTags(t) {
  if (Array.isArray(t)) return t.map(String);
  if (typeof t === "string" && t.trim()) {
    return t.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "posts"), { recursive: true });

// Copy static files
fs.copyFileSync(path.join(root, "index.html"), path.join(dist, "index.html"));
fs.copyFileSync(path.join(root, "404.html"), path.join(dist, "404.html"));
fs.copyFileSync(path.join(root, "_headers"), path.join(dist, "_headers"));
fs.copyFileSync(path.join(root, "feed.xsl"), path.join(dist, "feed.xsl"));
fs.cpSync(path.join(root, "assets"), path.join(dist, "assets"), { recursive: true });
fs.cpSync(path.join(root, "admin"), path.join(dist, "admin"), { recursive: true });
fs.cpSync(path.join(root, "images"), path.join(dist, "images"), { recursive: true });

// Build posts
const files = fs.existsSync(postsDir)
  ? fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"))
  : [];

const posts = [];
for (const file of files) {
  const src = fs.readFileSync(path.join(postsDir, file), "utf8");
  const { data, content } = matter(src);
  const slug = file.replace(/\.md$/, "");
  const html = marked.parse(content);
  const plain = content
    .replace(/[#>*`\[\]()!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const excerpt = data.description || plain.slice(0, 120);
  fs.writeFileSync(path.join(dist, "posts", slug + ".html"), html);
  posts.push({
    slug,
    title: data.title || slug,
    date: fmtDate(data.date),
    description: excerpt,
    part: data.part || "正史",
    kind: data.kind || "事",
    tags: normTags(data.tags),
  });
}

posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
fs.writeFileSync(
  path.join(dist, "posts.json"),
  JSON.stringify(posts, null, 2)
);

// RSS feed
const items = posts
  .map((p) => {
    const link = SITE_URL + "/#/post/" + encodeURIComponent(p.slug);
    return (
      "    <item>\n" +
      "      <title>" + escXml(p.title) + "</title>\n" +
      "      <link>" + escXml(link) + "</link>\n" +
      "      <guid>" + escXml(link) + "</guid>\n" +
      "      <pubDate>" + toRfcDate(p.date) + "</pubDate>\n" +
      "      <description>" + escXml(p.description) + "</description>\n" +
      "    </item>"
    );
  })
  .join("\n");

const feed =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>\n' +
  '<rss version="2.0">\n' +
  "  <channel>\n" +
  "    <title>" + escXml(SITE_TITLE) + "</title>\n" +
  "    <link>" + SITE_URL + "/</link>\n" +
  "    <description>" + escXml(SITE_DESC) + "</description>\n" +
  "    <language>zh-CN</language>\n" +
  (items ? items + "\n" : "") +
  "  </channel>\n" +
  "</rss>\n";
fs.writeFileSync(path.join(dist, "feed.xml"), feed);

console.log("Built " + posts.length + " post(s) + feed.xml.");
