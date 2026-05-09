import { DEFAULT_RESUME_VERTICAL_SPACING } from './resume-types';
import type {
  ResumeVerticalSpacingConfig,
  ResumeBasicInfoVariant,
  ResumeExperienceHeaderVariant,
  ResumeHeaderVariant,
  ResumeSectionTitleVariant,
  ResumeSkillVariant,
  ResumeTemplateCode,
} from './resume-types';

export interface ResumeTemplateDefinition {
  code: ResumeTemplateCode;
  name: string;
  description: string;
  themeColor: string;
  headerVariant: ResumeHeaderVariant;
  basicInfoVariant: ResumeBasicInfoVariant;
  sectionTitleVariant: ResumeSectionTitleVariant;
  skillVariant: ResumeSkillVariant;
  experienceHeaderVariant: ResumeExperienceHeaderVariant;
  fontSize: number;
  lineHeight: number;
  spacingScaleDefault: number;
  verticalSpacing: ResumeVerticalSpacingConfig;
  pageMargin: number;
}

export const RESUME_TEMPLATES: Record<ResumeTemplateCode, ResumeTemplateDefinition> = {
  'style-a': {
    code: 'style-a',
    name: 'A 样式',
    description: '居中头像、线型标题、清爽单栏',
    themeColor: '#4183FF',
    headerVariant: 'basic',
    basicInfoVariant: 'text-line',
    sectionTitleVariant: 'classic',
    skillVariant: 'list',
    experienceHeaderVariant: 'single-line',
    fontSize: 12,
    lineHeight: 20,
    spacingScaleDefault: 1,
    verticalSpacing: DEFAULT_RESUME_VERTICAL_SPACING,
    pageMargin: 9,
  },
  'style-b': {
    code: 'style-b',
    name: 'B 样式',
    description: '横幅头图、图标信息、标签标题',
    themeColor: '#4183FF',
    headerVariant: 'highlight',
    basicInfoVariant: 'icon-line',
    sectionTitleVariant: 'pill-line',
    skillVariant: 'icon-grid',
    experienceHeaderVariant: 'double-line',
    fontSize: 12,
    lineHeight: 20,
    spacingScaleDefault: 1,
    verticalSpacing: DEFAULT_RESUME_VERTICAL_SPACING,
    pageMargin: 8,
  },
  'style-c': {
    code: 'style-c',
    name: 'C 样式',
    description: '商务右头像、色条标题、标签技能',
    themeColor: '#4183FF',
    headerVariant: 'business',
    basicInfoVariant: 'text-dot',
    sectionTitleVariant: 'left-bar',
    skillVariant: 'tag-list',
    experienceHeaderVariant: 'single-line',
    fontSize: 12,
    lineHeight: 20,
    spacingScaleDefault: 1,
    verticalSpacing: DEFAULT_RESUME_VERTICAL_SPACING,
    pageMargin: 10,
  },
};

export const RESUME_TEMPLATE_OPTIONS = Object.values(RESUME_TEMPLATES).map((template) => ({
  value: template.code,
  label: template.name,
  description: template.description,
}));

export const RESUME_HEADER_VARIANT_OPTIONS: Array<{ value: ResumeHeaderVariant; label: string }> = [
  { value: 'business', label: '商务' },
  { value: 'highlight', label: '突出' },
  { value: 'clear', label: '清晰' },
  { value: 'basic', label: '基础' },
  { value: 'formal', label: '正式' },
  { value: 'work', label: '工作' },
];

export const RESUME_BASIC_INFO_VARIANT_OPTIONS: Array<{ value: ResumeBasicInfoVariant; label: string }> = [
  { value: 'text-line', label: '文字竖线' },
  { value: 'icon-line', label: '图标竖线' },
  { value: 'text-dot', label: '文字圆点' },
  { value: 'icon-dot', label: '图标圆点' },
];

export const RESUME_SECTION_TITLE_VARIANT_OPTIONS: Array<{ value: ResumeSectionTitleVariant; label: string }> = [
  { value: 'classic', label: '经典底线' },
  { value: 'left-bar', label: '商务竖条' },
  { value: 'pill-line', label: '胶囊拉线' },
  { value: 'bg-block', label: '通栏色块' },
];

export const RESUME_SKILL_VARIANT_OPTIONS: Array<{ value: ResumeSkillVariant; label: string }> = [
  { value: 'list', label: '技能 1' },
  { value: 'icon-grid', label: '技能 2' },
  { value: 'tag-list', label: '技能 3' },
];

export const RESUME_EXPERIENCE_HEADER_VARIANT_OPTIONS: Array<{ value: ResumeExperienceHeaderVariant; label: string }> = [
  { value: 'single-line', label: '经历单行' },
  { value: 'double-line', label: '经历双行' },
];

export function getResumeTemplate(code: ResumeTemplateCode | string | undefined) {
  return RESUME_TEMPLATES[(code as ResumeTemplateCode) || 'style-a'] ?? RESUME_TEMPLATES['style-a'];
}
