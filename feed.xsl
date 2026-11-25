<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>
<xsl:template match="/">
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title><xsl:value-of select="rss/channel/title"/> · RSS 订阅</title>
<style>
  body { font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; background: #faf8f4; color: #262626; max-width: 640px; margin: 0 auto; padding: 40px 20px; line-height: 1.8; }
  h1 { font-size: 26px; }
  p.desc { color: #777; }
  .tip { background: #f6e8df; border-radius: 10px; padding: 14px 18px; margin: 20px 0; font-size: 14.5px; }
  .item { border-top: 1px solid #e8e2d8; padding: 16px 0; }
  .item h2 { font-size: 18px; margin-bottom: 4px; }
  .item a { color: #1a6fd4; text-decoration: none; }
  .item .meta { font-size: 13px; color: #999; }
  .item p { color: #666; font-size: 15px; }
</style>
</head>
<body>
<h1><xsl:value-of select="rss/channel/title"/></h1>
<p class="desc"><xsl:value-of select="rss/channel/description"/></p>
<div class="tip">这是本站的 RSS 订阅源。把这个页面的地址复制到 RSS 阅读器（比如 Reeder、NetNewsWire、Feedly、Fluent Reader）里订阅，博主发新文章时你就能收到更新，不用注册也不用留邮箱。</div>
<xsl:for-each select="rss/channel/item">
<div class="item">
<h2><a href="{link}"><xsl:value-of select="title"/></a></h2>
<div class="meta"><xsl:value-of select="pubDate"/></div>
<p><xsl:value-of select="description"/></p>
</div>
</xsl:for-each>
<p><a href="/">← 回博客首页</a></p>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
