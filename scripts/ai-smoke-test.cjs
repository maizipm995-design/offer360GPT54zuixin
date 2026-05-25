const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) return;
  const content = fs.readFileSync(abs, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function nowSuffix() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  let timeoutMs = null;
  for (const arg of args) {
    if (arg.startsWith('--timeoutMs=')) {
      const value = Number(arg.split('=')[1]);
      timeoutMs = Number.isFinite(value) ? value : null;
    }
  }
  return { all: args.has('--all'), timeoutMs };
}

async function runStep(name, fn, timeoutMs) {
  const startedAt = Date.now();
  process.stdout.write(`[ai-smoke-test] ${name}... `);

  let timer = null;
  try {
    const result = await Promise.race([
      Promise.resolve().then(fn),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    process.stdout.write(`OK (${Date.now() - startedAt}ms)\n`);
    return { ok: true, result };
  } catch (error) {
    process.stdout.write(`FAIL (${Date.now() - startedAt}ms)\n`);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function main() {
  loadEnvFile('.env');

  require('reflect-metadata');

  const { PrismaClient } = require('@prisma/client');
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../apps/api/dist/src/app.module');
  const { ResumeAiAdminService } = require('../apps/api/dist/src/modules/resume-ai/resume-ai-admin.service');
  const { ResumeAiService } = require('../apps/api/dist/src/modules/resume-ai/resume-ai.service');

  const args = parseArgs(process.argv);
  const stepTimeoutMs = args.timeoutMs ?? 75_000;

  const prisma = new PrismaClient();

  const config = await prisma.aiModelConfig.findFirst({
    where: { enabled: true, isDefault: true, provider: 'volcengine-ark' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, modelName: true, baseUrl: true, apiKeyMask: true, timeoutMs: true },
  });
  if (!config) {
    throw new Error('No enabled default aiModelConfig found');
  }

  if (typeof config.timeoutMs === 'number' && config.timeoutMs < 60000) {
    await prisma.aiModelConfig.update({
      where: { id: config.id },
      data: { timeoutMs: 60000 },
    });
    config.timeoutMs = 60000;
  }

  const phone = `196${nowSuffix().slice(-8)}`;
  const invite = `TMP${nowSuffix()}${Math.random().toString(16).slice(2, 8)}`.slice(0, 32);

  const user = await prisma.user.create({
    data: {
      phone,
      passwordHash: 'test-only',
      myInviteCode: invite,
      status: 'active',
    },
    select: { id: true },
  });

  const resumeDraft = await prisma.resumeDraft.create({
    data: {
      userId: user.id,
      title: 'AI 调试简历（临时）',
      templateCode: 'classic',
      status: 'draft',
      contentJson: {
        personal: {
          name: '张三',
          expectedRole: '产品经理',
          expectedCity: '上海',
          availability: '随时到岗',
          summary: '<p>校招产品方向，关注用户增长与数据分析。</p>',
        },
        selfEvaluation: '<p>具备结构化思维与数据敏感度，能独立推进需求分析、方案设计与跨团队协作落地。</p>',
        projects: [
          {
            id: 'proj-1',
            projectName: '校园活动小程序',
            roleName: '产品负责人',
            city: '上海',
            startDate: '2024-10',
            endDate: '2025-02',
            description: '<p>从0到1设计活动报名与签到流程，联合研发/设计落地；通过埋点与A/B测试优化关键转化。</p>',
          },
        ],
        education: [],
        internships: [],
        campusRoles: [],
        awards: [],
        languages: [],
        skills: [],
        links: [],
      },
      styleJson: {},
      layoutJson: {},
    },
    select: { id: true },
  });

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const admin = app.get(ResumeAiAdminService);
    const ai = app.get(ResumeAiService);

    const testStep = await runStep(
      'modelTest',
      () =>
        admin.testAiModelConfig(config.id, {
          prompt: '请严格返回 {"success":true,"message":"ok"}，不要输出其他任何文字。',
        }),
      stepTimeoutMs,
    );

    const results = {
      modelTest: testStep.ok
        ? {
            ok: true,
            success: testStep.result.success,
            modelName: testStep.result.modelName,
            latencyMs: testStep.result.latencyMs,
            previewText: testStep.result.previewText,
          }
        : { ok: false, error: testStep.error },
      calls: {},
    };

    const entryStep = await runStep(
      'optimizeEntry',
      () =>
        ai.optimizeEntry(user.id, resumeDraft.id, {
          sectionId: 'projects',
          entryId: 'proj-1',
          tone: 'professional',
          jobTarget: '产品经理',
        }),
      stepTimeoutMs,
    );

    if (entryStep.ok) {
      results.calls.entry = { ok: true, logId: entryStep.result.logId, updatedFieldKeys: entryStep.result.updatedFieldKeys };
    } else {
      const latest = await prisma.resumeAiOptimizationLog.findFirst({
        where: { userId: user.id, resumeId: resumeDraft.id },
        orderBy: { createdAt: 'desc' },
        select: { optimizeType: true, status: true, errorCode: true, errorMessage: true, responseText: true },
      });
      results.calls.entry = {
        ok: false,
        thrownMessage: entryStep.error,
        latestLog: latest
          ? {
              optimizeType: latest.optimizeType,
              status: latest.status,
              errorCode: latest.errorCode,
              errorMessage: latest.errorMessage,
              responseTextHead: latest.responseText ? latest.responseText.slice(0, 400) : null,
            }
          : null,
      };
    }

    if (args.all) {
      const sectionStep = await runStep(
        'optimizeSection',
        () =>
          ai.optimizeSection(user.id, resumeDraft.id, {
            sectionId: 'selfEvaluation',
            tone: 'professional',
            jobTarget: '产品经理',
          }),
        stepTimeoutMs,
      );

      if (sectionStep.ok) {
        results.calls.section = { ok: true, logId: sectionStep.result.logId, updatedFieldKeys: sectionStep.result.updatedFieldKeys };
      } else {
        const latest = await prisma.resumeAiOptimizationLog.findFirst({
          where: { userId: user.id, resumeId: resumeDraft.id },
          orderBy: { createdAt: 'desc' },
          select: { optimizeType: true, status: true, errorCode: true, errorMessage: true, responseText: true },
        });
        results.calls.section = {
          ok: false,
          thrownMessage: sectionStep.error,
          latestLog: latest
            ? {
                optimizeType: latest.optimizeType,
                status: latest.status,
                errorCode: latest.errorCode,
                errorMessage: latest.errorMessage,
                responseTextHead: latest.responseText ? latest.responseText.slice(0, 400) : null,
              }
            : null,
        };
      }

      const globalStep = await runStep(
        'optimizeResume',
        () =>
          ai.optimizeResume(user.id, resumeDraft.id, {
            tone: 'professional',
            jobTarget: '产品经理',
          }),
        stepTimeoutMs,
      );

      if (globalStep.ok) {
        results.calls.global = {
          ok: true,
          logId: globalStep.result.logId,
          updatedFieldCount: globalStep.result.summary.updatedFieldCount,
          updatedSections: globalStep.result.summary.updatedSections,
        };
      } else {
        const latest = await prisma.resumeAiOptimizationLog.findFirst({
          where: { userId: user.id, resumeId: resumeDraft.id },
          orderBy: { createdAt: 'desc' },
          select: { optimizeType: true, status: true, errorCode: true, errorMessage: true, responseText: true },
        });
        results.calls.global = {
          ok: false,
          thrownMessage: globalStep.error,
          latestLog: latest
            ? {
                optimizeType: latest.optimizeType,
                status: latest.status,
                errorCode: latest.errorCode,
                errorMessage: latest.errorMessage,
                responseTextHead: latest.responseText ? latest.responseText.slice(0, 400) : null,
              }
            : null,
        };
      }

      const translateStep = await runStep(
        'translateResume',
        () =>
          ai.translateResume(user.id, resumeDraft.id, {
            direction: 'zh-to-en',
            jobTarget: 'Product Manager',
          }),
        stepTimeoutMs,
      );

      if (translateStep.ok) {
        results.calls.translate = {
          ok: true,
          logId: translateStep.result.logId,
          updatedFieldCount: translateStep.result.summary.updatedFieldCount,
          updatedSections: translateStep.result.summary.updatedSections,
        };
      } else {
        const latest = await prisma.resumeAiOptimizationLog.findFirst({
          where: { userId: user.id, resumeId: resumeDraft.id },
          orderBy: { createdAt: 'desc' },
          select: { optimizeType: true, status: true, errorCode: true, errorMessage: true, responseText: true },
        });
        results.calls.translate = {
          ok: false,
          thrownMessage: translateStep.error,
          latestLog: latest
            ? {
                optimizeType: latest.optimizeType,
                status: latest.status,
                errorCode: latest.errorCode,
                errorMessage: latest.errorMessage,
                responseTextHead: latest.responseText ? latest.responseText.slice(0, 400) : null,
              }
            : null,
        };
      }
    }

    console.log(
      JSON.stringify(
        {
          config: {
            id: config.id,
            modelName: config.modelName,
            baseUrl: config.baseUrl,
            apiKeyMask: config.apiKeyMask,
            timeoutMs: config.timeoutMs,
          },
          args: { all: args.all, stepTimeoutMs },
          results,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close().catch(() => undefined);
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
