if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", function (user) {
      if (!user) {
        window.netlifyIdentity.on("login", function () {
          document.location.href = "/admin/";
        });
      }
    });
  }

  var listView = document.getElementById("list-view");
  var articleView = document.getElementById("article");
  var postList = document.getElementById("post-list");
  var tagsBox = document.getElementById("tags");
  var searchInput = document.getElementById("search");
  var allPosts = [];
  var query = "";
  var activeTag = "";
  var currentSlug = "";

  // ---- 主题 ----
  var themeBtn = document.getElementById("theme-btn");
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }
  function updateThemeBtn() {
    themeBtn.textContent = currentTheme() === "dark" ? "☀ 浅色" : "☾ 深色";
  }
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("blog-theme", t); } catch (e) {}
    updateThemeBtn();
    if (articleView.style.display === "block" && currentSlug) loadGiscus(currentSlug);
  }
  themeBtn.addEventListener("click", function () {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  });
  updateThemeBtn();

  // ---- 工具 ----
  function fmtDate(d) {
    if (!d) return "";
    var dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.getFullYear() + "年" + (dt.getMonth() + 1) + "月" + dt.getDate() + "日";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function tagsOf(p) {
    if (!p) return [];
    if (Array.isArray(p.tags)) return p.tags;
    if (typeof p.tags === "string" && p.tags) return p.tags.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    return [];
  }

  // ---- 列表渲染（搜索 + 标签筛选）----
  function renderTags() {
    var seen = {};
    var tags = [];
    allPosts.forEach(function (p) {
      tagsOf(p).forEach(function (t) {
        if (!seen[t]) { seen[t] = true; tags.push(t); }
      });
    });
    var html = '<span class="chip' + (activeTag === "" ? " active" : "") + '" data-tag="">全部</span>';
    tags.forEach(function (t) {
      html += '<span class="chip' + (activeTag === t ? " active" : "") + '" data-tag="' + esc(t) + '">' + esc(t) + "</span>";
    });
    tagsBox.innerHTML = html;
    tagsBox.querySelectorAll(".chip").forEach(function (el) {
      el.addEventListener("click", function () {
        activeTag = el.getAttribute("data-tag");
        renderTags();
        renderList();
      });
    });
  }
  function renderList() {
    var q = query.trim().toLowerCase();
    var filtered = allPosts.filter(function (p) {
      if (activeTag && tagsOf(p).indexOf(activeTag) === -1) return false;
      if (!q) return true;
      var hay = (p.title + " " + (p.description || "") + " " + tagsOf(p).join(" ")).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    if (!filtered.length) {
      postList.innerHTML = '<p class="empty">没有找到相关文章。</p>';
      return;
    }
    var html = "";
    filtered.forEach(function (p) {
      var tagHtml = tagsOf(p).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
      html += '<div class="post" data-slug="' + esc(p.slug) + '">'
        + '<div class="meta">' + esc(fmtDate(p.date)) + '</div>'
        + '<h3>' + esc(p.title) + '</h3>'
        + (p.description ? '<p>' + esc(p.description) + '</p>' : '')
        + tagHtml
        + '</div>';
    });
    postList.innerHTML = html;
    postList.querySelectorAll(".post").forEach(function (el) {
      el.addEventListener("click", function () {
        location.hash = "#/post/" + encodeURIComponent(el.getAttribute("data-slug"));
      });
    });
  }
  searchInput.addEventListener("input", function () {
    query = searchInput.value;
    renderList();
  });

  // ---- 文章页 ----
  function showList() {
    currentSlug = "";
    articleView.style.display = "none";
    listView.style.display = "block";
    document.title = "ricardo 的博客";
    window.scrollTo(0, 0);
  }
  function showPost(slug) {
    fetch("posts/" + slug + ".html").then(function (r) {
      if (!r.ok) throw new Error("not found");
      return r.text();
    }).then(function (html) {
      var post = null;
      var idx = -1;
      for (var i = 0; i < allPosts.length; i++) {
        if (allPosts[i].slug === slug) { post = allPosts[i]; idx = i; break; }
      }
      currentSlug = slug;
      document.getElementById("article-title").textContent = post ? post.title : slug;

      var bodyEl = document.getElementById("article-body");
      bodyEl.innerHTML = html;

      // 目录：正文里有 2 个以上小标题时显示
      var tocWrap = document.getElementById("toc-wrap");
      var tocList = document.getElementById("toc");
      var heads = bodyEl.querySelectorAll("h2, h3");
      if (heads.length >= 2) {
        var tocHtml = "";
        heads.forEach(function (h, j) {
          var id = "toc-" + j;
          h.id = id;
          tocHtml += '<li><a href="#' + id + '">' + esc(h.textContent) + "</a></li>";
        });
        tocList.innerHTML = tocHtml;
        tocWrap.style.display = "block";
      } else {
        tocWrap.style.display = "none";
      }

      // 字数 + 阅读时间
      var chars = (bodyEl.textContent || "").replace(/\s+/g, "").length;
      var mins = Math.max(1, Math.round(chars / 400));
      var tagHtml = post ? tagsOf(post).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("") : "";
      document.getElementById("article-meta").innerHTML =
        esc(post ? fmtDate(post.date) : "") + " · 全文约 " + chars + " 字 · 约 " + mins + " 分钟" + tagHtml;

      // 相关阅读：相同标签的文章，最多 3 篇
      var relBox = document.getElementById("related");
      var relList = document.getElementById("related-list");
      var myTags = tagsOf(post);
      var related = allPosts.filter(function (p) {
        if (p.slug === slug) return false;
        return tagsOf(p).some(function (t) { return myTags.indexOf(t) !== -1; });
      }).slice(0, 3);
      if (related.length) {
        var relHtml = "";
        related.forEach(function (p) {
          relHtml += '<div class="rel" data-slug="' + esc(p.slug) + '">'
            + '<h4>' + esc(p.title) + '</h4>'
            + '<div class="meta">' + esc(fmtDate(p.date)) + '</div>'
            + '</div>';
        });
        relList.innerHTML = relHtml;
        relList.querySelectorAll(".rel").forEach(function (el) {
          el.addEventListener("click", function () {
            location.hash = "#/post/" + encodeURIComponent(el.getAttribute("data-slug"));
          });
        });
        relBox.style.display = "block";
      } else {
        relBox.style.display = "none";
      }

      // 上一篇 / 下一篇
      var nav = document.getElementById("post-nav");
      var navHtml = "";
      if (idx > 0) {
        navHtml += '<a href="#/post/' + encodeURIComponent(allPosts[idx - 1].slug) + '">← 上一篇：' + esc(allPosts[idx - 1].title) + '</a>';
      } else {
        navHtml += "<span></span>";
      }
      if (idx >= 0 && idx < allPosts.length - 1) {
        navHtml += '<a href="#/post/' + encodeURIComponent(allPosts[idx + 1].slug) + '" style="text-align:right">下一篇：' + esc(allPosts[idx + 1].title) + ' →</a>';
      }
      nav.innerHTML = navHtml;

      listView.style.display = "none";
      articleView.style.display = "block";
      document.title = (post ? post.title : slug) + " · ricardo 的博客";
      window.scrollTo(0, 0);
      loadGiscus(slug);
    }).catch(function () {
      showList();
    });
  }
  function route() {
    var m = location.hash.match(/^#\/post\/(.+)$/);
    if (m) { showPost(decodeURIComponent(m[1])); }
    else { showList(); }
  }
  document.getElementById("back-btn").addEventListener("click", function () { location.hash = ""; });
  document.getElementById("home-link").addEventListener("click", function (e) { e.preventDefault(); location.hash = ""; });
  document.getElementById("nav-home").addEventListener("click", function (e) { e.preventDefault(); location.hash = ""; });
  window.addEventListener("hashchange", route);

  // ---- 图片灯箱 ----
  var lightbox = document.getElementById("lightbox");
  document.getElementById("article-body").addEventListener("click", function (e) {
    if (e.target && e.target.tagName === "IMG") {
      lightbox.querySelector("img").src = e.target.src;
      lightbox.style.display = "flex";
    }
  });
  lightbox.addEventListener("click", function () { lightbox.style.display = "none"; });

  // ---- 评论（Giscus）----
  function loadGiscus(slug) {
    var container = document.getElementById("giscus");
    container.innerHTML = "";
    var s = document.createElement("script");
    s.src = "https://giscus.app/client.js";
    s.setAttribute("data-repo", "ricardo-xcy/ricardo-blog");
    s.setAttribute("data-repo-id", "R_kgDOV7Ks_Q");
    s.setAttribute("data-category", "General");
    s.setAttribute("data-category-id", "DIC_kwDOV7Ks_c4DL7MT");
    s.setAttribute("data-mapping", "specific");
    s.setAttribute("data-term", slug);
    s.setAttribute("data-strict", "0");
    s.setAttribute("data-reactions-enabled", "1");
    s.setAttribute("data-emit-metadata", "0");
    s.setAttribute("data-input-position", "bottom");
    s.setAttribute("data-theme", currentTheme());
    s.setAttribute("data-lang", "zh-CN");
    s.setAttribute("crossorigin", "anonymous");
    s.async = true;
    container.appendChild(s);
  }

  // ---- 复制文章链接 ----
  document.getElementById("copy-btn").addEventListener("click", function () {
    var btn = this;
    var url = location.href;
    function done() {
      btn.textContent = "已复制";
      setTimeout(function () { btn.textContent = "复制文章链接"; }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); done(); });
    } else { fallbackCopy(url); done(); }
    function fallbackCopy(text) {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
    }
  });

  // ---- 阅读进度 + 回到顶部 ----
  var progressBar = document.getElementById("progress");
  var topBtn = document.getElementById("top-btn");
  window.addEventListener("scroll", function () {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    progressBar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
    topBtn.style.display = h.scrollTop > 300 ? "block" : "none";
  }, { passive: true });
  topBtn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  // ---- 加载文章列表 ----
  fetch("posts.json").then(function (r) { return r.json(); }).then(function (posts) {
    allPosts = posts;
    renderTags();
    renderList();
    route();
  }).catch(function () {
    postList.innerHTML = '<p class="empty">文章列表加载失败，刷新试试。</p>';
    route();
  });

  // 不蒜子加载失败时隐藏统计行
  setTimeout(function () {
    var pv = document.getElementById("busuanzi_value_site_pv");
    if (pv && !pv.textContent.trim()) {
      var stats = document.getElementById("stats");
      if (stats) stats.style.display = "none";
    }
  }, 4000);
