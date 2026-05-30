import { createHmac } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const defaultQuestionBankRoot = '/Users/maizim/Documents/校招笔试题库';
const defaultApiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:14000/api';
const specialIdHeader = '分类专项id （必填）（管理后台分类专项id，对应题库分类，请勿填错）';

function log(message = '') {
  console.log(message);
}

function normalizeCell(value) {
  return String(value ?? '').trim();
}

function normalizeHeaderSignature(value) {
  return normalizeCell(value)
    .toLowerCase()
    .replace(/[（）()【】\[\]{}「」『』“”"'`]/g, '')
    .replace(/[：:；;，,。.!?、·\-_]/g, '')
    .replace(/\s+/g, '');
}

function stripNumberPrefix(value) {
  return normalizeCell(value).replace(/^\d+[.、．]\s*/, '');
}

function stripTrailingSerial(value) {
  return normalizeCell(value).replace(/-(\d+)$/g, '');
}

function readSortOrderFromSegment(value, fallback = 0) {
  const matched = normalizeCell(value).match(/^(\d+)/);
  return matched ? Number(matched[1]) : fallback;
}

function slugifyCategory(name) {
  const normalized = normalizeCell(name)
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `category-${Date.now()}`;
}

function inferFileContext(rootDir, filePath) {
  const relativePath = path.relative(rootDir, filePath);
  const pathSegments = relativePath.split(path.sep).filter(Boolean);
  const fileName = path.basename(filePath);
  const fileBaseName = path.basename(filePath, path.extname(filePath));
  const categorySegment = pathSegments[0] ?? '';
  const specialSegment = pathSegments.length > 2 ? pathSegments[1] : fileBaseName;
  const categoryName = stripNumberPrefix(categorySegment);
  const specialName = stripTrailingSerial(stripNumberPrefix(specialSegment || fileBaseName));
  return {
    relativePath,
    fileName,
    fileBaseName,
    categorySegment,
    categoryName,
    categorySortOrder: readSortOrderFromSegment(categorySegment),
    specialSegment,
    specialName,
    specialSortOrder: readSortOrderFromSegment(specialSegment || fileBaseName),
  };
}

function parseArgs(argv) {
  const options = {
    rootDir: defaultQuestionBankRoot,
    apiBase: defaultApiBase.replace(/\/$/, ''),
    execute: false,
    overwritePolicy: 'skip_existing',
    onlySpecialId: null,
  };

  for (const arg of argv) {
    if (arg === '--execute') {
      options.execute = true;
      continue;
    }
    if (arg.startsWith('--root=')) {
      options.rootDir = path.resolve(arg.slice('--root='.length));
      continue;
    }
    if (arg.startsWith('--api-base=')) {
      options.apiBase = arg.slice('--api-base='.length).replace(/\/$/, '');
      continue;
    }
    if (arg.startsWith('--overwrite-policy=')) {
      const value = arg.slice('--overwrite-policy='.length);
      if (['skip_existing', 'replace_existing', 'fail_on_duplicate'].includes(value)) {
        options.overwritePolicy = value;
        continue;
      }
      throw new Error(`不支持的 overwritePolicy: ${value}`);
    }
    if (arg.startsWith('--only-special=')) {
      const value = Number(arg.slice('--only-special='.length));
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`only-special 参数不合法: ${arg}`);
      }
      options.onlySpecialId = value;
      continue;
    }
    throw new Error(`不支持的参数: ${arg}`);
  }

  return options;
}

async function loadEnvFile() {
  const envFilePath = path.resolve(projectRoot, '.env');
  const content = await readFile(envFilePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value.replace(/\\n/g, '\n');
  }
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

function createAdminJwtToken(secret, admin) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    sub: admin.id,
    username: admin.username,
    type: 'admin',
    iat: issuedAt,
    exp: issuedAt + 7 * 24 * 60 * 60,
  };
  const headerSegment = base64UrlEncode(JSON.stringify(header));
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerSegment}.${payloadSegment}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

async function collectExcelFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      result.push(...await collectExcelFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!/\.(xlsx|xls)$/i.test(entry.name)) {
      continue;
    }
    if (entry.name.startsWith('.~') || entry.name.startsWith('~$')) {
      continue;
    }
    result.push(fullPath);
  }
  return result.sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || text || `请求失败: ${response.status}`);
  }
  return payload?.data ?? payload;
}

async function fetchTemplateHeaders(apiBase, token) {
  const payload = await requestJson(`${apiBase}/admin/campus-exam/specials/import/template`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const buffer = payload.encoding === 'base64'
    ? Buffer.from(payload.content, 'base64')
    : Buffer.from(payload.content, 'utf8');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, blankrows: false });
  return (rows[0] ?? []).map((item) => normalizeCell(item));
}

