const CompressionPlugin = require('compression-webpack-plugin')

module.exports = {
  devServer: {
    port: 80,
    https: false,
    open: false
  },
  lintOnSave: false,
  productionSourceMap: false,
  configureWebpack: {
    plugins: [
      new CompressionPlugin({
        algorithm: 'gzip',
        test: /\.js$|\.html$|\.css$/,
        filename: '[path].gz[query]',
        minRatio: 1,
        threshold: 10240,
        deleteOriginalAssets: false
      })
    ]
  },
  chainWebpack: config => {
    /**
     * 关闭 prefetch —— 首屏性能最大的一处浪费。
     *
     * Vue CLI 默认为所有懒加载 chunk 生成 <link rel="prefetch">，
     * 实测文章页 HTML 里有 102 条，会把全部 55 个 CSS + 47 个 JS
     * 在浏览器空闲时全部下载，约 730KB。
     *
     * 用户从文章页进「后台管理」或「聊天室」的概率极低，
     * 预取这些 chunk 纯属浪费带宽和主线程。
     */
    config.plugins.delete('prefetch')

    /**
     * 保留 preload —— 只预加载当前页面必需的 chunk，对首屏有益。
     * （preload 只针对入口依赖，数量和体积都小）
     */
  }
}
