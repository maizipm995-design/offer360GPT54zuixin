# 简历垂直排版旧 `lineHeight` 草稿 dry-run 执行记录

## 执行背景
- 目标脚本：`apps/api/prisma/backfill-resume-global-vertical-spacing.mjs`
- 目标范围：扫描全库 `resume_drafts` 中“没有 `verticalSpacing`、但仍保留旧 `lineHeight / sectionSpacing / itemSpacing`”的历史草稿
- 本次执行模式：`dry-run`
- 执行日期：`2026-05-09`

## 首次执行情况
- 执行命令：

```bash
npm run db:backfill:resume-global-vertical-spacing
```

- 执行结果：失败
- 失败原因：当前 shell 未注入 `DATABASE_URL`，Prisma 初始化时报错 `Environment variable not found: DATABASE_URL`
- 结论：该脚本在本仓库当前环境下，执行前需要先 `source .env`

## 正式 dry-run 执行
- 执行命令：

```bash
set -a
source .env
set +a
npm run db:backfill:resume-global-vertical-spacing
```

- 原始输出：

```text
> offer360-platform@1.0.0 db:backfill:resume-global-vertical-spacing
> npm run prisma:backfill-resume-global-vertical-spacing --workspace @offer360/api --

> @offer360/api@1.0.0 prisma:backfill-resume-global-vertical-spacing
> node prisma/backfill-resume-global-vertical-spacing.mjs

[resume-global-spacing-backfill] mode=dry-run
[resume-global-spacing-backfill] matched_drafts=0
```

## 结果摘要
- 扫描结果：`matched_drafts=0`
- 命中的历史草稿数量：`0`
- 样本摘要：无
- 当前库状态说明：本地开发库中暂未发现仍停留在“仅旧 `lineHeight`、未升级到 `verticalSpacing`”结构的历史草稿

## 后续建议
- 正式执行 `--apply` 前，仍建议沿用同样的环境注入方式：

```bash
set -a
source .env
set +a
npm run db:backfill:resume-global-vertical-spacing -- --apply
```

- 如果后续切换到其他数据库环境，应改为加载对应环境文件后再执行
- 若要做小范围验证，可追加 `--draftId=草稿ID` 定向执行
