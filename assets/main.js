if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", function (user) {
      if (!user) {
        window.netlifyIdentity.on("login", function () {
          document.location.href = "/admin/";
        });
      }
    });
  }

  var PARTS = {
    "前传": { desc: "开始之前。" },
    "正史": { desc: "开始之后。" }
  };
  var KINDS = ["事", "人"];

  var homeView = document.getElementById("home-view");
  var sectionView = document.getElementById("section-view");
  var articleView = document.getElementById("article");
  var entryList = document.getElementById("entry-list");
  var kindChips = document.getElementById("kind-chips");
  var searchInput = document.getElementById("search");
  var allPosts = [];
  var currentPart = "";
  var currentKind = "";
  var query = "";
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
  function partOf(p) {
    return (p && p.part) ? p.part : "正史";
  }
  function kindOf(p) {
    return (p && p.kind) ? p.kind : "事";
  }
  // 传记按时间正序读：同一分部内按日期从早到晚排
  function sectionEntries(part) {
    return allPosts
      .filter(function (p) { return partOf(p) === part; })
      .sort(function (a, b) { return String(a.date || "").localeCompare(String(b.date || "")); });
  }

  // ---- 首页 ----
  function renderHome() {
    ["前传", "正史"].forEach(function (part) {
      var n = sectionEntries(part).length;
      var el = document.getElementById(part === "前传" ? "count-prequel" : "count-main");
      el.textContent = n === 0 ? "还没有内容" : "共 " + n + " 篇";
    });
  }
  function showHome() {
    currentSlug = "";
    currentPart = "";
    articleView.style.display = "none";
    sectionView.style.display = "none";
    homeView.style.display = "block";
    document.title = "ricardo 的传记";
    renderHome();
    window.scrollTo(0, 0);
  }
  document.getElementById("card-prequel").addEventListener("click", function () {
    location.hash = "#/part/" + encodeURIComponent("前传");
  });
  document.getElementById("card-main").addEventListener("click", function () {
    location.hash = "#/part/" + encodeURIComponent("正史");
  });

  // ---- 分部页 ----
  function renderKindChips() {
    var kinds = [""].concat(KINDS);
    var labels = { "": "全部", "事": "事", "人": "人" };
    var html = "";
    kinds.forEach(function (k) {
      html += '<span class="chip' + (currentKind === k ? " active" : "") + '" data-kind="' + esc(k) + '">' + labels[k] + "</span>";
    });
    kindChips.innerHTML = html;
    kindChips.querySelectorAll(".chip").forEach(function (el) {
      el.addEventListener("click", function () {
        currentKind = el.getAttribute("data-kind");
        renderKindChips();
        renderEntries();
      });
    });
  }
  function renderEntries() {
    var q = query.trim().toLowerCase();
    var entries = sectionEntries(currentPart).filter(function (p) {
      if (currentKind && kindOf(p) !== currentKind) return false;
      if (!q) return true;
      var hay = (p.title + " " + (p.description || "")).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    if (!entries.length) {
      entryList.innerHTML = '<p class="empty">这里还空着，<a href="/admin/">去后台写第一篇</a>。</p>';
      return;
    }
    var html = "";
    entries.forEach(function (p) {
      html += '<div class="entry" data-slug="' + esc(p.slug) + '">'
        + '<div class="meta"><span class="kind">' + esc(kindOf(p)) + '</span>' + esc(fmtDate(p.date)) + '</div>'
        + '<h3>' + esc(p.title) + '</h3>'
        + (p.description ? '<p>' + esc(p.description) + '</p>' : '')
        + '</div>';
    });
    entryList.innerHTML = html;
    entryList.querySelectorAll(".entry").forEach(function (el) {
      el.addEventListener("click", function () {
        location.hash = "#/post/" + encodeURIComponent(el.getAttribute("data-slug"));
      });
    });
  }
  function showSection(part) {
    if (!PARTS[part]) { showHome(); return; }
    currentSlug = "";
    currentPart = part;
    currentKind = "";
    query = "";
    searchInput.value = "";
    document.getElementById("section-title").textContent = part;
    var n = sectionEntries(part).length;
    document.getElementById("section-sub").textContent = PARTS[part].desc + (n === 0 ? "" : " 共 " + n + " 篇。");
    renderKindChips();
    renderEntries();
    homeView.style.display = "none";
    articleView.style.display = "none";
    sectionView.style.display = "block";
    document.title = part + " · ricardo 的传记";
    window.scrollTo(0, 0);
  }
  document.getElementById("section-back").addEventListener("click", function () { location.hash = ""; });
  searchInput.addEventListener("input", function () {
    query = searchInput.value;
    renderEntries();
  });

  // ---- 文章页 ----
  function showPost(slug) {
    fetch("posts/" + slug + ".html").then(function (r) {
      if (!r.ok) throw new Error("not found");
      return r.text();
    }).then(function (html) {
      var post = null;
      for (var i = 0; i < allPosts.length; i++) {
        if (allPosts[i].slug === slug) { post = allPosts[i]; break; }
      }
      currentSlug = slug;
      currentPart = post ? partOf(post) : "";
      document.getElementById("article-title").textContent = post ? post.title : slug;
      document.getElementById("back-btn").textContent = "← 返回" + (currentPart || "");

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
      document.getElementById("article-meta").innerHTML =
        esc(post ? fmtDate(post.date) : "") + " · "
        + esc(partOf(post)) + " · " + esc(kindOf(post))
        + " · 全文约 " + chars + " 字 · 约 " + mins + " 分钟";

      // 相关阅读：同分部优先同类型，最多 3 篇
      var relBox = document.getElementById("related");
      var relList = document.getElementById("related-list");
      var myPart = partOf(post);
      var myKind = kindOf(post);
      var sameKind = allPosts.filter(function (p) {
        return p.slug !== slug && partOf(p) === myPart && kindOf(p) === myKind;
      });
      var samePart = allPosts.filter(function (p) {
        return p.slug !== slug && partOf(p) === myPart && kindOf(p) !== myKind;
      });
      var related = sameKind.concat(samePart).slice(0, 3);
      if (related.length) {
        var relHtml = "";
        related.forEach(function (p) {
          relHtml += '<div class="rel" data-slug="' + esc(p.slug) + '">'
            + '<h4>' + esc(p.title) + '</h4>'
            + '<div class="meta">' + esc(partOf(p)) + ' · ' + esc(kindOf(p)) + ' · ' + esc(fmtDate(p.date)) + '</div>'
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

      // 上一篇 / 下一篇：同分部内按时间顺序
      var nav = document.getElementById("post-nav");
      var list = sectionEntries(myPart);
      var idx = -1;
      for (var k = 0; k < list.length; k++) {
        if (list[k].slug === slug) { idx = k; break; }
      }
      var navHtml = "";
      if (idx > 0) {
        navHtml += '<a href="#/post/' + encodeURIComponent(list[idx - 1].slug) + '">← 上一篇：' + esc(list[idx - 1].title) + '</a>';
      } else {
        navHtml += "<span></span>";
      }
      if (idx >= 0 && idx < list.length - 1) {
        navHtml += '<a href="#/post/' + encodeURIComponent(list[idx + 1].slug) + '" style="text-align:right">下一篇：' + esc(list[idx + 1].title) + ' →</a>';
      }
      nav.innerHTML = navHtml;

      homeView.style.display = "none";
      sectionView.style.display = "none";
      articleView.style.display = "block";
      document.title = (post ? post.title : slug) + " · ricardo 的传记";
      window.scrollTo(0, 0);
      loadGiscus(slug);
    }).catch(function () {
      showHome();
    });
  }
  function route() {
    var m = location.hash.match(/^#\/post\/(.+)$/);
    if (m) { showPost(decodeURIComponent(m[1])); return; }
    var s = location.hash.match(/^#\/part\/(.+)$/);
    if (s) { showSection(decodeURIComponent(s[1])); return; }
    showHome();
  }
  document.getElementById("back-btn").addEventListener("click", function () {
    location.hash = currentPart ? "#/part/" + encodeURIComponent(currentPart) : "";
  });
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
    route();
  }).catch(function () {
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
