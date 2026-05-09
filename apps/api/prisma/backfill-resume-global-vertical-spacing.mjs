import { PrismaClient } from '@prisma/client';
import {
  normalizeResumeStyleJson,
  splitResumeTemplateConfigs,
} from '../dist/src/modules/resume/resume-template-config.js';

const prisma = new PrismaClient();

function parseDraftIdsFromArgs() {
  return Array.from(
    new Set(
      process.argv
        .filter((item) => item.startsWith('--draftId='))
        .flatMap((item) => item.slice('--draftId='.length).split(','))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasVerticalSpacing(value) {
  return isRecord(value) && Object.keys(value).length > 0;
}

function hasLegacyLineHeightOnly(styleJson) {
  const source = isRecord(styleJson) ? styleJson : {};
  return !hasVerticalSpacing(source.verticalSpacing)
    && Number.isFinite(Number(source.lineHeight ?? source.sectionSpacing ?? source.itemSpacing));
}

function buildNextStyleJson(styleJson, globalVerticalSpacing) {
  return normalizeResumeStyleJson(styleJson, {
    globalVerticalSpacing,
    ignoreLegacyLineHeight: true,
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const draftIds = parseDraftIdsFromArgs();
  const where = draftIds.length ? { id: { in: draftIds } } : undefined;

  const [templateConfigs, drafts] = await Promise.all([
    prisma.resumeTemplateConfig.findMany({
      orderBy: { templateCode: 'asc' },
      select: {
        id: true,
        templateCode: true,
        templateName: true,
        description: true,
        styleJson: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.resumeDraft.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        title: true,
        styleJson: true,
        updatedAt: true,
      },
    }),
  ]);

  const { globalVerticalSpacing } = splitResumeTemplateConfigs(templateConfigs);
  const changes = [];

  for (const draft of drafts) {
    if (!hasLegacyLineHeightOnly(draft.styleJson)) {
      continue;
    }

    const nextStyleJson = buildNextStyleJson(draft.styleJson, globalVerticalSpacing);
    changes.push({
      id: draft.id,
      userId: draft.userId,
      title: draft.title,
      updatedAt: draft.updatedAt.toISOString(),
      before: draft.styleJson,
      after: nextStyleJson,
    });

    if (apply) {
      await prisma.resumeDraft.update({
        where: { id: draft.id },
        data: {
          styleJson: nextStyleJson,
        },
      });
    }
  }

  console.log(`[resume-global-spacing-backfill] mode=${apply ? 'apply' : 'dry-run'}`);
  if (draftIds.length) {
    console.log(`[resume-global-spacing-backfill] scoped_draft_ids=${draftIds.join(',')}`);
  }
  console.log(`[resume-global-spacing-backfill] matched_drafts=${changes.length}`);

  if (changes.length) {
    console.log('[resume-global-spacing-backfill] sample_changes=', JSON.stringify(changes.slice(0, 5), null, 2));
  }

  if (apply && changes.length) {
    console.log('[resume-global-spacing-backfill] 已写回数据库。建议执行后重启 API / Web 运行环境，确保最新归一化结果被读取。');
  }
}

main()
  .catch((error) => {
    console.error('[resume-global-spacing-backfill] 执行失败');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
