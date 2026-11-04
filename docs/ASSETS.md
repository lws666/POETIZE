# 图片资源优化

## 壁纸规格

`/message`、`/jotting`、`/love` 页的背景随机壁纸。

| 项 | 值 |
|---|---|
| 数量 | 14 张 |
| 尺寸 | 1600×900（16:9）|
| 格式 | WebP（q=78）|
| 单张 | 84–326 KB |
| 总计 | 2.6 MB |

原始 JPEG 是 3.7 MB，转 WebP + 降到 1600 宽后省 **30%**。

## 为什么不用 Cloudflare Polish

Polish 需要 Pro 套餐（$20/月，**要绑银行卡**），Free 套餐不可用。
本地方案零成本达到相近效果。

## 重新生成

```bash
cd fe/public/covers

# 需要 cwebp：apt install webp
for f in scene-*.jpg; do
  cwebp -q 78 -resize 1600 900 "$f" -o "${f%.jpg}.webp"
done
```

## 配置

`randomCover` 存在 D1 的 `site_config` 表，JSON 数组：

```json
["/covers/scene-01.webp", "/covers/scene-02.webp", ...]
```

后台改法：配置管理 → `randomCover` → 编辑键值。

## 缓存

`fe/public/_headers` 已配：

```
/covers/*
  Cache-Control: public, max-age=2592000
```

实测 `cf-cache-status: HIT`，图片由边缘节点直接返回。

## 其他图片

| 路径 | 用途 | 格式 |
|---|---|---|
| `/covers/cover-*.jpg` | 文章封面 | JPEG |
| `/assets/*.png` `/assets/*.jpg` | 装饰图（波浪、云、爱心等）| PNG/JPEG |
| `/assets/font.woff2` | 品牌字体 | WOFF2 |
| `/emoji/q*.gif` | 评论表情 30 个 | GIF |
| `/avatar.jpg` `/hero.webp` | 头像与背景 | JPEG/WebP |

## 注意事项

**WebP 兼容性**：现代浏览器全支持（Chrome 32+ / Firefox 65+ / Safari 14+）。
如果需要兼容老浏览器，保留 `scene-*.jpg` 作为后备。

**不要用 Pages Functions 做图片代理**：试过 `_worker.js` 会整站 1019 错误。
