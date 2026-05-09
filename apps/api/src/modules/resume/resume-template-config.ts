import type { InputJsonValue } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma.service';

export type ResumeTemplateCode = 'style-a' | 'style-b' | 'style-c';
export const GLOBAL_VERTICAL_SPACING_TEMPLATE_CODE = 'global-vertical-spacing';
export const GLOBAL_VERTICAL_SPACING_TEMPLATE_NAME = '全局垂直排版参数';
export const GLOBAL_VERTICAL_SPACING_TEMPLATE_DESCRIPTION = '全站简历模板共享的默认垂直排版基准';

export interface ResumeVerticalSpacingConfig {
  sectionTitleToDividerPt: number;
  dividerToEntryHeaderPt: number;
  entryHeaderToBodyPt: number;
  listItemGapPt: number;
  bodyTextLineHeightPt: number;
  paragraphGapPt: number;
  sectionCardGapPt: number;
  pagePaddingTopPt: number;
  pagePaddingBottomPt: number;
  headerPaddingTopPt: number;
  headerPaddingBottomPt: number;
}

export interface ResumeStyleJson {
  templateCode: string;
  fontFamily: string;
  fontSize: number;
  spacingScale: number;
  verticalSpacing: ResumeVerticalSpacingConfig;
  lineHeight: number;
  pageMargin: number;
  themeColor: string;
  headerVariant: string;
  basicInfoVariant: string;
  sectionTitleVariant: string;
  skillVariant: string;
  experienceHeaderVariant: string;
  paperBackgroundVariant: string;
  paperBackgroundPosition: string;
  dateFormat: string;
  titleStyle: string;
  titleSeparator: string;
  doubleLinePriority: string;
  headerAlign: string;
  sectionSpacing: number;
  itemSpacing: number;
}

export interface ResumeTemplateConfigSeed {
  templateCode: ResumeTemplateCode;
  templateName: string;
  description: string;
  styleJson: ResumeStyleJson;
}

export interface NormalizeResumeStyleJsonOptions {
  globalVerticalSpacing?: ResumeVerticalSpacingConfig;
  ignoreSourceVerticalSpacing?: boolean;
  ignoreLegacyLineHeight?: boolean;
}

