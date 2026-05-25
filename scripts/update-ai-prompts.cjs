const fs = require('fs');
const path = require('path');

const PROMPT_DOC_PATH = 'docs/AI简历优化-提示词最终版本与默认配置落库SQL-20260514.md';

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

async function main() {
  loadEnvFile('.env');

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const promptDoc = fs.readFileSync(path.resolve(process.cwd(), PROMPT_DOC_PATH), 'utf8');

  function extractPromptBlock(sectionTitle) {
    const heading = `## ${sectionTitle}`;
    const startIndex = promptDoc.lastIndexOf(heading);
    if (startIndex < 0) {
      throw new Error(`Prompt section not found in ${PROMPT_DOC_PATH}: ${sectionTitle}`);
    }
    const fenceStart = promptDoc.indexOf('```text', startIndex);
    const contentStart = fenceStart >= 0 ? fenceStart + '```text'.length : -1;
    const fenceEnd = contentStart >= 0 ? promptDoc.indexOf('\n```', contentStart) : -1;
    if (fenceStart < 0 || fenceEnd < 0) {
      throw new Error(`Prompt block fence not found in ${PROMPT_DOC_PATH}: ${sectionTitle}`);
    }
    return promptDoc.slice(contentStart, fenceEnd).trim();
  }

  const config = await prisma.aiModelConfig.findFirst({
    where: { enabled: true, isDefault: true, provider: 'volcengine-ark' },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      systemPrompt: true,
      globalPromptTemplate: true,
      entryPromptTemplate: true,
      professionalPromptTemplate: true,
      assessmentPromptTemplate: true,
      remark: true,
      timeoutMs: true,
      maxOutputTokens: true,
      temperature: true,
      topP: true,
    },
  });

  if (!config) {
    throw new Error('No enabled default aiModelConfig found');
  }

  const systemPrompt = extractPromptBlock('systemPrompt');
  const globalPromptTemplate = extractPromptBlock('globalPromptTemplate');
  const entryPromptTemplate = extractPromptBlock('entryPromptTemplate');
  const professionalPromptTemplate = extractPromptBlock('professionalPromptTemplate');
  const assessmentPromptTemplate = extractPromptBlock('assessmentPromptTemplate');

  const remark = [
    '默认生产配置：用于全局一键优化、单条经历优化、单模块精细化优化、专业术语优化与 AI 评估建议生成。',
    'systemPrompt 负责统一身份、事实边界与输出格式；globalPromptTemplate 服务全局优化与翻译；entryPromptTemplate 服务单条经历与单模块优化；professionalPromptTemplate 服务专业术语优化；assessmentPromptTemplate 服务评估建议生成。',
  ].join(' ');

  await prisma.aiModelConfig.update({
    where: { id: config.id },
    data: {
      systemPrompt,
      globalPromptTemplate,
      entryPromptTemplate,
      professionalPromptTemplate,
      assessmentPromptTemplate,
      remark,
    },
  });

  const after = await prisma.aiModelConfig.findUnique({
    where: { id: config.id },
    select: {
      id: true,
      systemPrompt: true,
      globalPromptTemplate: true,
      entryPromptTemplate: true,
      professionalPromptTemplate: true,
      assessmentPromptTemplate: true,
      remark: true,
      timeoutMs: true,
      maxOutputTokens: true,
      temperature: true,
      topP: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        updated: true,
        id: after.id,
        timeoutMs: after.timeoutMs,
        maxOutputTokens: after.maxOutputTokens,
        temperature: after.temperature,
        topP: after.topP,
        systemPromptLength: after.systemPrompt?.length ?? 0,
        globalPromptTemplateLength: after.globalPromptTemplate?.length ?? 0,
        entryPromptTemplateLength: after.entryPromptTemplate?.length ?? 0,
        professionalPromptTemplateLength: after.professionalPromptTemplate?.length ?? 0,
        assessmentPromptTemplateLength: after.assessmentPromptTemplate?.length ?? 0,
        remarkLength: after.remark?.length ?? 0,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
