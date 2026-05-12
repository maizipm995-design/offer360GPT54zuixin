# GitHub Webhook 自动部署与数据库增量规范

## 已废弃
- 本文档对应的 `GitHub WebHook 自动部署` 方案已经永久弃用。
- 当前唯一有效方案为：`本地构建离线镜像包 + 手动上传服务器 + docker load + 宿主机 Nginx 反向代理`。
- 服务器不拉取 Git 仓库，不保留部署用源码，不运行 WebHook 监听服务，也不依赖任何线上镜像仓库。

## 当前请参考
- [自动化部署改造手册](file:///Users/maizim/Documents/2605GPT54offer360/docs/自动化部署改造手册.md)
- [生产环境参数与CI-Secrets清单](file:///Users/maizim/Documents/2605GPT54offer360/docs/生产环境参数与CI-Secrets清单.md)