function readWorkbookRows(filePath) {
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    blankrows: false,
  });
}

function buildHeaderMismatchReason(actualHeaders, templateHeaders) {
  const problems = [];
  const actualLength = actualHeaders.filter(Boolean).length;
  if (actualLength !== templateHeaders.length) {
    problems.push(`列数不匹配，模板要求 ${templateHeaders.length} 列，当前识别到 ${actualLength} 列`);
  }
  templateHeaders.forEach((header, index) => {
    const actual = actualHeaders[index] ?? '';
    if (actual !== header) {
      problems.push(`第 ${index + 1} 列应为“${header}”，当前为“${actual || '空列'}”`);
    }
  });
  actualHeaders.forEach((header, index) => {
    if (header && index >= templateHeaders.length) {
      problems.push(`第 ${index + 1} 列存在模板之外的表头“${header}”`);
    }
  });
  return problems.join('；');
}

function resolveHeaderMapping(actualHeaders, templateHeaders) {
  const exactIndexMap = new Map();
  const signatureIndexMap = new Map();

  actualHeaders.forEach((header, index) => {
    const normalizedHeader = normalizeCell(header);
    const exactList = exactIndexMap.get(normalizedHeader) ?? [];
    exactList.push(index);
    exactIndexMap.set(normalizedHeader, exactList);

    const signature = normalizeHeaderSignature(header);
    if (!signature) return;
    const signatureList = signatureIndexMap.get(signature) ?? [];
    signatureList.push(index);
    signatureIndexMap.set(signature, signatureList);
  });

  const usedIndexes = new Set();
  const sourceIndexes = [];
  const issues = [];

  templateHeaders.forEach((header, templateIndex) => {
    const exactCandidates = (exactIndexMap.get(header) ?? []).filter((index) => !usedIndexes.has(index));
    let matchedIndex = exactCandidates[0];
    if (matchedIndex === undefined) {
      const signatureCandidates = (signatureIndexMap.get(normalizeHeaderSignature(header)) ?? [])
        .filter((index) => !usedIndexes.has(index));
      matchedIndex = signatureCandidates[0];
    }
    if (matchedIndex === undefined) {
      issues.push(`缺少必要表头：${header}`);
      sourceIndexes.push(-1);
      return;
    }
    if (matchedIndex !== templateIndex) {
      issues.push(`第 ${templateIndex + 1} 列应为“${header}”，当前为“${normalizeCell(actualHeaders[matchedIndex]) || '空列'}”`);
    }
    usedIndexes.add(matchedIndex);
    sourceIndexes.push(matchedIndex);
  });

  const extraHeaders = actualHeaders
    .map((header, index) => ({ header: normalizeCell(header), index }))
    .filter((item) => item.header && !usedIndexes.has(item.index))
    .map((item) => `第 ${item.index + 1} 列存在模板之外的表头“${item.header}”`);

  return {
    sourceIndexes,
    issues: [...issues, ...extraHeaders],
  };
}

function buildPreparedRows(rows, sourceIndexes) {
  return rows
    .slice(1)
    .map((row) => sourceIndexes.map((sourceIndex) => row[sourceIndex] ?? ''))
    .filter((row) => row.some((item) => normalizeCell(item)));
}

function groupPreparedRowsBySpecialId(preparedRows, templateHeaders) {
  const specialIdColumnIndex = templateHeaders.indexOf(specialIdHeader);
  if (specialIdColumnIndex === -1) {
    throw new Error(`模板中缺少表头：${specialIdHeader}`);
  }
  const grouped = new Map();

  preparedRows.forEach((row, index) => {
    const specialIdValue = normalizeCell(row[specialIdColumnIndex]);
    if (!specialIdValue) {
      throw new Error(`第 ${index + 2} 行缺少分类专项id`);
    }
    const specialId = Number(specialIdValue);
    if (!Number.isInteger(specialId) || specialId <= 0) {
      throw new Error(`第 ${index + 2} 行分类专项id 不合法：${specialIdValue}`);
    }
    const list = grouped.get(specialId) ?? [];
    list.push(row);
    grouped.set(specialId, list);
  });

  return grouped;
}

