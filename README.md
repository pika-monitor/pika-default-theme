# Pika Default Theme

Pika Monitor 的官方默认公开主题，同时也是开发第三方 Pika 主题的参考实现。

## 开发

```bash
npm ci
npm run dev
```

开发服务默认运行在 `http://localhost:5173`，并将 `/api/*` 代理到 `http://localhost:8080`。

## 构建

```bash
npm run build
```

可安装的主题包根目录需要包含：

```text
pika-theme.json
dist/
  index.html
  assets/
```

将 `pika-theme.json` 和 `dist/` 放在 ZIP 根目录，即可从 Pika 管理后台上传安装。

## 数据刷新

轮询间隔集中定义在 `src/constants.ts` 的 `POLLING_INTERVALS`：服务器列表每 5 秒刷新，详情最新指标每 5 秒刷新，自动刷新模式的历史曲线每 10 秒刷新，主机及网络接口信息每 30 秒刷新。历史模式的曲线不定时轮询，监控页面原有的 30 秒轮询保持不变。

页面隐藏时暂停定时轮询。前端刷新间隔与 agent 采集间隔相互独立，刷新频率不等于指标采样频率。

## 创建自己的主题

Fork 或复制本项目后，请先修改 `pika-theme.json` 中的 `id`、`name`、`version` 和作者信息。

`default` 是 Pika 内置主题的保留 ID，第三方主题不能使用它。

## 许可证

[MIT](LICENSE)
