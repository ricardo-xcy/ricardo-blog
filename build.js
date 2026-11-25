// Build script: reads posts/*.md, renders each article to HTML,
// writes posts.json (article list) and copies static files into dist/.
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");

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

const root = __dirname;
const dist = path.join(root, "dist");
const postsDir = path.join(root, "posts");

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "posts"), { recursive: true });

// Copy static files
fs.copyFileSync(path.join(root, "index.html"), path.join(dist, "index.html"));
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
  });
}

posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
fs.writeFileSync(
  path.join(dist, "posts.json"),
  JSON.stringify(posts, null, 2)
);
console.log("Built " + posts.length + " post(s).");