export interface ResumeTemplateConfigRecordLike {
  id: string;
  templateCode: string;
  templateName: string;
  description: string | null;
  styleJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResumeTemplateConfigsBundle<T extends { templateCode: string; styleJson: unknown } = ResumeTemplateConfigRecordLike> {
  templates: T[];
  globalVerticalSpacing: ResumeVerticalSpacingConfig;
  globalConfig: T | null;
}

export const DEFAULT_VERTICAL_SPACING: ResumeVerticalSpacingConfig = {
  sectionTitleToDividerPt: 3,
  dividerToEntryHeaderPt: 3,
  entryHeaderToBodyPt: 3,
  listItemGapPt: 2,
  bodyTextLineHeightPt: 20,
  paragraphGapPt: 2,
  sectionCardGapPt: 3,
  pagePaddingTopPt: 50,
  pagePaddingBottomPt: 50,
  headerPaddingTopPt: 40,
  headerPaddingBottomPt: 40,
};

export const DEFAULT_RESUME_STYLE_JSON: ResumeStyleJson = {
  templateCode: 'style-a',
  fontFamily: 'yahei',
  fontSize: 12,
  spacingScale: 1,
  verticalSpacing: DEFAULT_VERTICAL_SPACING,
  lineHeight: 20,
  pageMargin: 9,
  themeColor: '#4183FF',
  headerVariant: 'basic',
  basicInfoVariant: 'text-line',
  sectionTitleVariant: 'classic',
  skillVariant: 'list',
  experienceHeaderVariant: 'single-line',
  paperBackgroundVariant: 'wave-lines',
  paperBackgroundPosition: 'right',
  dateFormat: 'cn',
  titleStyle: 'single',
  titleSeparator: ' ｜ ',
  doubleLinePriority: 'time-first',
  headerAlign: 'center',
  sectionSpacing: 20,
  itemSpacing: 20,
};

export const DEFAULT_RESUME_TEMPLATE_CONFIGS: ResumeTemplateConfigSeed[] = [
  {
    templateCode: 'style-a',
    templateName: 'A 样式',
    description: '居中头像、线型标题、清爽单栏',
    styleJson: {
      ...DEFAULT_RESUME_STYLE_JSON,
      templateCode: 'style-a',
      fontSize: 12,
      spacingScale: 1,
      verticalSpacing: DEFAULT_VERTICAL_SPACING,
      lineHeight: 20,
      pageMargin: 9,
      headerVariant: 'basic',
      basicInfoVariant: 'text-line',
      sectionTitleVariant: 'classic',
      skillVariant: 'list',
      experienceHeaderVariant: 'single-line',
    },
  },
  {
    templateCode: 'style-b',
    templateName: 'B 样式',
    description: '横幅头图、图标信息、标签标题',
    styleJson: {
      ...DEFAULT_RESUME_STYLE_JSON,
      templateCode: 'style-b',
      fontSize: 12,
      spacingScale: 1,
      verticalSpacing: DEFAULT_VERTICAL_SPACING,
      lineHeight: 20,
      pageMargin: 8,
      headerVariant: 'highlight',
      basicInfoVariant: 'icon-line',
      sectionTitleVariant: 'pill-line',
      skillVariant: 'icon-grid',
      experienceHeaderVariant: 'double-line',
    },
  },
  {
    templateCode: 'style-c',
    templateName: 'C 样式',
    description: '商务右头像、色条标题、标签技能',
    styleJson: {
      ...DEFAULT_RESUME_STYLE_JSON,
      templateCode: 'style-c',
      fontSize: 12,
      spacingScale: 1,
      verticalSpacing: DEFAULT_VERTICAL_SPACING,
      lineHeight: 20,
      pageMargin: 10,
      headerVariant: 'business',
      basicInfoVariant: 'text-dot',
      sectionTitleVariant: 'left-bar',
      skillVariant: 'tag-list',
      experienceHeaderVariant: 'single-line',
    },
  },
];

export function getDefaultResumeTemplateConfig(templateCode?: string) {
  return DEFAULT_RESUME_TEMPLATE_CONFIGS.find((item) => item.templateCode === templateCode) ?? DEFAULT_RESUME_TEMPLATE_CONFIGS[0];
}

export function normalizeResumeVerticalSpacing(
  input?: unknown,
  fallback: ResumeVerticalSpacingConfig = DEFAULT_VERTICAL_SPACING,
): ResumeVerticalSpacingConfig {
  const source = asRecord(input);
  return {
    sectionTitleToDividerPt: readNumberValue(source.sectionTitleToDividerPt, fallback.sectionTitleToDividerPt),
    dividerToEntryHeaderPt: readNumberValue(source.dividerToEntryHeaderPt, fallback.dividerToEntryHeaderPt),
    entryHeaderToBodyPt: readNumberValue(source.entryHeaderToBodyPt, fallback.entryHeaderToBodyPt),
    listItemGapPt: readNumberValue(source.listItemGapPt, fallback.listItemGapPt),
    bodyTextLineHeightPt: readNumberValue(source.bodyTextLineHeightPt, fallback.bodyTextLineHeightPt),
    paragraphGapPt: readNumberValue(source.paragraphGapPt, fallback.paragraphGapPt),
    sectionCardGapPt: readNumberValue(source.sectionCardGapPt, fallback.sectionCardGapPt),
    pagePaddingTopPt: readNumberValue(source.pagePaddingTopPt, fallback.pagePaddingTopPt),
    pagePaddingBottomPt: readNumberValue(source.pagePaddingBottomPt, fallback.pagePaddingBottomPt),
    headerPaddingTopPt: readNumberValue(source.headerPaddingTopPt, fallback.headerPaddingTopPt),
    headerPaddingBottomPt: readNumberValue(source.headerPaddingBottomPt, fallback.headerPaddingBottomPt),
  };
}

export function normalizeResumeStyleJson(input?: unknown, options?: NormalizeResumeStyleJsonOptions): ResumeStyleJson {
  const source = asRecord(input);
  const templateDefault = getDefaultResumeTemplateConfig(readStringValue(source.templateCode, DEFAULT_RESUME_STYLE_JSON.templateCode));
  const baseStyle = templateDefault.styleJson;
  const globalVerticalSpacing = normalizeResumeVerticalSpacing(options?.globalVerticalSpacing, DEFAULT_VERTICAL_SPACING);
  const legacyLineHeightSource = options?.ignoreSourceVerticalSpacing || options?.ignoreLegacyLineHeight
    ? undefined
    : source.lineHeight ?? source.sectionSpacing ?? source.itemSpacing;
  const legacyLineHeight = legacyLineHeightSource === undefined
    ? undefined
    : readNumberValue(legacyLineHeightSource, globalVerticalSpacing.bodyTextLineHeightPt);
  const spacingScale = clampNumber(readNumberValue(source.spacingScale, baseStyle.spacingScale), 0.8, 1.2);
  const verticalSpacingSource = options?.ignoreSourceVerticalSpacing ? {} : asRecord(source.verticalSpacing);
  const bodyTextLineHeightPt = readNumberValue(
    verticalSpacingSource.bodyTextLineHeightPt ?? legacyLineHeight,
    globalVerticalSpacing.bodyTextLineHeightPt,
  );
  const verticalSpacing: ResumeVerticalSpacingConfig = {
    sectionTitleToDividerPt: readNumberValue(verticalSpacingSource.sectionTitleToDividerPt, globalVerticalSpacing.sectionTitleToDividerPt),
    dividerToEntryHeaderPt: readNumberValue(verticalSpacingSource.dividerToEntryHeaderPt, globalVerticalSpacing.dividerToEntryHeaderPt),
    entryHeaderToBodyPt: readNumberValue(verticalSpacingSource.entryHeaderToBodyPt, globalVerticalSpacing.entryHeaderToBodyPt),
    listItemGapPt: readNumberValue(verticalSpacingSource.listItemGapPt, globalVerticalSpacing.listItemGapPt),
    bodyTextLineHeightPt,
    paragraphGapPt: readNumberValue(verticalSpacingSource.paragraphGapPt, globalVerticalSpacing.paragraphGapPt),
    sectionCardGapPt: readNumberValue(verticalSpacingSource.sectionCardGapPt, globalVerticalSpacing.sectionCardGapPt),
    pagePaddingTopPt: readNumberValue(verticalSpacingSource.pagePaddingTopPt, globalVerticalSpacing.pagePaddingTopPt),
    pagePaddingBottomPt: readNumberValue(verticalSpacingSource.pagePaddingBottomPt, globalVerticalSpacing.pagePaddingBottomPt),
    headerPaddingTopPt: readNumberValue(verticalSpacingSource.headerPaddingTopPt, globalVerticalSpacing.headerPaddingTopPt),
    headerPaddingBottomPt: readNumberValue(verticalSpacingSource.headerPaddingBottomPt, globalVerticalSpacing.headerPaddingBottomPt),
  };
  const computedLineHeight = clampNumber(bodyTextLineHeightPt * spacingScale, 12, 28);

  return {
    ...baseStyle,
    ...source,
    templateCode: templateDefault.templateCode,
    fontFamily: readStringValue(source.fontFamily, baseStyle.fontFamily),
    fontSize: clampNumber(readNumberValue(source.fontSize, baseStyle.fontSize), 10, 18),
    spacingScale,
    verticalSpacing,
    lineHeight: computedLineHeight,
    pageMargin: clampNumber(readNumberValue(source.pageMargin, baseStyle.pageMargin), 5, 25),
    themeColor: readStringValue(source.themeColor, baseStyle.themeColor),
    headerVariant: readStringValue(source.headerVariant, baseStyle.headerVariant),
    basicInfoVariant: readStringValue(source.basicInfoVariant, baseStyle.basicInfoVariant),
    sectionTitleVariant: readStringValue(source.sectionTitleVariant, baseStyle.sectionTitleVariant),
    skillVariant: readStringValue(source.skillVariant, baseStyle.skillVariant),
    experienceHeaderVariant: readStringValue(source.experienceHeaderVariant, baseStyle.experienceHeaderVariant),
    paperBackgroundVariant: readStringValue(source.paperBackgroundVariant, baseStyle.paperBackgroundVariant),
    paperBackgroundPosition: readStringValue(source.paperBackgroundPosition, baseStyle.paperBackgroundPosition),
    dateFormat: readStringValue(source.dateFormat, baseStyle.dateFormat),
    titleStyle: readStringValue(source.titleStyle, baseStyle.titleStyle),
    titleSeparator: readStringValue(source.titleSeparator, baseStyle.titleSeparator),
    doubleLinePriority: readStringValue(source.doubleLinePriority, baseStyle.doubleLinePriority),
    headerAlign: readStringValue(source.headerAlign, baseStyle.headerAlign),
    sectionSpacing: computedLineHeight,
    itemSpacing: computedLineHeight,
  };
}

export async function ensureResumeTemplateConfigs(prisma: PrismaService) {
  const existing = await prisma.resumeTemplateConfig.findMany({
    select: { templateCode: true },
  });
  const existingCodes = new Set(existing.map((item) => item.templateCode));

  for (const template of DEFAULT_RESUME_TEMPLATE_CONFIGS) {
    if (existingCodes.has(template.templateCode)) {
      continue;
    }
    await prisma.resumeTemplateConfig.create({
      data: {
        templateCode: template.templateCode,
        templateName: template.templateName,
        description: template.description,
        styleJson: toStoredResumeTemplateStyleJsonValue(template.styleJson),
      },
    });
  }

  if (!existingCodes.has(GLOBAL_VERTICAL_SPACING_TEMPLATE_CODE)) {
    await prisma.resumeTemplateConfig.create({
      data: {
        templateCode: GLOBAL_VERTICAL_SPACING_TEMPLATE_CODE,
        templateName: GLOBAL_VERTICAL_SPACING_TEMPLATE_NAME,
        description: GLOBAL_VERTICAL_SPACING_TEMPLATE_DESCRIPTION,
        styleJson: toGlobalVerticalSpacingStyleJsonValue(DEFAULT_VERTICAL_SPACING),
      },
    });
  }

  return prisma.resumeTemplateConfig.findMany({
    orderBy: { templateCode: 'asc' },
  });
}

export function toResumeStyleJsonValue(styleJson: ResumeStyleJson): InputJsonValue {
  return styleJson as unknown as InputJsonValue;
}

export function toStoredResumeTemplateStyleJsonValue(styleJson: ResumeStyleJson): InputJsonValue {
  const { verticalSpacing, lineHeight, sectionSpacing, itemSpacing, ...storedStyle } = styleJson;
  return storedStyle as unknown as InputJsonValue;
}

export function toGlobalVerticalSpacingStyleJsonValue(verticalSpacing: ResumeVerticalSpacingConfig): InputJsonValue {
  return {
    verticalSpacing: normalizeResumeVerticalSpacing(verticalSpacing),
  } as unknown as InputJsonValue;
}

export function splitResumeTemplateConfigs<T extends { templateCode: string; styleJson: unknown }>(
  list: T[],
): ResumeTemplateConfigsBundle<T> {
  const globalConfig = list.find((item) => item.templateCode === GLOBAL_VERTICAL_SPACING_TEMPLATE_CODE) ?? null;
  const globalVerticalSpacing = normalizeResumeVerticalSpacing(asRecord(globalConfig?.styleJson).verticalSpacing, DEFAULT_VERTICAL_SPACING);

  return {
    templates: list.filter((item) => item.templateCode !== GLOBAL_VERTICAL_SPACING_TEMPLATE_CODE),
    globalVerticalSpacing,
    globalConfig,
  };
}

export async function getResumeTemplateConfigsBundle(prisma: PrismaService) {
  const list = await ensureResumeTemplateConfigs(prisma);
  return splitResumeTemplateConfigs(list as ResumeTemplateConfigRecordLike[]);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readStringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function readNumberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
