import { hasMeaningfulRichText } from './resume-rich-text';

export type ResumeFontFamily = 'yahei' | 'heiti' | 'songti' | 'kaiti' | 'fangsong';
export type ResumeDateFormat = 'cn' | 'dot';
export type ResumeTitleStyle = 'single' | 'double';
export type ResumeDoubleLinePriority = 'time-first';
export type ResumeHeaderAlign = 'left' | 'center' | 'right';
export type ResumeTemplateCode = 'style-a' | 'style-b' | 'style-c';
export type ResumeHeaderVariant = 'business' | 'highlight' | 'clear' | 'basic' | 'formal' | 'work';
export type ResumeBasicInfoVariant = 'text-line' | 'icon-line' | 'text-dot' | 'icon-dot';
export type ResumeSectionTitleVariant = 'classic' | 'left-bar' | 'pill-line' | 'bg-block';
export type ResumeSkillVariant = 'list' | 'icon-grid' | 'tag-list';
export type ResumeExperienceHeaderVariant = 'single-line' | 'double-line';
export type ResumePaperBackgroundVariant =
  | 'none'
  | 'diamond-grid'
  | 'arc-lines'
  | 'wave-lines'
  | 'vertical-wave'
  | 'petal'
  | 'chevron'
  | 'geo-frame'
  | 'angle-grid';
export type ResumeSectionId =
  | 'personal'
  | 'education'
  | 'internships'
  | 'projects'
  | 'skills'
  | 'awards'
  | 'languages'
  | 'campusRoles'
  | 'selfEvaluation'
  | 'links';

export interface ResumePersonalInfo {
  name: string;
  phone: string;
  email: string;
  expectedRole: string;
  expectedCity: string;
  availability: string;
  website: string;
  avatarUrl: string;
  avatarPreviewUrl?: string;
  summary: string;
}

