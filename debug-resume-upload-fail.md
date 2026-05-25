# Debug Session: resume-upload-fail

- Status: OPEN
- Scope: 简历演讲稿/面试逐字稿页面，模式二“本地上传附件”提交后生成失败
- Constraints: 先采证，再修复；未确认根因前不改业务逻辑

## Hypotheses

1. 前端 `/api/proxy` 转发 `multipart/form-data` 时文件体被破坏或丢失。
2. 后端创建任务成功，但附件没有正确落到 OSS，导致工作流拿到的 `resume_file.url` 无效。
3. 用户上传文件的 MIME / 扩展名组合异常，触发工作流文件解析失败。
4. `resume_file` 参数结构或远程取文件过程存在兼容性问题，导致工作流侧 `fetch failed`。

## Evidence Log

- 2026-05-20: 静态检查确认前端模式一走 `structuredResume`，模式二走 `resumeFile` 多部分上传。
- 2026-05-20: 静态检查确认后端 `createTask` 对模式二会校验上传文件并在后台任务 `processClaimedTask` 中组装 `resume_file` 发给工作流。
- 2026-05-20: 运行时检查数据库最近失败任务，确认模式二任务可成功创建，但最终 `status=failed` 且 `error_message=fetch failed`。
- 2026-05-20: 运行时检查 API 容器环境，确认已配置 `INTERVIEW_TRANSCRIPT_WORKFLOW_TOKEN`、`INTERVIEW_TRANSCRIPT_WORKFLOW_RUN_URL`、OSS 相关变量与 `WEB_APP_BASE_URL=https://www.offer360.cn`。
- 2026-05-20: 通过 `curl -> /api/proxy/interview-transcripts/requests` 复现发现，`png` 上传返回 `201 Created`，而 `pdf` 上传会直接返回 `500 Internal server error`。
- 2026-05-20: API 容器日志确认根因是 `StorageService.uploadBuffer()` 调 OSS 时抛出 TLS 网络异常：`Client network socket disconnected before secure TLS connection was established`，异常发生在 `InterviewTranscriptService.createTask()` 内，导致接口直接 500。

## Fix

- 2026-05-20: 在 `apps/api/src/modules/interview-transcript/interview-transcript.service.ts` 为模式二附件临时上传增加降级逻辑：OSS 上传失败时自动回退到本地临时文件持久化，不再让提交接口直接失败。

## Verification

- 2026-05-20: 修复后使用同一路径、同样的 `pdf` 多部分上传再次复现，请求由 `500 Internal Server Error` 变为 `201 Created`，接口成功返回新的逐字稿记录并进入 `processing`。

## Next Step

- 继续由用户在页面实际上传原始本地简历文件验证；若确认恢复正常，再清理本次调试埋点与调试会话文件。
