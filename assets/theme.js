// 主题：优先用上次的选择，否则跟随系统
  (function () {
    var t = null;
    try { t = localStorage.getItem("blog-theme"); } catch (e) {}
    if (!t) { t = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light"; }
    document.documentElement.setAttribute("data-theme", t);
  })();
