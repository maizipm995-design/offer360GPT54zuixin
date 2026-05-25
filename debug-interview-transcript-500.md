# Debug Session: interview-transcript-500

- Status: OPEN
- Scope: 面试逐字稿页面提交生成后返回 `Internal server error`
- Constraints: 先采证，再修复；未确认根因前不改业务逻辑

## Hypotheses

1. 前端到后端的提交字段与后端 DTO/接口定义不一致。
2. 后端到 Coze 工作流的鉴权头、请求格式或字段映射错误。
3. 简历文件对象不符合 Coze `resume_file` 要求，或文件 URL 不可访问。
4. 工作流实际返回成功，但后端解析 `final_output`、保存结果或返回前端时出错。

## Evidence Log

- 2026-05-20: 直接调用 `POST /api/interview-transcripts/requests`，返回 `201 Created`，说明提交接口本身可创建任务。
- 2026-05-20: 随后查询任务状态，`status=failed`，`errorMessage=缺少 INTERVIEW_TRANSCRIPT_WORKFLOW_TOKEN 配置`。
- 2026-05-20: 检查 `docker-compose.dev.yml` 的 `api.environment`，存在 `WEB_APP_BASE_URL` 等配置，但未注入 `INTERVIEW_TRANSCRIPT_WORKFLOW_TOKEN`。
- 2026-05-20: 直接请求 `GET https://5f7454nvm6.coze.site/graph_parameter` 返回 `200`，说明 token 本身有效。
- 2026-05-20: 直接请求 `POST https://5f7454nvm6.coze.site/run`，5 分钟后返回 `504 upstream failed to respond`，说明工作流执行稳定性/耗时仍需继续验证。

## Fix

- 2026-05-20: 在 `docker-compose.dev.yml` 的 `api.environment` 中补充 `INTERVIEW_TRANSCRIPT_WORKFLOW_RUN_URL` 与 `INTERVIEW_TRANSCRIPT_WORKFLOW_TOKEN`，保证 Docker 内 API 容器可实际调用 Coze 工作流。

## Verification

- 2026-05-20: 修复后再次通过 `http://localhost:13000/api/proxy/interview-transcripts/requests` 提交任务，接口继续返回 `201 Created`。
- 2026-05-20: 新任务在 15 秒后保持 `processing`，已不再立即失败为 `缺少 INTERVIEW_TRANSCRIPT_WORKFLOW_TOKEN 配置`。
- 2026-05-20: `docker exec gpt54-o360-dev-api-1 printenv` 确认容器内已有 `INTERVIEW_TRANSCRIPT_WORKFLOW_RUN_URL` 与 `INTERVIEW_TRANSCRIPT_WORKFLOW_TOKEN`。