function createWorkbookBuffer(templateHeaders, rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([templateHeaders, ...rows]);
  XLSX.utils.book_append_sheet(workbook, worksheet, '题库模板');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function createSegmentLabel(context, specialId, totalSegments) {
  if (totalSegments <= 1) {
    return context.fileName;
  }
  return `${context.fileBaseName}__special-${specialId}.xlsx`;
}

function buildFilePlan(rootDir, filePath, templateHeaders) {
  const rows = readWorkbookRows(filePath);
  if (rows.length <= 1) {
    return { filePath, reason: '文件缺少数据行' };
  }

  const context = inferFileContext(rootDir, filePath);
  const headerRow = (rows[0] ?? []).map((item) => normalizeCell(item));
  const headerMapping = resolveHeaderMapping(headerRow, templateHeaders);
  if (headerMapping.sourceIndexes.some((index) => index < 0)) {
    return { filePath, reason: buildHeaderMismatchReason(headerRow, templateHeaders) };
  }

  let preparedRows;
  try {
    preparedRows = buildPreparedRows(rows, headerMapping.sourceIndexes);
  } catch (error) {
    return {
      filePath,
      reason: error instanceof Error ? error.message : '数据预处理失败',
    };
  }

  if (preparedRows.length === 0) {
    return { filePath, reason: '文件只包含表头，没有可导入题目' };
  }

  let groupedRows;
  try {
    groupedRows = groupPreparedRowsBySpecialId(preparedRows, templateHeaders);
  } catch (error) {
    return {
      filePath,
      reason: error instanceof Error ? error.message : '专项分组失败',
    };
  }

  return {
    filePath,
    fileName: context.fileName,
    relativePath: context.relativePath,
    categoryName: context.categoryName,
    categorySortOrder: context.categorySortOrder,
    specialName: context.specialName,
    specialSortOrder: context.specialSortOrder,
    headerIssues: headerMapping.issues,
    segments: Array.from(groupedRows.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([specialId, groupedSegmentRows], _index, entries) => ({
        filePath,
        relativePath: context.relativePath,
        sourceFileName: context.fileName,
        fileName: createSegmentLabel(context, specialId, entries.length),
        specialId,
        rowCount: groupedSegmentRows.length,
        categoryName: context.categoryName,
        categorySortOrder: context.categorySortOrder,
        specialName: context.specialName,
        specialSortOrder: context.specialSortOrder,
        derivedFromMixedFile: entries.length > 1,
        preparedBuffer: createWorkbookBuffer(templateHeaders, groupedSegmentRows),
      })),
  };
}

function createUploadForm(filePath, buffer) {
  const form = new FormData();
  const mimeType = /\.xlsx$/i.test(filePath)
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/vnd.ms-excel';
  const blob = new Blob([buffer], { type: mimeType });
  form.append('file', blob, path.basename(filePath));
  return form;
}

async function resolveAdmin(prisma) {
  const superAdmin = await prisma.adminUser.findFirst({
    where: {
      status: 'active',
      userRoles: {
        some: {
          role: {
            code: 'super-admin',
            status: 'active',
          },
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  });
  return superAdmin ?? prisma.adminUser.findFirst({
    where: { status: 'active' },
    orderBy: [{ createdAt: 'asc' }],
  });
}

function chooseBestDefinitionCandidate(candidates) {
  return [...candidates].sort((left, right) => {
    if (left.derivedFromMixedFile !== right.derivedFromMixedFile) {
      return Number(left.derivedFromMixedFile) - Number(right.derivedFromMixedFile);
    }
    return left.relativePath.localeCompare(right.relativePath, 'zh-Hans-CN');
  })[0];
}

function collectTaxonomyDefinitions(plans) {
  const categoryMap = new Map();
  const specialCandidateMap = new Map();

  for (const plan of plans) {
    const categoryKey = plan.categoryName;
    const currentCategory = categoryMap.get(categoryKey);
    if (!currentCategory || plan.categorySortOrder < currentCategory.sortOrder) {
      categoryMap.set(categoryKey, {
        name: plan.categoryName,
        slug: slugifyCategory(plan.categoryName),
        sortOrder: plan.categorySortOrder,
      });
    }

    for (const segment of plan.segments) {
      const list = specialCandidateMap.get(segment.specialId) ?? [];
      list.push({
        specialId: segment.specialId,
        categoryName: segment.categoryName,
        specialName: segment.specialName,
        sortOrder: segment.specialSortOrder,
        relativePath: segment.relativePath,
        derivedFromMixedFile: segment.derivedFromMixedFile,
      });
      specialCandidateMap.set(segment.specialId, list);
    }
  }

  const definitions = [];
  const warnings = [];
  for (const [specialId, candidates] of specialCandidateMap.entries()) {
    const chosen = chooseBestDefinitionCandidate(candidates);
    const uniqueDescriptions = Array.from(new Set(candidates.map((item) => `${item.categoryName}/${item.specialName}`)));
    if (uniqueDescriptions.length > 1) {
      warnings.push(`专项 ${specialId} 检测到多个目录归属：${uniqueDescriptions.join('、')}，已采用 ${chosen.categoryName}/${chosen.specialName}`);
    }
    definitions.push({
      ...chosen,
      category: categoryMap.get(chosen.categoryName),
    });
  }

  return {
    categories: Array.from(categoryMap.values()).sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'zh-Hans-CN')),
    specials: definitions.sort((left, right) => left.specialId - right.specialId),
    warnings,
  };
}

async function syncCampusExamTaxonomy(prisma, definitions) {
  const categoryIdMap = new Map();
  const createdCategories = [];
  const createdSpecials = [];
  const updatedSpecials = [];

  for (const category of definitions.categories) {
    let existing = await prisma.campusExamCategory.findUnique({
      where: { slug: category.slug },
    });
    if (!existing) {
      existing = await prisma.campusExamCategory.create({
        data: {
          name: category.name,
          slug: category.slug,
          sortOrder: category.sortOrder,
          status: 'active',
        },
      });
      createdCategories.push(category.name);
    }
    categoryIdMap.set(category.name, existing.id);
  }

  for (const special of definitions.specials) {
    const categoryId = categoryIdMap.get(special.categoryName);
    if (!categoryId) {
      throw new Error(`分类 ${special.categoryName} 未成功创建，无法同步专项 ${special.specialId}`);
    }
    const existing = await prisma.campusExamSpecial.findUnique({
      where: { id: special.specialId },
    });
    if (!existing) {
      await prisma.campusExamSpecial.create({
        data: {
          id: special.specialId,
          categoryId,
          name: special.specialName,
          sortOrder: special.sortOrder,
          status: 'active',
        },
      });
      createdSpecials.push(`${special.specialId}:${special.specialName}`);
      continue;
    }
    if (
      existing.categoryId !== categoryId
      || existing.name !== special.specialName
      || existing.sortOrder !== special.sortOrder
    ) {
      await prisma.campusExamSpecial.update({
        where: { id: special.specialId },
        data: {
          categoryId,
          name: special.specialName,
          sortOrder: special.sortOrder,
          status: 'active',
        },
      });
      updatedSpecials.push(`${special.specialId}:${special.specialName}`);
    }
  }

  return {
    createdCategories,
    createdSpecials,
    updatedSpecials,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await loadEnvFile();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL 未配置，无法读取管理员和专项数据');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET 未配置，无法生成管理员 token');
  }

  const prisma = new PrismaClient();

  try {
    const admin = await resolveAdmin(prisma);
    if (!admin) {
      throw new Error('未找到可用的 active 管理员账号');
    }
    const adminToken = createAdminJwtToken(process.env.JWT_SECRET, admin);
    const templateHeaders = await fetchTemplateHeaders(options.apiBase, adminToken);
    const allFiles = await collectExcelFiles(options.rootDir);
    const plans = [];
    const issues = [];

    for (const filePath of allFiles) {
      const result = buildFilePlan(options.rootDir, filePath, templateHeaders);
      if (result.reason) {
        issues.push(result);
        continue;
      }
      plans.push(result);
    }

    const segments = plans
      .flatMap((item) => item.segments)
      .filter((item) => options.onlySpecialId === null || item.specialId === options.onlySpecialId);
    const taxonomyDefinitions = collectTaxonomyDefinitions(plans);
    const specialIds = Array.from(new Set(segments.map((item) => item.specialId))).sort((a, b) => a - b);

    let existingSpecials = [];
    if (specialIds.length) {
      existingSpecials = await prisma.campusExamSpecial.findMany({
        where: { id: { in: specialIds } },
        include: { category: true },
      });
    }
    let specialMap = new Map(existingSpecials.map((item) => [item.id, item]));

    const headerWarnings = plans.flatMap((item) =>
      item.headerIssues.map((warning) => `${item.relativePath}: ${warning}`));

    log('校招题库批量导入扫描结果');
    log(`- 根目录: ${options.rootDir}`);
    log(`- API: ${options.apiBase}`);
    log(`- Excel 文件数: ${allFiles.length}`);
    log(`- 可导入文件数: ${plans.length}`);
    log(`- 可导入分片数: ${segments.length}`);
    log(`- 涉及专项数: ${specialIds.length}`);
    log(`- 执行模式: ${options.execute ? '正式导入' : '仅扫描'}`);
    log(`- 覆盖策略: ${options.overwritePolicy}`);
    log(`- 管理员: ${admin.username}`);
    log(`- 待自动创建分类数: ${taxonomyDefinitions.categories.length}`);
    log(`- 待自动同步专项数: ${taxonomyDefinitions.specials.length}`);

    if (segments.length) {
      log('');
      log('按专项分发计划');
      const grouped = new Map();
      for (const segment of segments) {
        const list = grouped.get(segment.specialId) ?? [];
        list.push(segment);
        grouped.set(segment.specialId, list);
      }
      Array.from(grouped.entries())
        .sort((left, right) => left[0] - right[0])
        .forEach(([specialId, items]) => {
          const special = specialMap.get(specialId);
          const definition = taxonomyDefinitions.specials.find((item) => item.specialId === specialId);
          const displayName = special
            ? `${special.category.name} / ${special.name}`
            : definition
              ? `${definition.categoryName} / ${definition.specialName}`
              : '待自动创建';
          log(`- 专项 ${specialId} (${displayName})`);
          items.forEach((item) => {
            log(`  - ${item.relativePath}${item.derivedFromMixedFile ? ` -> ${item.fileName}` : ''} | ${item.rowCount} 题`);
          });
        });
    }

    if (taxonomyDefinitions.warnings.length || headerWarnings.length) {
      log('');
      log('预处理提示');
      [...taxonomyDefinitions.warnings, ...headerWarnings].forEach((warning) => {
        log(`- ${warning}`);
      });
    }

    if (issues.length) {
      log('');
      log('扫描问题');
      issues.forEach((issue) => {
        log(`- ${issue.filePath}: ${issue.reason}`);
      });
      throw new Error(`扫描未通过，共 ${issues.length} 个问题`);
    }

    if (!options.execute) {
      log('');
      log('扫描通过。若要正式导入，请执行：');
      log('npm run campus-exam:bulk-import -- --execute');
      return;
    }

    const taxonomySyncResult = await syncCampusExamTaxonomy(prisma, taxonomyDefinitions);
    const syncedSpecials = specialIds.length
      ? await prisma.campusExamSpecial.findMany({
          where: { id: { in: specialIds } },
          include: { category: true },
        })
      : [];
    specialMap = new Map(syncedSpecials.map((item) => [item.id, item]));

    log('');
    log('主数据同步结果');
    log(`- 新建分类: ${taxonomySyncResult.createdCategories.length}`);
    log(`- 新建专项: ${taxonomySyncResult.createdSpecials.length}`);
    log(`- 更新专项: ${taxonomySyncResult.updatedSpecials.length}`);

    let previewPassed = 0;
    let importedFiles = 0;
    let importedQuestions = 0;
    const importFailures = [];

    for (const plan of segments.sort((left, right) => left.specialId - right.specialId || left.filePath.localeCompare(right.filePath, 'zh-Hans-CN'))) {
      log('');
      log(`开始处理: ${plan.relativePath}${plan.derivedFromMixedFile ? ` -> ${plan.fileName}` : ''}`);
      try {
        const preview = await requestJson(`${options.apiBase}/admin/campus-exam/specials/${plan.specialId}/import/preview`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          body: createUploadForm(plan.fileName, plan.preparedBuffer),
        });
        log(`- 预览结果: 成功 ${preview.successCount} / 失败 ${preview.failCount} / 批次 ${preview.batchId}`);
        if (preview.failCount > 0 || preview.summary?.headerErrors > 0) {
          importFailures.push({
            filePath: plan.relativePath,
            reason: `预览未通过，错误 ${preview.failCount} 条`,
          });
          continue;
        }
        previewPassed += 1;

        const confirm = await requestJson(`${options.apiBase}/admin/campus-exam/specials/${plan.specialId}/import/confirm`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            batchId: preview.batchId,
            overwritePolicy: options.overwritePolicy,
          }),
        });
        importedFiles += 1;
        importedQuestions += confirm.importedCount;
        log(`- 正式导入: 成功 ${confirm.importedCount} / 跳过 ${confirm.skippedCount} / 失败 ${confirm.failedCount} / 状态 ${confirm.status}`);
      } catch (error) {
        importFailures.push({
          filePath: plan.relativePath,
          reason: error instanceof Error ? error.message : '导入异常',
        });
      }
    }

    log('');
    log('批量导入完成');
    log(`- 预览通过文件数: ${previewPassed}`);
    log(`- 正式导入文件数: ${importedFiles}`);
    log(`- 实际导入题目数: ${importedQuestions}`);
    log(`- 失败文件数: ${importFailures.length}`);

    if (importFailures.length) {
      log('');
      log('失败明细');
      importFailures.forEach((item) => {
        log(`- ${item.filePath}: ${item.reason}`);
      });
      throw new Error(`批量导入存在失败文件，共 ${importFailures.length} 个`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