export interface ResumeEducationEntry {
  id: string;
  schoolName: string;
  degree: string;
  major: string;
  logoUrl: string;
  logoPreviewUrl?: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ResumeExperienceEntry {
  id: string;
  companyName: string;
  roleName: string;
  city: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ResumeProjectEntry {
  id: string;
  projectName: string;
  roleName: string;
  city: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ResumeSkillEntry {
  id: string;
  category: string;
  content: string;
}

export interface ResumeAwardEntry {
  id: string;
  title: string;
  level: string;
  awardDate: string;
  description: string;
}

export interface ResumeLanguageEntry {
  id: string;
  language: string;
  score: string;
  description: string;
}

export interface ResumeCampusRoleEntry {
  id: string;
  organization: string;
  roleName: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ResumeLinkEntry {
  id: string;
  label: string;
  url: string;
}

export interface ResumeContent {
  personal: ResumePersonalInfo;
  education: ResumeEducationEntry[];
  internships: ResumeExperienceEntry[];
  projects: ResumeProjectEntry[];
  skills: ResumeSkillEntry[];
  awards: ResumeAwardEntry[];
  languages: ResumeLanguageEntry[];
  campusRoles: ResumeCampusRoleEntry[];
  selfEvaluation: string;
  links: ResumeLinkEntry[];
  sectionLabels: Partial<Record<ResumeSectionId, string>>;
}

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

export interface ResumeStyleConfig {
  templateCode: ResumeTemplateCode;
  fontFamily: ResumeFontFamily;
  fontSize: number;
  spacingScale: number;
  verticalSpacing: ResumeVerticalSpacingConfig;
  lineHeight: number;
  pageMargin: number;
  themeColor: string;
  headerVariant: ResumeHeaderVariant;
  basicInfoVariant: ResumeBasicInfoVariant;
  sectionTitleVariant: ResumeSectionTitleVariant;
  skillVariant: ResumeSkillVariant;
  experienceHeaderVariant: ResumeExperienceHeaderVariant;
  paperBackgroundVariant: ResumePaperBackgroundVariant;
  paperBackgroundPosition: ResumeHeaderAlign;
  dateFormat: ResumeDateFormat;
  titleStyle: ResumeTitleStyle;
  titleSeparator: string;
  doubleLinePriority: ResumeDoubleLinePriority;
  headerAlign: ResumeHeaderAlign;
  sectionSpacing: number;
  itemSpacing: number;
}

export interface ResumeLayoutItem {
  id: ResumeSectionId;
  visible: boolean;
  deleted?: boolean;
}

export interface ResumeDraftRecord {
  id: string;
  userId?: string;
  title: string;
  templateCode: string;
  status: string;
  contentJson?: unknown;
  styleJson?: unknown;
  layoutJson?: unknown;
  lastValidatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeDraftListResponse {
  limit: number;
  total: number;
  memberRoleCode: 'FREE_USER' | 'STANDARD_MEMBER' | 'SUPER_MEMBER';
  memberRoleName: string;
  pdfDownloadCount: number;
  pdfDownloadLimit: number | null;
  pdfDownloadLimitReached: boolean;
  list: ResumeDraftRecord[];
}

export interface ResumeTemplateConfigRecord {
  id: string;
  templateCode: ResumeTemplateCode;
  templateName: string;
  description?: string | null;
  styleJson: ResumeStyleConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeLayoutValidationResult {
  isOverflow: boolean;
  pageCount: number;
  availableHeight: number;
  contentHeight: number;
  overflowHeight: number;
  hintMessage: string;
}

export interface ResumeFileDownloadPayload {
  filename: string;
  mimeType: string;
  content?: string;
  downloadUrl?: string;
  objectKey?: string;
  expiresAt?: string;
  encoding?: 'utf8' | 'base64';
}

export interface OssUploadSessionPayload {
  provider: 'aliyun-oss';
  uploadMode: 'browser-sts';
  scene: string;
  bucket: string;
  region: string;
  endpoint: string;
  objectKey: string;
  signedUrl: string | null;
  signedUrlExpiresAt: string | null;
  secure: true;
  expiration: string;
  maxSize: number;
  allowedMimeTypes: string[];
  credentials: {
    accessKeyId: string;
    accessKeySecret: string;
    securityToken: string;
  };
}

export interface ResumePreviewMetrics {
  availableHeight: number;
  contentHeight: number;
  overflowHeight: number;
  pageCount: number;
}

export type ResumeAiOptimizeEntrySectionId =
  | 'education'
  | 'internships'
  | 'projects'
  | 'campusRoles'
  | 'awards'
  | 'languages'
  | 'skills';
export type ResumeAiOptimizeSectionId = 'selfEvaluation' | 'personalSummary';
export type ResumeAiTranslateDirection = 'zh-to-en' | 'en-to-zh';

export interface ResumeAiOptimizeEntryResponse {
  logId: string;
  optimizeType: 'entry';
  sectionId: ResumeAiOptimizeEntrySectionId;
  entryId: string;
  updatedFieldKeys: string[];
  updatedDraft: ResumeDraftRecord;
}

export interface ResumeAiAssessEntryResponse {
  sectionId: ResumeAiOptimizeEntrySectionId;
  entryId: string;
  suggestions: string[];
}

export interface ResumeAiSuggestionRecord {
  sectionId: ResumeAiOptimizeEntrySectionId | ResumeAiOptimizeSectionId;
  entryId: string;
  suggestions: string[];
  updatedAt: string;
}

export interface ResumeAiSuggestionPendingTarget {
  sectionId: ResumeAiOptimizeEntrySectionId | ResumeAiOptimizeSectionId;
  entryId: string;
}

export interface ResumeAiSuggestionListResponse {
  suggestions: ResumeAiSuggestionRecord[];
  pendingTargets: ResumeAiSuggestionPendingTarget[];
}

export interface ResumeAiOptimizeSectionResponse {
  logId: string;
  optimizeType: 'section';
  sectionId: ResumeAiOptimizeSectionId;
  updatedFieldKeys: string[];
  updatedDraft: ResumeDraftRecord;
}

export interface ResumeAiOptimizeGlobalSubmitResponse {
  taskId: string;
  optimizeType: 'global';
  status: 'processing';
  createdAt: string;
  pollingIntervalMs: number;
}

export interface ResumeAiOptimizeGlobalTaskStatusResponse {
  taskId: string;
  resumeId: string;
  optimizeType: 'global' | 'translate' | 'professional';
  status: 'processing' | 'success' | 'failed';
  updatedDraft?: ResumeDraftRecord;
  summary?: {
    updatedFieldCount: number;
    updatedSections: string[];
  };
  errorMessage?: string;
}

export interface ResumeAiTranslateSubmitResponse {
  taskId: string;
  optimizeType: 'translate';
  status: 'processing';
  createdAt: string;
  pollingIntervalMs: number;
  resumeId: string;
  sourceResumeId: string;
}

export interface ResumeAiProfessionalOptimizeSubmitResponse {
  taskId: string;
  optimizeType: 'professional';
  status: 'processing';
  createdAt: string;
  pollingIntervalMs: number;
  resumeId: string;
  sourceResumeId: string;
}

export interface ResumeSectionDefinition {
  id: ResumeSectionId;
  label: string;
  deletable: boolean;
}

export const RESUME_FONT_OPTIONS: Array<{ value: ResumeFontFamily; label: string }> = [
  { value: 'yahei', label: '微软雅黑' },
  { value: 'heiti', label: '黑体' },
  { value: 'songti', label: '宋体' },
  { value: 'kaiti', label: '楷体' },
];

export const RESUME_HEADER_ALIGN_OPTIONS: Array<{ value: ResumeHeaderAlign; label: string }> = [
  { value: 'left', label: '居左展示' },
  { value: 'center', label: '居中展示' },
  { value: 'right', label: '居右展示' },
];

export const RESUME_DATE_FORMAT_OPTIONS: Array<{ value: ResumeDateFormat; label: string }> = [
  { value: 'cn', label: '2021年1月' },
  { value: 'dot', label: '2021.01' },
];

export const RESUME_TITLE_STYLE_OPTIONS: Array<{ value: ResumeTitleStyle; label: string }> = [
  { value: 'single', label: '单行标题' },
  { value: 'double', label: '双行标题' },
];

export const RESUME_SECTION_DEFINITIONS: ResumeSectionDefinition[] = [
  { id: 'personal', label: '基本信息', deletable: false },
  { id: 'education', label: '教育经历', deletable: false },
  { id: 'internships', label: '实习经历', deletable: false },
  { id: 'projects', label: '项目经历', deletable: false },
  { id: 'skills', label: '专业技能', deletable: false },
  { id: 'awards', label: '荣誉奖项', deletable: true },
  { id: 'languages', label: '语言能力', deletable: true },
  { id: 'campusRoles', label: '校内职务', deletable: true },
  { id: 'selfEvaluation', label: '个人评价', deletable: true },
  { id: 'links', label: '社交主页 / 作品集', deletable: true },
];

export const RESUME_SMART_LAYOUT_LIMITS = {
  fontSize: { min: 10, max: 18 },
  lineHeight: { min: 12, max: 28 },
  pageMargin: { min: 5, max: 25 },
  sectionSpacing: { min: 12, max: 28 },
  itemSpacing: { min: 12, max: 28 },
  spacingScale: { min: 0.8, max: 1.2 },
};

export const DEFAULT_RESUME_VERTICAL_SPACING: ResumeVerticalSpacingConfig = {
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

export const DEFAULT_RESUME_STYLE: ResumeStyleConfig = {
  templateCode: 'style-a',
  fontFamily: 'yahei',
  fontSize: 12,
  spacingScale: 1,
  verticalSpacing: DEFAULT_RESUME_VERTICAL_SPACING,
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

export const DEFAULT_RESUME_CONTENT: ResumeContent = {
  personal: {
    name: '',
    phone: '',
    email: '',
    expectedRole: '',
    expectedCity: '',
    availability: '',
    website: '',
    avatarUrl: '',
    summary: '',
  },
  education: [createEmptyEducationEntry()],
  internships: [createEmptyExperienceEntry()],
  projects: [createEmptyProjectEntry()],
  skills: [createEmptySkillEntry()],
  awards: [],
  languages: [],
  campusRoles: [],
  selfEvaluation: '',
  links: [],
  sectionLabels: {},
};

export const DEFAULT_RESUME_LAYOUT: ResumeLayoutItem[] = RESUME_SECTION_DEFINITIONS.map((item) => ({
  id: item.id,
  visible: true,
  deleted: false,
}));

export function getAllowedHeaderAlignsByVariant(variant: ResumeHeaderVariant): ResumeHeaderAlign[] {
  switch (variant) {
    case 'business':
    case 'work':
      return ['center'];
    case 'highlight':
    case 'clear':
    case 'formal':
      return ['left', 'right'];
    case 'basic':
    default:
      return ['left', 'center', 'right'];
  }
}

export function normalizeHeaderAlignForVariant(variant: ResumeHeaderVariant, align?: unknown): ResumeHeaderAlign {
  const normalizedAlign = normalizeEnum(align, ['left', 'center', 'right'], DEFAULT_RESUME_STYLE.headerAlign);
  const allowedAligns = getAllowedHeaderAlignsByVariant(variant);
  return allowedAligns.includes(normalizedAlign) ? normalizedAlign : allowedAligns[0];
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyEducationEntry(): ResumeEducationEntry {
  return {
    id: createId('edu'),
    schoolName: '',
    degree: '',
    major: '',
    logoUrl: '',
    startDate: '',
    endDate: '',
    description: '',
  };
}

export function createEmptyExperienceEntry(): ResumeExperienceEntry {
  return {
    id: createId('exp'),
    companyName: '',
    roleName: '',
    city: '',
    startDate: '',
    endDate: '',
    description: '',
  };
}

export function createEmptyProjectEntry(): ResumeProjectEntry {
  return {
    id: createId('project'),
    projectName: '',
    roleName: '',
    city: '',
    startDate: '',
    endDate: '',
    description: '',
  };
}

export function createEmptySkillEntry(): ResumeSkillEntry {
  return {
    id: createId('skill'),
    category: '',
    content: '',
  };
}

export function createEmptyAwardEntry(): ResumeAwardEntry {
  return {
    id: createId('award'),
    title: '',
    level: '',
    awardDate: '',
    description: '',
  };
}

export function createEmptyLanguageEntry(): ResumeLanguageEntry {
  return {
    id: createId('lang'),
    language: '',
    score: '',
    description: '',
  };
}

export function createEmptyCampusRoleEntry(): ResumeCampusRoleEntry {
  return {
    id: createId('campus'),
    organization: '',
    roleName: '',
    startDate: '',
    endDate: '',
    description: '',
  };
}

export function createEmptyLinkEntry(): ResumeLinkEntry {
  return {
    id: createId('link'),
    label: '',
    url: '',
  };
}

export function normalizeResumeContent(input?: unknown): ResumeContent {
  const source = isRecord(input) ? input : {};
  return {
    personal: {
      ...DEFAULT_RESUME_CONTENT.personal,
      ...(isRecord(source.personal) ? source.personal : {}),
    },
    education: normalizeArray(source.education, createEmptyEducationEntry),
    internships: normalizeArray(source.internships, createEmptyExperienceEntry),
    projects: normalizeArray(source.projects, createEmptyProjectEntry),
    skills: normalizeArray(source.skills, createEmptySkillEntry),
    awards: normalizeArray(source.awards, createEmptyAwardEntry, true),
    languages: normalizeArray(source.languages, createEmptyLanguageEntry, true),
    campusRoles: normalizeArray(source.campusRoles, createEmptyCampusRoleEntry, true),
    selfEvaluation: typeof source.selfEvaluation === 'string' ? source.selfEvaluation : '',
    links: normalizeArray(source.links, createEmptyLinkEntry, true),
    sectionLabels: normalizeSectionLabels(source.sectionLabels),
  };
}

export function normalizeResumeStyle(input?: unknown): ResumeStyleConfig {
  const source = isRecord(input) ? input : {};
  const sourceVerticalSpacing = isRecord(source.verticalSpacing) ? source.verticalSpacing : undefined;
  const merged = {
    ...DEFAULT_RESUME_STYLE,
    ...Object.fromEntries(
      Object.entries(DEFAULT_RESUME_STYLE).map(([key, value]) => {
        const nextValue = source[key as keyof typeof source];
        return [key, nextValue ?? value];
      }),
    ),
  } as ResumeStyleConfig;
  const legacyLineHeight = source.lineHeight ?? source.sectionSpacing ?? source.itemSpacing;
  const spacingScale = clampNumber(
    source.spacingScale,
    RESUME_SMART_LAYOUT_LIMITS.spacingScale.min,
    RESUME_SMART_LAYOUT_LIMITS.spacingScale.max,
    DEFAULT_RESUME_STYLE.spacingScale,
  );
  const verticalSpacing = normalizeVerticalSpacing(sourceVerticalSpacing, legacyLineHeight);
  const lineHeight = clampNumber(
    verticalSpacing.bodyTextLineHeightPt * spacingScale,
    RESUME_SMART_LAYOUT_LIMITS.lineHeight.min,
    RESUME_SMART_LAYOUT_LIMITS.lineHeight.max,
    DEFAULT_RESUME_STYLE.lineHeight,
  );
  const headerVariant = normalizeEnum(
    merged.headerVariant,
    ['business', 'highlight', 'clear', 'basic', 'formal', 'work'],
    DEFAULT_RESUME_STYLE.headerVariant,
  );
  const headerAlign = normalizeHeaderAlignForVariant(headerVariant, merged.headerAlign);

  return {
    ...merged,
    templateCode: normalizeEnum(merged.templateCode, ['style-a', 'style-b', 'style-c'], DEFAULT_RESUME_STYLE.templateCode),
    fontSize: clampNumber(
      merged.fontSize,
      RESUME_SMART_LAYOUT_LIMITS.fontSize.min,
      RESUME_SMART_LAYOUT_LIMITS.fontSize.max,
      DEFAULT_RESUME_STYLE.fontSize,
    ),
    lineHeight,
    spacingScale,
    verticalSpacing,
    pageMargin: clampNumber(
      merged.pageMargin,
      RESUME_SMART_LAYOUT_LIMITS.pageMargin.min,
      RESUME_SMART_LAYOUT_LIMITS.pageMargin.max,
      DEFAULT_RESUME_STYLE.pageMargin,
    ),
    headerVariant,
    headerAlign,
    basicInfoVariant: normalizeEnum(merged.basicInfoVariant, ['text-line', 'icon-line', 'text-dot', 'icon-dot'], DEFAULT_RESUME_STYLE.basicInfoVariant),
    sectionTitleVariant: normalizeEnum(merged.sectionTitleVariant, ['classic', 'left-bar', 'pill-line', 'bg-block'], DEFAULT_RESUME_STYLE.sectionTitleVariant),
    skillVariant: normalizeEnum(merged.skillVariant, ['list', 'icon-grid', 'tag-list'], DEFAULT_RESUME_STYLE.skillVariant),
    experienceHeaderVariant: normalizeEnum(
      merged.experienceHeaderVariant,
      ['single-line', 'double-line'],
      DEFAULT_RESUME_STYLE.experienceHeaderVariant,
    ),
    paperBackgroundVariant: normalizeEnum(
      merged.paperBackgroundVariant,
      ['none', 'diamond-grid', 'arc-lines', 'wave-lines', 'vertical-wave', 'petal', 'chevron', 'geo-frame', 'angle-grid'],
      DEFAULT_RESUME_STYLE.paperBackgroundVariant,
    ),
    paperBackgroundPosition: normalizeEnum(
      merged.paperBackgroundPosition,
      ['left', 'center', 'right'],
      DEFAULT_RESUME_STYLE.paperBackgroundPosition,
    ),
    doubleLinePriority: 'time-first',
    sectionSpacing: lineHeight,
    itemSpacing: lineHeight,
  };
}

export function normalizeResumeLayout(input?: unknown): ResumeLayoutItem[] {
  const source = Array.isArray(input) ? input.filter(isRecord) : [];
  const validIds = new Set(RESUME_SECTION_DEFINITIONS.map((item) => item.id));

  const normalized = source
    .map((item) => ({
      id: String(item.id) as ResumeSectionId,
      visible: typeof item.visible === 'boolean' ? item.visible : true,
      deleted: typeof item.deleted === 'boolean' ? item.deleted : false,
    }))
    .filter((item) => validIds.has(item.id));

  const existingIds = new Set(normalized.map((item) => item.id));
  const missing = RESUME_SECTION_DEFINITIONS
    .filter((item) => !existingIds.has(item.id))
    .map((item) => ({ id: item.id, visible: true, deleted: false }));

  return [...normalized, ...missing];
}

export function getResumeFontFamily(fontFamily: ResumeFontFamily) {
  switch (fontFamily) {
    case 'heiti':
      return '"SimHei", "Heiti SC", "PingFang SC", sans-serif';
    case 'songti':
      return '"SimSun", "Songti SC", serif';
    case 'kaiti':
      return '"KaiTi", "Kaiti SC", serif';
    case 'fangsong':
      return '"FangSong", "STFangsong", serif';
    case 'yahei':
    default:
      return '"Microsoft YaHei", "PingFang SC", sans-serif';
  }
}

export function formatResumeDate(value: string, format: ResumeDateFormat) {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  const [year, month] = normalized.split('-');
  if (!year || !month) {
    return normalized;
  }

  if (format === 'dot') {
    return `${year}.${month}`;
  }

  return `${year}年${Number(month)}月`;
}

export function getSectionLabel(sectionId: ResumeSectionId, sectionLabels?: Partial<Record<ResumeSectionId, string>>) {
  const customLabel = sectionLabels?.[sectionId]?.trim();
  if (customLabel) {
    return customLabel;
  }
  return RESUME_SECTION_DEFINITIONS.find((item) => item.id === sectionId)?.label ?? sectionId;
}

export function isPersonalInfoEmpty(personal: ResumePersonalInfo) {
  return ![
    personal.name,
    personal.phone,
    personal.email,
    personal.expectedRole,
    personal.expectedCity,
    personal.availability,
    personal.website,
    personal.avatarUrl,
  ].some((item) => item.trim()) && !hasMeaningfulRichText(personal.summary);
}

export function isEducationEntryEmpty(item: ResumeEducationEntry) {
  return (
    !item.schoolName.trim() &&
    !item.degree.trim() &&
    !item.major.trim() &&
    !item.logoUrl.trim() &&
    !item.startDate.trim() &&
    !item.endDate.trim() &&
    !hasMeaningfulRichText(item.description)
  );
}

export function isExperienceEntryEmpty(item: ResumeExperienceEntry) {
  return (
    !item.companyName.trim() &&
    !item.roleName.trim() &&
    !item.city.trim() &&
    !item.startDate.trim() &&
    !item.endDate.trim() &&
    !hasMeaningfulRichText(item.description)
  );
}

export function isProjectEntryEmpty(item: ResumeProjectEntry) {
  return (
    !item.projectName.trim() &&
    !item.roleName.trim() &&
    !item.city.trim() &&
    !item.startDate.trim() &&
    !item.endDate.trim() &&
    !hasMeaningfulRichText(item.description)
  );
}

export function isSkillEntryEmpty(item: ResumeSkillEntry) {
  return !item.category.trim() && !hasMeaningfulRichText(item.content);
}

export function isAwardEntryEmpty(item: ResumeAwardEntry) {
  return !item.title.trim() && !item.level.trim() && !item.awardDate.trim() && !hasMeaningfulRichText(item.description);
}

export function isLanguageEntryEmpty(item: ResumeLanguageEntry) {
  return !item.language.trim() && !item.score.trim() && !hasMeaningfulRichText(item.description);
}

export function isCampusRoleEntryEmpty(item: ResumeCampusRoleEntry) {
  return (
    !item.organization.trim() &&
    !item.roleName.trim() &&
    !item.startDate.trim() &&
    !item.endDate.trim() &&
    !hasMeaningfulRichText(item.description)
  );
}

export function isLinkEntryEmpty(item: ResumeLinkEntry) {
  return !item.label.trim() && !item.url.trim();
}

export function getSectionFilledCount(sectionId: ResumeSectionId, content: ResumeContent) {
  switch (sectionId) {
    case 'personal':
      return isPersonalInfoEmpty(content.personal) ? 0 : 1;
    case 'education':
      return content.education.filter((item) => !isEducationEntryEmpty(item)).length;
    case 'internships':
      return content.internships.filter((item) => !isExperienceEntryEmpty(item)).length;
    case 'projects':
      return content.projects.filter((item) => !isProjectEntryEmpty(item)).length;
    case 'skills':
      return content.skills.filter((item) => !isSkillEntryEmpty(item)).length;
    case 'awards':
      return content.awards.filter((item) => !isAwardEntryEmpty(item)).length;
    case 'languages':
      return content.languages.filter((item) => !isLanguageEntryEmpty(item)).length;
    case 'campusRoles':
      return content.campusRoles.filter((item) => !isCampusRoleEntryEmpty(item)).length;
    case 'selfEvaluation':
      return hasMeaningfulRichText(content.selfEvaluation) ? 1 : 0;
    case 'links':
      return content.links.filter((item) => !isLinkEntryEmpty(item)).length;
    default:
      return 0;
  }
}

export function isSectionEmpty(sectionId: ResumeSectionId, content: ResumeContent) {
  return getSectionFilledCount(sectionId, content) === 0;
}

export function sortEntriesByDateDesc<T extends { startDate?: string; endDate?: string }>(entries: T[]) {
  return [...entries].sort((left, right) => parseEntryTime(right) - parseEntryTime(left));
}

export function hasIncompleteDates<T extends { startDate?: string; endDate?: string }>(entries: T[]) {
  return entries.some((item) => Boolean(item.startDate?.trim() || item.endDate?.trim()) && (!item.startDate?.trim() || !item.endDate?.trim()));
}

export function buildSectionVisibilityMap(layout: ResumeLayoutItem[]) {
  return Object.fromEntries(layout.map((item) => [item.id, item.visible && !item.deleted])) as Record<ResumeSectionId, boolean>;
}

function parseEntryTime(entry: { startDate?: string; endDate?: string }) {
  const source = entry.startDate?.trim();
  if (!source) {
    return 0;
  }
  const date = new Date(`${source}-01`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function normalizeVerticalSpacing(
  input: Record<string, unknown> | undefined,
  legacyLineHeight: unknown,
): ResumeVerticalSpacingConfig {
  const fallback = buildLegacyCompatibleVerticalSpacing(legacyLineHeight);

  return {
    sectionTitleToDividerPt: clampMinNumber(input?.sectionTitleToDividerPt, 0, fallback.sectionTitleToDividerPt),
    dividerToEntryHeaderPt: clampMinNumber(input?.dividerToEntryHeaderPt, 0, fallback.dividerToEntryHeaderPt),
    entryHeaderToBodyPt: clampMinNumber(input?.entryHeaderToBodyPt, 0, fallback.entryHeaderToBodyPt),
    listItemGapPt: clampMinNumber(input?.listItemGapPt, 0, fallback.listItemGapPt),
    bodyTextLineHeightPt: clampMinNumber(input?.bodyTextLineHeightPt, 1, fallback.bodyTextLineHeightPt),
    paragraphGapPt: clampMinNumber(input?.paragraphGapPt, 0, fallback.paragraphGapPt),
    sectionCardGapPt: clampMinNumber(input?.sectionCardGapPt, 0, fallback.sectionCardGapPt),
    pagePaddingTopPt: clampMinNumber(input?.pagePaddingTopPt, 0, fallback.pagePaddingTopPt),
    pagePaddingBottomPt: clampMinNumber(input?.pagePaddingBottomPt, 0, fallback.pagePaddingBottomPt),
    headerPaddingTopPt: clampMinNumber(input?.headerPaddingTopPt, 0, fallback.headerPaddingTopPt),
    headerPaddingBottomPt: clampMinNumber(input?.headerPaddingBottomPt, 0, fallback.headerPaddingBottomPt),
  };
}

function buildLegacyCompatibleVerticalSpacing(legacyLineHeight: unknown): ResumeVerticalSpacingConfig {
  const bodyTextLineHeightPt = clampNumber(
    legacyLineHeight,
    RESUME_SMART_LAYOUT_LIMITS.lineHeight.min,
    RESUME_SMART_LAYOUT_LIMITS.lineHeight.max,
    DEFAULT_RESUME_VERTICAL_SPACING.bodyTextLineHeightPt,
  );

  return {
    ...DEFAULT_RESUME_VERTICAL_SPACING,
    bodyTextLineHeightPt,
  };
}

function clampMinNumber(value: unknown, min: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(parsed, min);
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeArray<T extends { id: string }>(
  input: unknown,
  factory: () => T,
  keepEmptyArray = false,
): T[] {
  if (!Array.isArray(input)) {
    return keepEmptyArray ? [] : [factory()];
  }

  const list = input.filter(isRecord).map((item) => ({
    ...factory(),
    ...item,
    id: typeof item.id === 'string' && item.id.trim() ? item.id : factory().id,
  }));

  if (!list.length) {
    return keepEmptyArray ? [] : [factory()];
  }

  return list;
}

function normalizeSectionLabels(input: unknown): Partial<Record<ResumeSectionId, string>> {
  if (!isRecord(input)) {
    return {};
  }
  const validIds = new Set(RESUME_SECTION_DEFINITIONS.map((item) => item.id));
  const entries = Object.entries(input).flatMap(([key, value]) => {
    if (!validIds.has(key as ResumeSectionId) || typeof value !== 'string') {
      return [];
    }
    const normalized = value.trim();
    return normalized ? [[key as ResumeSectionId, normalized] as const] : [];
  });
  return Object.fromEntries(entries) as Partial<Record<ResumeSectionId, string>>;
}
