# [OPEN] deploy-link-bug

## Summary
- Symptom: local environment can open "查看公告" and "立即投递", but production Docker deployment cannot.
- Scope: risk control relaxation for levels 1-4, preserve click-triggered on-demand requests, investigate deployment mismatch.

## Hypotheses
1. Production container still serves stale frontend assets or config, so button handlers point to outdated URLs or disabled logic.
2. Production environment variables differ from local, causing request target/domain generation to fail only after deployment.
3. Reverse proxy or container routing blocks the on-demand request endpoint used by the two buttons.
4. Production build strips or rewrites runtime code paths differently from local dev, exposing an unhandled branch in click flow.
5. Risk control rules or API response guards still reject requests in production because server-side config was not updated with frontend changes.

## Evidence Log
- Production deployment scripts already force-refresh business services: `deploy/prod/scripts/deploy-release.sh` runs `cleanup-app-runtime.sh` and `compose up -d --no-deps --force-recreate --remove-orphans wechat-pay-gateway api web`.
- `cleanup-app-runtime.sh` explicitly stops and removes old `web/api/wechat-pay-gateway` containers, so "old container not replaced" is not the primary cause.
- Backend returned controlled redirect paths under `/api/jobs/:id/(announcement-redirect|delivery-redirect)`.
- Frontend `resolveJobRedirectPath()` resolves `/api/*` against `NEXT_PUBLIC_API_BASE_URL`. In production docs this value is `https://www.offer360.cn/api`, so browser navigation becomes `https://www.offer360.cn/api/jobs/...`.
- Web app only exposes `apps/web/app/api/proxy/[...path]/route.ts`; there is no `apps/web/app/api/jobs/...` route, so production navigation can miss the proxy path even though local dev works via direct API port logic.
- Existing runtime traces also showed `POST /api/proxy/jobs/.../deliver` being proxied, but no matching `GET /api/proxy/jobs/.../delivery-redirect` hit, which is consistent with the browser leaving the proxy path after the first step.
- Fix direction: return browser-facing controlled links as `/api/proxy/jobs/...`, and relax risk thresholds/durations without changing click-triggered on-demand access.
- New production symptom after deployment: browser opens `http://localhost:14000/api/proxy/jobs/.../(announcement-redirect|delivery-redirect)` and receives `404 Cannot GET ...`.
- Server `/opt/offer360/.env` and `offer360-prod-web-1` runtime env both correctly expose `NEXT_PUBLIC_API_BASE_URL=https://www.offer360.cn/api`, so production runtime config is not the source of `localhost:14000`.
- Production `web` bundle still contains `http://localhost:14000/api` in compiled client code, proving the wrong public API base URL was baked in at build time.
- Local workspace contains untracked `apps/web/.env.local` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:14000/api`; current `.dockerignore` excludes root `.env.local` but does not exclude nested app-level `.env.local`, so Docker build context can still include that developer-local file.

## Plan
1. Inspect only the directly related button flow, risk-control logic, and Docker/build/release files.
2. Add minimal instrumentation before changing business logic.
3. Return controlled redirect links through `/api/proxy/jobs/...` and keep on-demand access flow unchanged.
4. Relax L1-L4 abnormal risk thresholds and cooldown/freeze durations.
5. Exclude app-level developer `.env.local` files from Docker build context to prevent `localhost` values from being baked into production client bundles.
6. Rebuild in the prescribed Docker-based flow and verify the behavior.
