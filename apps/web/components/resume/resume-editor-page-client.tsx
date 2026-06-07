'use client';

import {
  type ChangeEvent,
  type FocusEvent as ReactFocusEvent,
  type FormEvent as ReactFormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { SiteBeianFooter } from '@/components/layout/site-beian-footer';
import {
  ArrowLeft,
  AlignCenter,
  AlignLeft,
  AlignRight,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Download,
  EyeOff,
  Image as ImageIcon,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Wand2,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { downloadFilePayload } from '@/lib/admin';
import { clientFetch } from '@/lib/api';
import { uploadFileToOss as sharedUploadFileToOss } from '@/lib/oss';
import { COMMON_TOAST_COPY, RESUME_TOAST_COPY } from '@/lib/toast-copy';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { showToast } from '@/store/toast-store';
import { MemberAccessDialog } from '@/components/membership/member-access-dialog';
import { getRichTextPlainText } from './resume-rich-text';
import {
  type ResumeBasicInfoVariant,
  type ResumeAiOptimizeEntryResponse,
  type ResumeAiOptimizeEntrySectionId,
  type ResumeAiOptimizeGlobalSubmitResponse,
  type ResumeAiOptimizeGlobalTaskStatusResponse,
  type ResumeAiProfessionalOptimizeSubmitResponse,
  type ResumeAiSuggestionListResponse,
  type ResumeAiOptimizeSectionId,
  type ResumeAiOptimizeSectionResponse,
  type ResumeAiTranslateDirection,
  type ResumeAiTranslateSubmitResponse,
  DEFAULT_RESUME_CONTENT,
  DEFAULT_RESUME_LAYOUT,
  DEFAULT_RESUME_STYLE,
  DEFAULT_RESUME_VERTICAL_SPACING,
  RESUME_FONT_OPTIONS,
  RESUME_SECTION_DEFINITIONS,
  createEmptyAwardEntry,
  createEmptyCampusRoleEntry,
  createEmptyEducationEntry,
  createEmptyExperienceEntry,
  createEmptyLanguageEntry,
  createEmptyLinkEntry,
  createEmptyProjectEntry,
  createEmptySkillEntry,
  getAllowedHeaderAlignsByVariant,
  getSectionFilledCount,
  getSectionLabel,
  hasIncompleteDates,
  normalizeResumeContent,
  normalizeResumeLayout,
  normalizeResumeStyle,
  sortEntriesByDateDesc,
  type ResumeContent,
  type ResumeDraftListResponse,
  type ResumeDraftRecord,
  type ResumeFileDownloadPayload,
  type ResumeHeaderVariant,
  type ResumeLayoutItem,
  type OssUploadSessionPayload,
  type ResumePreviewMetrics,
  type ResumeSectionTitleVariant,
  type ResumeSectionId,
  type ResumeSkillVariant,
  type ResumeStyleConfig,
  type ResumeTemplateCode,
  type ResumeTemplateConfigRecord,
} from './resume-types';
import {
  RESUME_TEMPLATES,
  RESUME_BASIC_INFO_VARIANT_OPTIONS,
  RESUME_HEADER_VARIANT_OPTIONS,
  RESUME_SECTION_TITLE_VARIANT_OPTIONS,
  RESUME_SKILL_VARIANT_OPTIONS,
} from './resume-templates';

const ResumeDocument = dynamic(
  () => import('./resume-document').then((mod) => mod.ResumeDocument),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-[#D8DEE8] bg-white text-sm text-slate-500">
        简历预览加载中...
      </div>
    ),
  },
);

const ResumeRichTextEditor = dynamic(
  () => import('./resume-rich-text-editor').then((mod) => mod.ResumeRichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-[#E5E6EB] bg-white px-4 text-sm text-slate-500">
        富文本编辑器加载中...
      </div>
    ),
  },
);

const REDIRECT_PATH = '/resume-optimizer';

function getGuestPreviewBlockedElement(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  if (!element) {
    return null;
  }

  const blockedElement = element.closest<HTMLElement>(
    'input, textarea, select, [contenteditable], [role="textbox"], [data-resume-guest-block]',
  );
  if (!blockedElement) {
    return null;
  }

  if (blockedElement.closest('[data-allow-guest="true"]')) {
    return null;
  }

  return blockedElement;
}
const PREVIEW_BASE_WIDTH = 794;
const PREVIEW_BASE_HEIGHT = 1123;
const FLOATING_PANEL_OFFSET = 12;
const AVATAR_CROP_STAGE_MAX_WIDTH = 520;
const AVATAR_CROP_STAGE_MAX_HEIGHT = 520;
const AVATAR_CROP_OUTPUT_WIDTH = 900;
const AVATAR_CROP_OUTPUT_HEIGHT = 1200;
const AVATAR_CROP_MIN_SCALE = 0.35;
const AVATAR_CROP_DEFAULT_SCALE = 0.82;
const AVATAR_CROP_MAX_SCALE = 1;
const SCHOOL_LOGO_CROP_OUTPUT_WIDTH = 1500;
const SCHOOL_LOGO_CROP_OUTPUT_HEIGHT = 927;
const AUTO_FIT_LIMITS = {
  fontSize: 12,
  spacingScale: 0.8,
  pageMargin: 5,
};
const BRAND_THEME = '#4183FF';
const FONT_SIZE_OPTIONS = Array.from({ length: 9 }, (_, index) => 10 + index);
const SPACING_SCALE_OPTIONS = Array.from({ length: 9 }, (_, index) => Number((0.8 + index * 0.05).toFixed(2)));
const PAGE_MARGIN_OPTIONS = [5, 10, 15, 20, 25];
const THEME_OPTIONS = [
  { value: '#4183FF', label: '蓝色主题' },
  { value: '#000000', label: '黑色主题' },
  { value: '#D83A34', label: '红色主题' },
  { value: '#F28B2E', label: '橙色主题' },
  { value: '#9C5BDE', label: '紫色主题' },
  { value: '#68B453', label: '绿色主题' },
];
const PAPER_BACKGROUND_OPTIONS: Array<{
  value: ResumeStyleConfig['paperBackgroundVariant'];
  label: string;
  premium?: boolean;
}> = [
  { value: 'none', label: '纯净' },
  { value: 'diamond-grid', label: '菱格' },
  { value: 'arc-lines', label: '弧线', premium: true },
  { value: 'wave-lines', label: '水波', premium: true },
  { value: 'vertical-wave', label: '纵波', premium: true },
  { value: 'petal', label: '花纹', premium: true },
  { value: 'chevron', label: '折线', premium: true },
  { value: 'geo-frame', label: '几何', premium: true },
  { value: 'angle-grid', label: '角网', premium: true },
];
const PREMIUM_BADGE = '◆';
const OSS_IMAGE_UPLOAD_SCENES = {
  avatar: 'resume-avatar',
  schoolLogo: 'resume-school-logo',
} as const;
type ImageCropConfig = {
  title: string;
  description: string;
  helperText: string;
  successMessage: string;
  previewAspectRatio: string;
  previewObjectPosition: string;
  targetRatio: number;
  outputWidth: number;
  outputHeight: number;
  minScale: number;
  defaultScale: number;
  maxScale: number;
};
const IMAGE_CROP_CONFIGS: Record<(typeof OSS_IMAGE_UPLOAD_SCENES)[keyof typeof OSS_IMAGE_UPLOAD_SCENES], ImageCropConfig> = {
  [OSS_IMAGE_UPLOAD_SCENES.avatar]: {
    title: '裁剪头像',
    description: '请将头像调整到 3:4 裁剪框内。拖动中间可移动位置，拖动边缘或角点可同比例缩放，确认后仅上传裁剪成品。',
    helperText: '支持任意尺寸和比例原图，确认裁剪后将按 3:4 标准头像上传。',
    successMessage: '头像上传成功',
    previewAspectRatio: '295 / 413',
    previewObjectPosition: 'center top',
    targetRatio: 3 / 4,
    outputWidth: AVATAR_CROP_OUTPUT_WIDTH,
    outputHeight: AVATAR_CROP_OUTPUT_HEIGHT,
    minScale: AVATAR_CROP_MIN_SCALE,
    defaultScale: AVATAR_CROP_DEFAULT_SCALE,
    maxScale: AVATAR_CROP_MAX_SCALE,
  },
  [OSS_IMAGE_UPLOAD_SCENES.schoolLogo]: {
    title: '裁剪校徽',
    description: '请将校徽调整到固定裁剪框内。拖动中间可移动位置，拖动边缘或角点可同比例缩放，确认后仅上传裁剪成品。',
    helperText: '支持任意尺寸和比例原图，确认裁剪后将按校徽标准比例上传。',
    successMessage: '校徽上传成功',
    previewAspectRatio: '1500 / 927',
    previewObjectPosition: 'center',
    targetRatio: SCHOOL_LOGO_CROP_OUTPUT_WIDTH / SCHOOL_LOGO_CROP_OUTPUT_HEIGHT,
    outputWidth: SCHOOL_LOGO_CROP_OUTPUT_WIDTH,
    outputHeight: SCHOOL_LOGO_CROP_OUTPUT_HEIGHT,
    minScale: AVATAR_CROP_MIN_SCALE,
    defaultScale: AVATAR_CROP_DEFAULT_SCALE,
    maxScale: AVATAR_CROP_MAX_SCALE,
  },
};
const STYLE_PANEL_TABS = [
  { id: 'template', label: '模板切换' },
  { id: 'header', label: '头部布局' },
  { id: 'basic', label: '基本信息' },
  { id: 'section', label: '模块样式' },
  { id: 'paper', label: '纸张风格' },
  { id: 'skills', label: '技能样式' },
] as const;
type StylePanelTab = (typeof STYLE_PANEL_TABS)[number]['id'];
type ToolbarPanel = 'font' | 'fontSize' | 'spacingScale' | 'pageMargin' | 'theme' | 'textFormat' | 'templateStyle' | 'moduleManager' | 'translate' | 'download' | null;
type ResumeAiUndoScope = 'entry' | 'global';
type ResumeBatchAiAction =
  | { type: 'translate'; direction: ResumeAiTranslateDirection }
  | { type: 'professional' };
type ResumeBatchAiTask = {
  taskId: string;
  resumeId: string;
  sourceResumeId: string;
  optimizeType: 'translate' | 'professional';
  pollingIntervalMs: number;
};

interface ResumeAiUndoState {
  scope: ResumeAiUndoScope;
  sectionId?: SupportedSectionId;
  entryId?: string;
  previousDraft: ResumeDraftRecord;
}

interface ResumeEntrySuggestionState {
  suggestions: string[];
  loading: boolean;
}

type ResumeSuggestionTargetSectionId = ResumeAiOptimizeEntrySectionId | ResumeAiOptimizeSectionId;
const DRAFT_COUNT_COPY: Record<ResumeDraftListResponse['memberRoleCode'], { limit: number; upgradeHint: string }> = {
  FREE_USER: {
    limit: 1,
    upgradeHint: '当前账号已创建 1 份简历，如需新建第 2 份，请先开通超级会员。',
  },
  STANDARD_MEMBER: {
    limit: 1,
    upgradeHint: '当前账号已创建 1 份简历，如需继续新建，请升级超级会员。',
  },
  SUPER_MEMBER: {
    limit: 5,
    upgradeHint: '超级会员最多可创建 5 份简历。',
  },
};
type AvatarCropState = {
  file: File;
  sourceUrl: string;
  imageWidth: number;
  imageHeight: number;
  cropConfig: ImageCropConfig;
  cropScale: number;
  cropX: number;
  cropY: number;
};
type AvatarCropHandle = 'move' | 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type AvatarCropInteraction = {
  pointerId: number;
  handle: AvatarCropHandle;
  startClientX: number;
  startClientY: number;
  cropRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};
const SUPPORTED_SECTION_IDS = [
  'personal',
  'education',
  'internships',
  'projects',
  'selfEvaluation',
  'awards',
  'skills',
  'languages',
  'campusRoles',
  'links',
] as const satisfies readonly ResumeSectionId[];
const SUPPORTED_SECTION_SET = new Set<ResumeSectionId>(SUPPORTED_SECTION_IDS);
const REQUIRED_SECTION_SET = new Set<ResumeSectionId>(
  RESUME_SECTION_DEFINITIONS.filter((item) => !item.deletable).map((item) => item.id),
);
const REFERENCE_LAYOUT_ORDER: ResumeSectionId[] = [
  'personal',
  'education',
  'internships',
  'projects',
  'selfEvaluation',
  'awards',
  'skills',
  'languages',
  'campusRoles',
  'links',
];
const SECTION_COPY: Record<
  SupportedSectionId,
  {
    sidebarLabel: string;
    drawerTitle: string;
    addLabel?: string;
    emptyLabel?: string;
    summaryHint: string;
  }
> = {
  personal: {
    sidebarLabel: '基本信息模块',
    drawerTitle: '基本信息',
    summaryHint: '维护姓名、联系方式与求职意向',
  },
  education: {
    sidebarLabel: '教育经历模块',
    drawerTitle: '教育经历',
    addLabel: '+ 再增加一段教育经历',
    summaryHint: '补充学校、学历、专业与时间',
  },
  internships: {
    sidebarLabel: '实习经历模块',
    drawerTitle: '实习经历',
    addLabel: '+ 再增加一段实习经历',
    summaryHint: '梳理岗位、职责、城市与关键动作',
  },
  projects: {
    sidebarLabel: '项目经历模块',
    drawerTitle: '项目经历',
    addLabel: '+ 再增加一段项目经历',
    summaryHint: '突出项目背景、角色与结果',
  },
  selfEvaluation: {
    sidebarLabel: '个人评价模块',
    drawerTitle: '个人评价',
    summaryHint: '沉淀亮点、优势与匹配度',
  },
  awards: {
    sidebarLabel: '荣誉奖项模块',
    drawerTitle: '荣誉奖项',
    addLabel: '+ 再增加一段荣誉奖项',
    emptyLabel: '新增第一条荣誉奖项',
    summaryHint: '填写奖项、级别与补充说明',
  },
  skills: {
    sidebarLabel: '专业技能模块',
    drawerTitle: '专业技能',
    addLabel: '+ 新增技能描述',
    summaryHint: '按分类整理技能与熟练项',
  },
  languages: {
    sidebarLabel: '语言能力模块',
    drawerTitle: '语言能力',
    addLabel: '+ 新增语言能力',
    emptyLabel: '新增第一项语言能力',
    summaryHint: '补充语言成绩、等级与使用场景',
  },
  campusRoles: {
    sidebarLabel: '校园经历模块',
    drawerTitle: '校园经历',
    addLabel: '+ 新增校园经历',
    summaryHint: '记录社团、学生组织与校内岗位',
  },
  links: {
    sidebarLabel: '作品集模块',
    drawerTitle: '作品集',
    addLabel: '+ 新增作品集链接',
    emptyLabel: '新增第一条作品集链接',
    summaryHint: '维护主页、作品集和社交链接',
  },
};

type SupportedSectionId = (typeof SUPPORTED_SECTION_IDS)[number];

const TEMPLATE_PREVIEW_CONTENT: ResumeContent = {
  personal: {
    name: '张同学',
    phone: '13800000000',
    email: 'demo@example.com',
    expectedRole: '前端开发',
    expectedCity: '上海',
    availability: '两周内到岗',
    website: 'github.com/demo',
    avatarUrl: '',
    summary: '<p>3 段互联网实习，专注 React / TypeScript 工程化落地。</p>',
  },
  education: [
    {
      id: 'preview-edu-1',
      schoolName: '华东理工大学',
      degree: '本科',
      major: '软件工程',
      logoUrl: '',
      startDate: '2021-09',
      endDate: '2025-06',
      description: '<ul><li>GPA 3.7/4.0，连续两年一等奖学金</li></ul>',
    },
  ],
  internships: [
    {
      id: 'preview-exp-1',
      companyName: '示例科技',
      roleName: '前端实习生',
      city: '上海',
      startDate: '2024-06',
      endDate: '2024-12',
      description: '<ul><li>负责中后台模块重构，首屏性能提升 22%</li></ul>',
    },
  ],
  projects: [
    {
      id: 'preview-project-1',
      projectName: 'AI简历优化平台',
      roleName: '项目负责人',
      city: '上海',
      startDate: '2024-03',
      endDate: '2024-05',
      description: '<ul><li>设计模板系统与可视化配置，交付 10+ 套样式</li></ul>',
    },
  ],
  skills: [
    {
      id: 'preview-skill-1',
      category: '前端',
      content: '<ul><li>React / TypeScript / Next.js / Tailwind CSS</li></ul>',
    },
  ],
  awards: [],
  languages: [],
  campusRoles: [],
  selfEvaluation: '<p>注重用户体验与可维护性，擅长跨团队协作推进交付。</p>',
  links: [],
  sectionLabels: {},
};

const TEMPLATE_PREVIEW_LAYOUT: ResumeLayoutItem[] = [
  { id: 'personal', visible: true, deleted: false },
  { id: 'education', visible: true, deleted: false },
  { id: 'internships', visible: true, deleted: false },
  { id: 'projects', visible: true, deleted: false },
  { id: 'skills', visible: true, deleted: false },
  { id: 'selfEvaluation', visible: true, deleted: false },
  { id: 'awards', visible: false, deleted: true },
  { id: 'languages', visible: false, deleted: true },
  { id: 'campusRoles', visible: false, deleted: true },
  { id: 'links', visible: false, deleted: true },
];

const PREVIEW_AVATAR_IMAGE_URL = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80';

const PREVIEW_CONTENT_HEADER: ResumeContent = {
  ...TEMPLATE_PREVIEW_CONTENT,
  personal: {
    ...TEMPLATE_PREVIEW_CONTENT.personal,
    avatarUrl: PREVIEW_AVATAR_IMAGE_URL,
  },
};

const PREVIEW_CONTENT_SECTION: ResumeContent = {
  ...DEFAULT_RESUME_CONTENT,
  internships: [
    {
      id: 'preview-exp-1',
      companyName: '腾讯科技',
      roleName: '高级产品经理',
      city: '深圳',
      startDate: '2021-07',
      endDate: '2024-03',
      description: '<ul><li>主导核心业务模块线框图设计与 PRD 编写，提升转化率 15%</li><li>协调开发与测试团队，保障版本按时上线，将线上 Bug 率降低至 0.5%</li></ul>',
    },
  ],
  projects: [
    {
      id: 'preview-proj-1',
      projectName: '企业级 SaaS 后台重构',
      roleName: '项目负责人',
      city: '广州',
      startDate: '2023-01',
      endDate: '2023-06',
      description: '<ul><li>从 0 到 1 搭建微前端架构，降低打包体积 40%</li></ul>',
    },
  ],
};

const PREVIEW_CONTENT_SKILL: ResumeContent = {
  ...DEFAULT_RESUME_CONTENT,
  skills: [
    {
      id: 'preview-skill-1',
      category: '前端框架',
      content: '<ul><li>精通 React / Vue，熟悉 Next.js / Nuxt 框架</li><li>熟练掌握 TypeScript，具备复杂业务建模能力</li></ul>',
    },
    {
      id: 'preview-skill-2',
      category: '后端架构',
      content: '<ul><li>熟悉 Node.js / NestJS，能独立开发 RESTful API</li><li>掌握 Webpack / Vite 构建工具配置与性能优化</li></ul>',
    },
    {
      id: 'preview-skill-3',
      category: '通用工具',
      content: '<ul><li>熟练使用 Git、Docker、Figma</li></ul>',
    },
  ],
};

const EMPTY_STATE_TEMPLATE_CONTENT: ResumeContent = {
  ...DEFAULT_RESUME_CONTENT,
  personal: {
    ...DEFAULT_RESUME_CONTENT.personal,
    name: 'Offer 360',
    phone: '138XXXX1234',
    email: 'offer360@163.com',
    expectedRole: '产品经理',
    summary:
      '<p>Offer 360大学 Offer 360专业本科，具备 <strong>2 段产品实习</strong> 与 <strong>1 段体验优化项目</strong> 经历，熟悉需求调研、原型设计、数据复盘、测试协同与版本推进。</p>',
  },
  education: [
    {
      id: 'empty-state-edu-1',
      schoolName: 'Offer 360大学',
      degree: '本科',
      major: 'Offer 360专业',
      logoUrl: '',
      startDate: '2022-09',
      endDate: '2026-06',
      description:
        '<ul><li><strong>专业基础：</strong>系统学习 <strong>用户研究</strong>、<strong>产品规划</strong>、<strong>数据分析</strong>、<strong>项目管理</strong> 等课程，持续训练需求分析与产品表达能力。</li></ul>',
    },
  ],
  internships: [
    {
      id: 'empty-state-exp-1',
      companyName: 'Offer 360',
      roleName: '产品经理实习生',
      city: '',
      startDate: '2026-06',
      endDate: '2026-09',
      description:
        '<ul><li><strong>需求调研：</strong>聚焦 <strong>核心产品用户场景</strong> 开展调研，每周对接 <strong>30+ 终端用户</strong>、<strong>5 个合作渠道</strong>，通过问卷、访谈与场景观察累计沉淀 <strong>80+ 条原始需求</strong>，完成首轮筛查与问题归类。</li><li><strong>需求梳理：</strong>搭建标准化 <strong>产品需求台账</strong>，从用户优先级、开发成本、业务价值 3 个维度对需求分类分级，每周输出 <strong>1 份需求分析报告</strong>，协助团队明确迭代核心清单。</li><li><strong>原型设计：</strong>使用 <strong>Axure</strong> 承接新增功能与体验优化原型，累计完成 <strong>10+ 页原型迭代</strong>，细化交互规则、页面跳转关系与终端适配说明，并同步推进视觉方案落地。</li><li><strong>迭代跟进：</strong>建立每日进度同步机制，持续对接研发解决需求疑问与偏差问题，完整参与 <strong>2 轮产品全周期迭代</strong>，逐项记录并闭环开发问题。</li></ul>',
    },
    {
      id: 'empty-state-exp-2',
      companyName: 'Offer 360',
      roleName: '产品策划实习生',
      city: '',
      startDate: '2025-07',
      endDate: '2025-10',
      description:
        '<ul><li><strong>数据监测：</strong>负责产品日常数据监控，每日统计 <strong>用户活跃</strong>、<strong>页面留存</strong>、<strong>功能点击</strong> 三类核心指标，建立数据台账并及时识别异常波动。</li><li><strong>功能优化：</strong>结合用户反馈与监控数据拆解功能短板，围绕使用痛点梳理优化逻辑与执行路径，累计输出 <strong>12 项功能优化方案</strong>，并跟进内部评审与落地。</li><li><strong>产品测试：</strong>参与上线前全流程测试，覆盖移动端与电脑端主流场景，围绕核心功能、交互逻辑、页面适配完成 <strong>40+ 模块测试</strong>，输出标准化测试报告推动修复。</li><li><strong>文案优化：</strong>负责站内引导、功能说明、弹窗提示等文案迭代，累计完成 <strong>30+ 处文案优化</strong>，持续提升信息表达清晰度与用户理解效率。</li></ul>',
    },
  ],
  projects: [
    {
      id: 'empty-state-project-1',
      projectName: 'Offer 360产品用户体验升级优化项目',
      roleName: '产品实习生',
      city: '',
      startDate: '2026-02',
      endDate: '2026-07',
      description:
        '<p><strong>项目背景：</strong>Offer 360 原有版本存在 <strong>流程繁琐</strong>、<strong>页面层级混乱</strong>、<strong>功能入口隐蔽</strong> 等问题，用户负面反馈较多，核心页面留存持续承压。</p><p><strong>项目目标：</strong>系统梳理体验问题，优化核心页面与核心功能，简化冗余操作路径，统一产品交互逻辑，降低新手用户使用门槛。</p><ul><li><strong>痛点盘点：</strong>复盘近 <strong>3 个月</strong> 的用户反馈、测试记录、数据报表，累计梳理 <strong>68 项体验痛点</strong>，并归类为操作繁琐、视觉杂乱、功能冗余、终端适配 4 类问题。</li><li><strong>方案输出：</strong>围绕体验问题逐条拆解优化思路，细化交互更新逻辑、页面布局调整与执行步骤，输出 <strong>1 份完整优化方案</strong> 与 <strong>4 份专项细则</strong>，顺利通过团队评审。</li><li><strong>协同落地：</strong>联动 <strong>UI、研发、测试</strong> 多角色推进项目执行，持续处理需求偏差、技术适配与进度滞后问题，保障各项优化内容按节奏落地。</li><li><strong>灰度监测：</strong>上线后负责 <strong>灰度流量监测</strong>，分时段统计操作数据、留存数据与报错数据，持续收集用户反馈并及时微调优化细节。</li></ul><p><strong>项目结果：</strong>完成核心页面与重点功能的体验升级，统一交互规范并简化 <strong>30%+</strong> 冗余步骤；上线后核心页面留存提升，用户负面反馈下降 <strong>60%+</strong>。</p>',
    },
  ],
  skills: [],
  awards: [],
  languages: [],
  campusRoles: [],
  selfEvaluation:
    '<ul><li><strong>专业扎实：</strong>具备较完整的 <strong>产品经理基础认知</strong>，熟悉需求调研、需求梳理、原型设计、版本迭代等工作方法，能够独立承接基础产品任务。</li><li><strong>实操丰富：</strong>拥有 <strong>2 段互联网产品实习</strong> 经验，深度参与体验优化、项目推进与日常迭代，擅长结合数据和用户反馈拆解问题。</li><li><strong>擅长协同：</strong>能够高效对接研发、UI、测试等岗位，准确传递需求信息、同步项目进度并推动问题闭环，团队协作意识较强。</li><li><strong>学习高效：</strong>对互联网产品保持敏感度，具备较强的问题拆解与逻辑思辨能力，做事细致、责任心强，能够快速适配岗位节奏。</li></ul>',
  links: [],
  sectionLabels: {
    internships: '实习经历',
    selfEvaluation: '个人评价',
  },
};

const EMPTY_STATE_TEMPLATE_STYLE: ResumeStyleConfig = normalizeResumeStyle({
  ...DEFAULT_RESUME_STYLE,
  fontSize: 11,
  spacingScale: 0.8,
  lineHeight: 18,
  pageMargin: 6,
  sectionSpacing: 16,
  itemSpacing: 16,
  verticalSpacing: {
    ...DEFAULT_RESUME_VERTICAL_SPACING,
    dividerToEntryHeaderPt: 2,
    entryHeaderToBodyPt: 2,
    listItemGapPt: 1,
    bodyTextLineHeightPt: 18,
    paragraphGapPt: 1,
    sectionCardGapPt: 2,
    pagePaddingTopPt: 36,
    pagePaddingBottomPt: 36,
    headerPaddingTopPt: 28,
    headerPaddingBottomPt: 28,
  },
});

const EMPTY_STATE_TEMPLATE_LAYOUT: ResumeLayoutItem[] = [
  { id: 'personal', visible: true, deleted: false },
  { id: 'education', visible: true, deleted: false },
  { id: 'internships', visible: true, deleted: false },
  { id: 'projects', visible: true, deleted: false },
  { id: 'selfEvaluation', visible: true, deleted: false },
  { id: 'awards', visible: false, deleted: true },
  { id: 'skills', visible: false, deleted: true },
  { id: 'languages', visible: false, deleted: true },
  { id: 'campusRoles', visible: false, deleted: true },
  { id: 'links', visible: false, deleted: true },
];

const LOCAL_RESUME_TEMPLATE_CONFIGS: ResumeTemplateConfigRecord[] = Object.values(RESUME_TEMPLATES).map((template) => ({
  id: `local-${template.code}`,
  templateCode: template.code,
  templateName: template.name,
  description: template.description,
  styleJson: normalizeResumeStyle({
    ...DEFAULT_RESUME_STYLE,
    templateCode: template.code,
    themeColor: template.themeColor,
    headerVariant: template.headerVariant,
    basicInfoVariant: template.basicInfoVariant,
    sectionTitleVariant: template.sectionTitleVariant,
    skillVariant: template.skillVariant,
    experienceHeaderVariant: template.experienceHeaderVariant,
    fontSize: template.fontSize,
    spacingScale: template.spacingScaleDefault,
    verticalSpacing: DEFAULT_RESUME_VERTICAL_SPACING,
    lineHeight: template.lineHeight,
    pageMargin: template.pageMargin,
  }),
  createdAt: '',
  updatedAt: '',
}));

function getPreviewContent(previewKind: 'header' | 'basic' | 'section' | 'skill' | 'template'): ResumeContent {
  if (previewKind === 'header' || previewKind === 'basic') {
    return PREVIEW_CONTENT_HEADER;
  }
  if (previewKind === 'section') {
    return PREVIEW_CONTENT_SECTION;
  }
  if (previewKind === 'skill') {
    return PREVIEW_CONTENT_SKILL;
  }
  return TEMPLATE_PREVIEW_CONTENT;
}

function getPreviewLayout(previewKind: 'header' | 'basic' | 'section' | 'skill' | 'template'): ResumeLayoutItem[] {
  if (previewKind === 'header' || previewKind === 'basic') {
    return [
      { id: 'personal', visible: true, deleted: false },
      { id: 'education', visible: true, deleted: false },
    ];
  }
  if (previewKind === 'section') {
    return [
      { id: 'internships', visible: true, deleted: false },
      { id: 'projects', visible: true, deleted: false },
    ];
  }
  if (previewKind === 'skill') {
    return [
      { id: 'skills', visible: true, deleted: false },
    ];
  }
  return TEMPLATE_PREVIEW_LAYOUT;
}

export function ResumeEditorPageClient() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState('');
  const [draftTitle, setDraftTitle] = useState('我的简历');
  const [content, setContent] = useState<ResumeContent>(DEFAULT_RESUME_CONTENT);
  const [styleConfig, setStyleConfig] = useState<ResumeStyleConfig>(sanitizeStyleConfig(DEFAULT_RESUME_STYLE));
  const [layout, setLayout] = useState<ResumeLayoutItem[]>(sanitizeLayoutItems(DEFAULT_RESUME_LAYOUT));
  const [activeSectionId, setActiveSectionId] = useState<SupportedSectionId>('personal');
  const [highlightedSections, setHighlightedSections] = useState<ResumeSectionId[]>([]);
  const [activeToolbarPanel, setActiveToolbarPanel] = useState<ToolbarPanel>(null);
  const [activeStyleTab, setActiveStyleTab] = useState<StylePanelTab>('header');
  const [templateConfigs, setTemplateConfigs] = useState<ResumeTemplateConfigRecord[]>(LOCAL_RESUME_TEMPLATE_CONFIGS);
  const [smartOnePageActive, setSmartOnePageActive] = useState(false);
  const [smartOnePageSnapshot, setSmartOnePageSnapshot] = useState<ResumeStyleConfig | null>(null);
  const [draftListMeta, setDraftListMeta] = useState<{
    limit: number;
    total: number;
    memberRoleCode: ResumeDraftListResponse['memberRoleCode'];
    memberRoleName: string;
  }>({
    limit: 1,
    total: 0,
    memberRoleCode: 'FREE_USER',
    memberRoleName: '普通用户',
  });
  const [draftList, setDraftList] = useState<ResumeDraftRecord[]>([]);
  const [activeDraftManagerOpen, setActiveDraftManagerOpen] = useState(false);
  const [draftDeleteMode, setDraftDeleteMode] = useState(false);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [deletingDrafts, setDeletingDrafts] = useState(false);
  const [draggingSectionId, setDraggingSectionId] = useState<ResumeSectionId | null>(null);
  const [previewMetrics, setPreviewMetrics] = useState<ResumePreviewMetrics | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewFrameHeight, setPreviewFrameHeight] = useState(PREVIEW_BASE_HEIGHT);
  const [activeSectionPage, setActiveSectionPage] = useState(1);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [optimizingEntryKey, setOptimizingEntryKey] = useState<string | null>(null);
  const [optimizingSectionKey, setOptimizingSectionKey] = useState<string | null>(null);
  const [optimizingGlobal, setOptimizingGlobal] = useState(false);
  const [translatingDirection, setTranslatingDirection] = useState<ResumeAiTranslateDirection | null>(null);
  const [professionalOptimizing, setProfessionalOptimizing] = useState(false);
  const [pendingBatchAiAction, setPendingBatchAiAction] = useState<ResumeBatchAiAction | null>(null);
  const [batchAiTask, setBatchAiTask] = useState<ResumeBatchAiTask | null>(null);
  const [openDrawers, setOpenDrawers] = useState<Record<string, boolean>>({});
  const [createLimitPromptOpen, setCreateLimitPromptOpen] = useState(false);
  const [memberAccessMessage, setMemberAccessMessage] = useState('');
  const [entrySuggestions, setEntrySuggestions] = useState<Record<string, ResumeEntrySuggestionState>>({});
  const [authRequiredDialogOpen, setAuthRequiredDialogOpen] = useState(false);
  const [aiUndoState, setAiUndoState] = useState<ResumeAiUndoState | null>(null);
  const suggestionPollTimerRef = useRef<number | null>(null);
  const globalOptimizePollTimerRef = useRef<number | null>(null);
  const batchAiPollTimerRef = useRef<number | null>(null);
  const guestPromptAtRef = useRef(0);
  const isGuestPreview = !token;

  const templateConfigMap = useMemo(
    () => new Map(templateConfigs.map((item) => [item.templateCode, item])),
    [templateConfigs],
  );

  const editorPanelRef = useRef<HTMLDivElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const previewMetricsRef = useRef<ResumePreviewMetrics | null>(null);
  const lastSavedSnapshotRef = useRef('');
  const currentDraftIdRef = useRef('');

  const clearBatchAiPolling = useCallback(() => {
    if (batchAiPollTimerRef.current !== null) {
      window.clearInterval(batchAiPollTimerRef.current);
      batchAiPollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const applyDraftToEditor = useCallback((draft: ResumeDraftRecord, options?: { activeSectionId?: SupportedSectionId; keepAiState?: boolean }) => {
    const nextTitle = draft.title?.trim() || '我的简历';
    const nextContent = normalizeResumeContent(draft.contentJson);
    const nextStyle = sanitizeStyleConfig(normalizeResumeStyle(draft.styleJson));
    const nextLayout = sanitizeLayoutItems(normalizeResumeLayout(draft.layoutJson));

    setDraftId(draft.id);
    setDraftTitle(nextTitle);
    setContent(nextContent);
    setStyleConfig(nextStyle);
    setLayout(nextLayout);
    setLastSavedAt(draft.updatedAt);
    setActiveSectionId(options?.activeSectionId ?? 'personal');
    setHighlightedSections([]);
    setOpenDrawers({});
    setActiveToolbarPanel(null);
    setActiveStyleTab('header');
    setSmartOnePageActive(false);
    setSmartOnePageSnapshot(null);
    if (!options?.keepAiState) {
      setAiUndoState(null);
      setEntrySuggestions({});
    }
    currentDraftIdRef.current = draft.id;
    lastSavedSnapshotRef.current = buildResumeSnapshot(nextTitle, nextContent, nextStyle, nextLayout);
  }, []);

  const openMemberAccessDialog = useCallback((message: string) => {
    setMemberAccessMessage(message);
  }, []);

  const openAuthRequiredDialog = useCallback((message?: string) => {
    if (message) {
      showToast(message);
    }
    setAuthRequiredDialogOpen(true);
  }, []);

  const exitDraftDeleteMode = useCallback(() => {
    setDraftDeleteMode(false);
    setSelectedDraftIds([]);
  }, []);

  const resetEditorToEmptyDraft = useCallback(() => {
    setDraftId('');
    setDraftTitle('我的简历');
    setContent(DEFAULT_RESUME_CONTENT);
    setStyleConfig(sanitizeStyleConfig(DEFAULT_RESUME_STYLE));
    setLayout(sanitizeLayoutItems(DEFAULT_RESUME_LAYOUT));
    setLastSavedAt(null);
    setActiveSectionId('personal');
    setHighlightedSections([]);
    setOpenDrawers({});
    setActiveToolbarPanel(null);
    setActiveStyleTab('header');
    setSmartOnePageActive(false);
    setSmartOnePageSnapshot(null);
    setAiUndoState(null);
    setEntrySuggestions({});
    currentDraftIdRef.current = '';
    lastSavedSnapshotRef.current = buildResumeSnapshot(
      '我的简历',
      DEFAULT_RESUME_CONTENT,
      sanitizeStyleConfig(DEFAULT_RESUME_STYLE),
      sanitizeLayoutItems(DEFAULT_RESUME_LAYOUT),
    );
  }, []);

  const promptGuestLogin = useCallback(
    (message = '登录后即可开始填写、编辑、保存和导出简历。') => {
      const now = Date.now();
      if (now - guestPromptAtRef.current < 300) {
        return;
      }
      guestPromptAtRef.current = now;
      openAuthRequiredDialog(message);
    },
    [openAuthRequiredDialog],
  );

  const handleGuestPreviewBlocked = useCallback(
    (target: EventTarget | null) => {
      if (!isGuestPreview) {
        return false;
      }

      const blockedElement = getGuestPreviewBlockedElement(target);
      if (!blockedElement) {
        return false;
      }

      blockedElement.blur();
      promptGuestLogin();
      return true;
    },
    [isGuestPreview, promptGuestLogin],
  );

  const handleGuestPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!handleGuestPreviewBlocked(event.target)) {
        return;
      }
      event.preventDefault();
    },
    [handleGuestPreviewBlocked],
  );

  const handleGuestFocusCapture = useCallback(
    (event: ReactFocusEvent<HTMLElement>) => {
      if (!handleGuestPreviewBlocked(event.target)) {
        return;
      }
      window.setTimeout(() => {
        if (event.target instanceof HTMLElement) {
          event.target.blur();
        }
      }, 0);
    },
    [handleGuestPreviewBlocked],
  );

  const handleGuestBeforeInputCapture = useCallback(
    (event: ReactFormEvent<HTMLElement>) => {
      if (!handleGuestPreviewBlocked(event.target)) {
        return;
      }
      event.preventDefault();
    },
    [handleGuestPreviewBlocked],
  );

  const canUseGlobalAi = useCallback(() => {
    if (draftListMeta.memberRoleCode === 'FREE_USER') {
      openMemberAccessDialog('全文一键 AI 优化需开通标准会员或超级会员后使用。');
      return false;
    }
    return true;
  }, [draftListMeta.memberRoleCode, openMemberAccessDialog]);

  const canUseEntryAi = useCallback(() => {
    if (draftListMeta.memberRoleCode !== 'SUPER_MEMBER') {
      openMemberAccessDialog(
        draftListMeta.memberRoleCode === 'STANDARD_MEMBER'
          ? '单模块 AI 优化与二次深度优化仅限超级会员使用，请升级后解锁。'
          : 'AI 优化功能需先开通会员后使用；单模块 AI 优化与二次深度优化仅限超级会员。',
      );
      return false;
    }
    return true;
  }, [draftListMeta.memberRoleCode, openMemberAccessDialog]);

  const fetchTemplateConfigs = useCallback(async () => {
    if (!token) {
      setTemplateConfigs(LOCAL_RESUME_TEMPLATE_CONFIGS);
      return LOCAL_RESUME_TEMPLATE_CONFIGS;
    }

    try {
      const response = await clientFetch<ResumeTemplateConfigRecord[]>('/me/resume-drafts/templates', {}, token);
      const normalizedList = response.length
        ? response.map((item) => ({
            ...item,
            styleJson: sanitizeStyleConfig(normalizeResumeStyle(item.styleJson)),
          }))
        : LOCAL_RESUME_TEMPLATE_CONFIGS;
      setTemplateConfigs(normalizedList);
      return normalizedList;
    } catch {
      setTemplateConfigs(LOCAL_RESUME_TEMPLATE_CONFIGS);
      return LOCAL_RESUME_TEMPLATE_CONFIGS;
    }
  }, [token]);

  const applyTemplateStyle = useCallback(
    (templateCode: ResumeTemplateCode | string) => {
      const matched =
        templateConfigMap.get(templateCode as ResumeTemplateCode)
        ?? LOCAL_RESUME_TEMPLATE_CONFIGS.find((item) => item.templateCode === templateCode)
        ?? LOCAL_RESUME_TEMPLATE_CONFIGS[0];

      if (!matched) {
        return;
      }

      setStyleConfig(sanitizeStyleConfig(matched.styleJson));
      setActiveStyleTab('template');
      setSmartOnePageActive(false);
      setSmartOnePageSnapshot(null);
    },
    [templateConfigMap],
  );

  const fetchDraftList = useCallback(async () => {
    if (!token) {
      return null;
    }
    const response = await clientFetch<ResumeDraftListResponse>('/me/resume-drafts', {}, token);
    setDraftList(response.list);
    setSelectedDraftIds((prev) => prev.filter((id) => response.list.some((draft) => draft.id === id)));
    if (response.list.length === 0) {
      setDraftDeleteMode(false);
    }
    setDraftListMeta({
      limit: response.limit,
      total: response.total,
      memberRoleCode: response.memberRoleCode,
      memberRoleName: response.memberRoleName,
    });
    return response;
  }, [token]);

  const loadDraftDetail = useCallback(
    async (id: string) => {
      if (!token) {
        return;
      }
      const detail = await clientFetch<ResumeDraftRecord>(`/me/resume-drafts/${id}`, {}, token);
      applyDraftToEditor(detail);
    },
    [applyDraftToEditor, token],
  );

  const bootstrapDraft = useCallback(async () => {
    setLoading(true);
    setInitError(null);

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const listResponse = await fetchDraftList();
      let targetDraftId = listResponse?.list?.[0]?.id;

      if (!targetDraftId) {
        const created = await clientFetch<ResumeDraftRecord>(
          '/me/resume-drafts',
          {
            method: 'POST',
            body: JSON.stringify({ title: '我的简历' }),
          },
          token,
        );
        targetDraftId = created.id;
      }

      if (targetDraftId) {
        await loadDraftDetail(targetDraftId);
      } else {
        throw new Error('未能获取或创建简历草稿');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '简历初始化失败';
      if (msg.toLowerCase().includes('unauthorized') || msg.includes('401')) {
        logout();
        setAuthRequiredDialogOpen(true);
        return;
      }
      setInitError(msg);
      showToast(msg);
    } finally {
      setLoading(false);
    }
  }, [fetchDraftList, loadDraftDetail, token, logout]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    void bootstrapDraft();
  }, [bootstrapDraft, mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    void fetchTemplateConfigs();
  }, [fetchTemplateConfigs, mounted]);

  useEffect(() => () => {
    if (suggestionPollTimerRef.current !== null) {
      window.clearInterval(suggestionPollTimerRef.current);
    }
    if (globalOptimizePollTimerRef.current !== null) {
      window.clearInterval(globalOptimizePollTimerRef.current);
    }
    clearBatchAiPolling();
  }, [clearBatchAiPolling]);

  const currentSnapshot = useMemo(
    () => buildResumeSnapshot(draftTitle.trim() || '我的简历', content, styleConfig, layout),
    [content, draftTitle, layout, styleConfig],
  );
  const hasUnsavedChanges = currentSnapshot !== lastSavedSnapshotRef.current;
  const shouldUseEmptyStateTemplate = useMemo(
    () => SUPPORTED_SECTION_IDS.every((sectionId) => getSectionFilledCount(sectionId, content) === 0),
    [content],
  );
  const previewContent = shouldUseEmptyStateTemplate ? EMPTY_STATE_TEMPLATE_CONTENT : content;
  const previewLayout = shouldUseEmptyStateTemplate ? EMPTY_STATE_TEMPLATE_LAYOUT : layout;
  const previewStyleConfig = shouldUseEmptyStateTemplate ? EMPTY_STATE_TEMPLATE_STYLE : styleConfig;

  const persistCurrentDraft = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token || !draftId) {
        if (!options?.silent) {
          openAuthRequiredDialog(COMMON_TOAST_COPY.loginRequired);
        }
        return false;
      }

      const normalizedTitle = draftTitle.trim() || '我的简历';
      const nextStyle = sanitizeStyleConfig(styleConfig);
      const nextLayout = sanitizeLayoutItems(layout);
      const nextSnapshot = buildResumeSnapshot(normalizedTitle, content, nextStyle, nextLayout);
      if (nextSnapshot === lastSavedSnapshotRef.current) {
        return true;
      }

      setSaving(true);
      try {
        const updated = await clientFetch<ResumeDraftRecord>(
          `/me/resume-drafts/${draftId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              title: normalizedTitle,
              contentJson: content,
              styleJson: nextStyle,
              layoutJson: nextLayout,
            }),
          },
          token,
        );

        lastSavedSnapshotRef.current = nextSnapshot;
        setDraftTitle(updated.title);
        setStyleConfig(nextStyle);
        setLayout(nextLayout);
        setLastSavedAt(updated.updatedAt);
        if (!options?.silent) {
          showToast(COMMON_TOAST_COPY.saved, 'success');
        }
        return true;
      } catch (error) {
        showToast(error instanceof Error ? error.message : '简历保存失败');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [content, draftId, draftTitle, layout, styleConfig, token, openAuthRequiredDialog],
  );

  const fetchSuggestionList = useCallback(async () => {
    if (!token || !draftId) {
      return false;
    }
    try {
      const response = await clientFetch<ResumeAiSuggestionListResponse>(
        `/me/resume-drafts/${draftId}/ai-suggestions`,
        {},
        token,
      );
      const nextSuggestions = response.suggestions.reduce<Record<string, ResumeEntrySuggestionState>>((acc, item) => {
        const drawerKey = getSuggestionDrawerKey(item.sectionId, item.entryId);
        acc[drawerKey] = {
          suggestions: item.suggestions,
          loading: false,
        };
        return acc;
      }, {});
      const pendingSuggestions = response.pendingTargets.reduce<Record<string, ResumeEntrySuggestionState>>((acc, item) => {
        const drawerKey = getSuggestionDrawerKey(item.sectionId, item.entryId);
        if (!nextSuggestions[drawerKey]) {
          acc[drawerKey] = {
            suggestions: [],
            loading: true,
          };
        }
        return acc;
      }, {});
      setEntrySuggestions((prev) => mergeSuggestionLoadingState(prev, { ...nextSuggestions, ...pendingSuggestions }));
      return response.pendingTargets.length > 0;
    } catch {
      return false;
    }
  }, [draftId, token]);

  const markSuggestionTargetsLoading = useCallback((targets: Array<{ sectionId: ResumeSuggestionTargetSectionId; entryId?: string }>) => {
    setEntrySuggestions((prev) => {
      const next = { ...prev };
      targets.forEach((target) => {
        const drawerKey = getSuggestionDrawerKey(target.sectionId, target.entryId);
        next[drawerKey] = {
          suggestions: [],
          loading: true,
        };
      });
      return next;
    });
  }, []);

  const startSuggestionPolling = useCallback(() => {
    if (suggestionPollTimerRef.current !== null) {
      window.clearInterval(suggestionPollTimerRef.current);
    }
    let attemptCount = 0;
    suggestionPollTimerRef.current = window.setInterval(() => {
      attemptCount += 1;
      void fetchSuggestionList();
      if (attemptCount >= 10 && suggestionPollTimerRef.current !== null) {
        window.clearInterval(suggestionPollTimerRef.current);
        suggestionPollTimerRef.current = null;
        setEntrySuggestions((prev) => clearSuggestionLoadingState(prev));
      }
    }, 1500);
  }, [fetchSuggestionList]);

  useEffect(() => {
    if (!draftId || !token) {
      return;
    }
    void (async () => {
      const hasPendingTargets = await fetchSuggestionList();
      if (hasPendingTargets) {
        startSuggestionPolling();
      }
    })();
  }, [draftId, fetchSuggestionList, startSuggestionPolling, token]);

  const handleUndoAiOptimize = useCallback(async () => {
    if (!aiUndoState) {
      return;
    }
    if (!token || !draftId) {
      openAuthRequiredDialog('登录后才可撤销 AI 优化结果。');
      return;
    }
    applyDraftToEditor(aiUndoState.previousDraft, {
      activeSectionId: aiUndoState.sectionId,
      keepAiState: true,
    });
    const restored = await clientFetch<ResumeDraftRecord>(
      `/me/resume-drafts/${aiUndoState.previousDraft.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          title: aiUndoState.previousDraft.title,
          contentJson: aiUndoState.previousDraft.contentJson,
          styleJson: aiUndoState.previousDraft.styleJson,
          layoutJson: aiUndoState.previousDraft.layoutJson,
        }),
      },
      token,
    );
    applyDraftToEditor(restored, {
      activeSectionId: aiUndoState.sectionId,
      keepAiState: true,
    });
    setAiUndoState(null);
    void fetchSuggestionList();
    startSuggestionPolling();
    showToast(RESUME_TOAST_COPY.smartLayoutReverted, 'success');
  }, [aiUndoState, applyDraftToEditor, draftId, fetchSuggestionList, router, startSuggestionPolling, token]);

  const handleOptimizeEntry = useCallback(
    async (sectionId: ResumeAiOptimizeEntrySectionId, entryId: string, selectedSuggestion?: string) => {
      if (!token || !draftId) {
        openAuthRequiredDialog('登录后才可使用 AI 优化功能。');
        return;
      }
      if (!canUseEntryAi()) {
        return;
      }

      const drawerKey = getDrawerKey(sectionId, entryId);
      if (optimizingEntryKey || optimizingSectionKey || optimizingGlobal) {
        return;
      }

      try {
        setOptimizingEntryKey(drawerKey);
        const saved = await persistCurrentDraft({ silent: true });
        if (!saved) {
          return;
        }
        const previousDraft = await clientFetch<ResumeDraftRecord>(`/me/resume-drafts/${draftId}`, {}, token);

        const response = await clientFetch<ResumeAiOptimizeEntryResponse>(
          `/me/resume-drafts/${draftId}/ai-optimize-entry`,
          {
            method: 'POST',
            body: JSON.stringify({
              sectionId,
              entryId,
              tone: 'professional',
              jobTarget: content.personal.expectedRole.trim(),
              selectedSuggestion,
            }),
          },
          token,
        );

        setAiUndoState({
          scope: 'entry',
          sectionId: sectionId as SupportedSectionId,
          entryId,
          previousDraft,
        });
        applyDraftToEditor(response.updatedDraft, {
          activeSectionId: sectionId as SupportedSectionId,
          keepAiState: true,
        });
        markSuggestionTargetsLoading([{ sectionId, entryId }]);
        void fetchSuggestionList();
        startSuggestionPolling();
        showToast(RESUME_TOAST_COPY.aiOptimizeDone, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : RESUME_TOAST_COPY.aiOptimizeFailed);
      } finally {
        setOptimizingEntryKey(null);
      }
    },
    [
      applyDraftToEditor,
      content.personal.expectedRole,
      draftId,
      canUseEntryAi,
      optimizingEntryKey,
      optimizingGlobal,
      optimizingSectionKey,
      fetchSuggestionList,
      markSuggestionTargetsLoading,
      persistCurrentDraft,
      router,
      startSuggestionPolling,
      token,
    ],
  );

  const handleOptimizeSection = useCallback(
    async (sectionId: ResumeAiOptimizeSectionId, selectedSuggestion?: string) => {
      if (!token || !draftId) {
        openAuthRequiredDialog('登录后才可使用 AI 优化功能。');
        return;
      }

      const drawerKey = getSuggestionDrawerKey(sectionId);
      if (optimizingEntryKey || optimizingSectionKey || optimizingGlobal) {
        return;
      }
      if (!canUseEntryAi()) {
        return;
      }

      try {
        setOptimizingSectionKey(drawerKey);
        const saved = await persistCurrentDraft({ silent: true });
        if (!saved) {
          return;
        }
        const previousDraft = await clientFetch<ResumeDraftRecord>(`/me/resume-drafts/${draftId}`, {}, token);

        const response = await clientFetch<ResumeAiOptimizeSectionResponse>(
          `/me/resume-drafts/${draftId}/ai-optimize-section`,
          {
            method: 'POST',
            body: JSON.stringify({
              sectionId,
              tone: 'professional',
              jobTarget: content.personal.expectedRole.trim(),
              selectedSuggestion,
            }),
          },
          token,
        );

        setAiUndoState({
          scope: 'entry',
          sectionId: sectionId === 'personalSummary' ? 'personal' : sectionId,
          entryId: 'section',
          previousDraft,
        });
        applyDraftToEditor(response.updatedDraft, {
          activeSectionId: sectionId === 'personalSummary' ? 'personal' : sectionId,
          keepAiState: true,
        });
        markSuggestionTargetsLoading([{ sectionId }]);
        void fetchSuggestionList();
        startSuggestionPolling();
        showToast(RESUME_TOAST_COPY.aiOptimizeDone, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : RESUME_TOAST_COPY.aiOptimizeFailed);
      } finally {
        setOptimizingSectionKey(null);
      }
    },
    [
      applyDraftToEditor,
      content.personal.expectedRole,
      draftId,
      canUseEntryAi,
      optimizingEntryKey,
      optimizingGlobal,
      optimizingSectionKey,
      fetchSuggestionList,
      markSuggestionTargetsLoading,
      persistCurrentDraft,
      router,
      startSuggestionPolling,
      token,
    ],
  );

  const handleOptimizeResume = useCallback(async () => {
    if (!token || !draftId) {
      openAuthRequiredDialog('登录后才可发起全文 AI 优化。');
      return;
    }

    if (optimizingEntryKey || optimizingSectionKey || optimizingGlobal || translatingDirection || professionalOptimizing || batchAiTask) {
      return;
    }
    if (!canUseGlobalAi()) {
      return;
    }

    try {
      setOptimizingGlobal(true);
      const saved = await persistCurrentDraft({ silent: true });
      if (!saved) {
        setOptimizingGlobal(false);
        return;
      }

      const response = await clientFetch<ResumeAiOptimizeGlobalSubmitResponse>(
        `/me/resume-drafts/${draftId}/ai-optimize`,
        {
          method: 'POST',
          body: JSON.stringify({
            tone: 'professional',
            jobTarget: content.personal.expectedRole.trim(),
          }),
        },
        token,
      );

      if (globalOptimizePollTimerRef.current !== null) {
        window.clearInterval(globalOptimizePollTimerRef.current);
      }
      setAiUndoState(null);
      showToast(RESUME_TOAST_COPY.aiTaskSubmitted, 'success');
      globalOptimizePollTimerRef.current = window.setInterval(() => {
        void (async () => {
          try {
            const task = await clientFetch<ResumeAiOptimizeGlobalTaskStatusResponse>(
              `/me/resume-drafts/${draftId}/ai-optimize/tasks/${response.taskId}`,
              {},
              token,
            );
            if (task.status === 'processing') {
              return;
            }
            if (globalOptimizePollTimerRef.current !== null) {
              window.clearInterval(globalOptimizePollTimerRef.current);
              globalOptimizePollTimerRef.current = null;
            }
            setOptimizingGlobal(false);
            if (task.status === 'failed') {
              showToast(task.errorMessage || RESUME_TOAST_COPY.aiOptimizeFailed);
              return;
            }
            if (task.updatedDraft) {
              applyDraftToEditor(task.updatedDraft, {
                activeSectionId,
                keepAiState: true,
              });
            }
            if ((task.summary?.updatedFieldCount ?? 0) > 0) {
              showToast(`已完成 ${task.summary?.updatedFieldCount ?? 0} 处内容优化`, 'success');
              return;
            }
            showToast(RESUME_TOAST_COPY.taskNoChange, 'success');
          } catch {
            return;
          }
        })();
      }, Math.max(response.pollingIntervalMs, 1500));
    } catch (error) {
      setOptimizingGlobal(false);
      showToast(error instanceof Error ? error.message : RESUME_TOAST_COPY.aiOptimizeFailed);
    }
  }, [
    activeSectionId,
    applyDraftToEditor,
    canUseGlobalAi,
    content.personal.expectedRole,
    draftId,
    batchAiTask,
    optimizingEntryKey,
    optimizingGlobal,
    optimizingSectionKey,
    professionalOptimizing,
    persistCurrentDraft,
    router,
    token,
    translatingDirection,
  ]);

  const submitBatchAiAction = useCallback(
    async (action: ResumeBatchAiAction) => {
      if (!token || !draftId) {
        openAuthRequiredDialog('登录后才可使用批量 AI 能力。');
        return;
      }

      if (optimizingGlobal || optimizingEntryKey || optimizingSectionKey || translatingDirection || professionalOptimizing || batchAiTask) {
        return;
      }
      if (!canUseEntryAi()) {
        return;
      }

      let submitted = false;
      try {
        if (action.type === 'translate') {
          setTranslatingDirection(action.direction);
        } else {
          setProfessionalOptimizing(true);
        }
        const saved = await persistCurrentDraft({ silent: true });
        if (!saved) {
          return;
        }

        const response =
          action.type === 'translate'
            ? await clientFetch<ResumeAiTranslateSubmitResponse>(
                `/me/resume-drafts/${draftId}/ai-translate`,
                {
                  method: 'POST',
                  body: JSON.stringify({
                    direction: action.direction,
                    jobTarget: content.personal.expectedRole.trim(),
                  }),
                },
                token,
              )
            : await clientFetch<ResumeAiProfessionalOptimizeSubmitResponse>(
                `/me/resume-drafts/${draftId}/ai-professional-optimize`,
                {
                  method: 'POST',
                  body: JSON.stringify({
                    tone: 'professional',
                    jobTarget: content.personal.expectedRole.trim(),
                  }),
                },
                token,
              );

        submitted = true;
        setBatchAiTask({
          taskId: response.taskId,
          resumeId: response.resumeId,
          sourceResumeId: response.sourceResumeId,
          optimizeType: response.optimizeType,
          pollingIntervalMs: response.pollingIntervalMs,
        });
        setActiveToolbarPanel(null);
        await fetchDraftList();
        showToast(
          action.type === 'translate'
            ? action.direction === 'zh-to-en'
              ? '英文简历副本已创建，翻译任务正在后台执行'
              : '中文简历副本已创建，翻译任务正在后台执行'
            : '专业术语优化副本已创建，后台任务已开始执行',
          'success',
        );
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'AI 任务提交失败，请稍后重试');
      } finally {
        if (!submitted) {
          setTranslatingDirection(null);
          setProfessionalOptimizing(false);
        }
      }
    },
    [
      canUseEntryAi,
      content.personal.expectedRole,
      draftId,
      fetchDraftList,
      optimizingEntryKey,
      optimizingGlobal,
      optimizingSectionKey,
      professionalOptimizing,
      persistCurrentDraft,
      router,
      token,
      translatingDirection,
      batchAiTask,
    ],
  );

  const handleTranslateResume = useCallback((direction: ResumeAiTranslateDirection) => {
    setPendingBatchAiAction({ type: 'translate', direction });
  }, []);

  const handleProfessionalOptimizeResume = useCallback(() => {
    setPendingBatchAiAction({ type: 'professional' });
  }, []);

  const updateSectionLabel = useCallback((sectionId: ResumeSectionId, value: string) => {
    if (sectionId === 'personal') {
      return;
    }
    const normalizedValue = value.trim();
    setContent((prev) => ({
      ...prev,
      sectionLabels: normalizedValue
        ? { ...prev.sectionLabels, [sectionId]: normalizedValue }
        : Object.fromEntries(Object.entries(prev.sectionLabels).filter(([key]) => key !== sectionId)),
    }));
  }, []);

  useEffect(() => {
    if (!batchAiTask || !token) {
      return;
    }

    const pollTask = async () => {
      try {
        const endpoint =
          batchAiTask.optimizeType === 'translate'
            ? `/me/resume-drafts/${batchAiTask.resumeId}/ai-translate/tasks/${batchAiTask.taskId}`
            : `/me/resume-drafts/${batchAiTask.resumeId}/ai-professional-optimize/tasks/${batchAiTask.taskId}`;
        const task = await clientFetch<ResumeAiOptimizeGlobalTaskStatusResponse>(endpoint, {}, token);
        if (task.status === 'processing') {
          return;
        }

        clearBatchAiPolling();
        setBatchAiTask(null);
        setTranslatingDirection(null);
        setProfessionalOptimizing(false);
        await fetchDraftList();

        if (task.status === 'failed') {
          showToast(task.errorMessage || '后台任务执行失败，请稍后重试');
          return;
        }

        if (task.updatedDraft && currentDraftIdRef.current === batchAiTask.sourceResumeId) {
          applyDraftToEditor(task.updatedDraft, {
            activeSectionId,
            keepAiState: true,
          });
        }

        const updatedCount = task.summary?.updatedFieldCount ?? 0;
        const actionLabel = batchAiTask.optimizeType === 'translate' ? '翻译' : '专业术语优化';
        showToast(updatedCount > 0 ? `${actionLabel}已完成，已更新 ${updatedCount} 处内容` : RESUME_TOAST_COPY.taskNoChange);
      } catch {
        return;
      }
    };

    void pollTask();
    clearBatchAiPolling();
    batchAiPollTimerRef.current = window.setInterval(() => {
      void pollTask();
    }, Math.max(batchAiTask.pollingIntervalMs, 1500));

    return clearBatchAiPolling;
  }, [activeSectionId, applyDraftToEditor, batchAiTask, clearBatchAiPolling, fetchDraftList, token]);

  useEffect(() => {
    if (!draftId || !token || !mounted || !hasUnsavedChanges) {
      return;
    }
    const timer = window.setTimeout(() => {
      void persistCurrentDraft({ silent: true });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [draftId, hasUnsavedChanges, mounted, persistCurrentDraft, token]);

  const measurePreview = useCallback(() => {
    const viewport = previewViewportRef.current;
    const host = previewHostRef.current;
    const pageElement = host?.querySelector('[data-resume-page-frame]') as HTMLElement | null;

    if (!viewport || !host || !pageElement) {
      return;
    }

    const baseWidth = pageElement.offsetWidth || PREVIEW_BASE_WIDTH;
    const nextScale = Math.min(Math.max((viewport.clientWidth - 24) / baseWidth, 0.35), 1);
    setPreviewScale(nextScale);
    setPreviewFrameHeight(Math.max(host.offsetHeight * nextScale, PREVIEW_BASE_HEIGHT * nextScale));
  }, []);

  const handlePreviewMetricsChange = useCallback((metrics: ResumePreviewMetrics) => {
    previewMetricsRef.current = metrics;
    setPreviewMetrics(metrics);
  }, []);

  useEffect(() => {
    const run = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          measurePreview();
        });
      });
    };

    run();
    const fontSet = (document as Document & { fonts?: FontFaceSet }).fonts;
    fontSet?.ready.then(() => run()).catch(() => undefined);
  }, [currentSnapshot, measurePreview, previewMetrics?.pageCount]);

  useEffect(() => {
    const viewport = previewViewportRef.current;
    const host = previewHostRef.current;
    if ((!viewport && !host) || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => measurePreview());
    if (viewport) {
      observer.observe(viewport);
    }
    if (host) {
      observer.observe(host);
    }
    return () => observer.disconnect();
  }, [measurePreview, previewMetrics?.pageCount]);

  useEffect(() => {
    const viewport = previewViewportRef.current;
    const host = previewHostRef.current;
    const pageElement = host?.querySelector(`[data-resume-page-index="${activeSectionPage}"]`) as HTMLElement | null;
    if (!viewport || !pageElement) {
      return;
    }

    viewport.scrollTo({
      top: pageElement.offsetTop * previewScale,
      behavior: 'smooth',
    });
  }, [activeSectionPage, previewScale]);

  const moduleSections = useMemo(
    () => layout.filter((item) => SUPPORTED_SECTION_SET.has(item.id)),
    [layout],
  );
  const visibleModuleSections = useMemo(() => moduleSections.filter((item) => item.visible && !item.deleted), [moduleSections]);
  const safeThemeColor = useMemo(() => normalizeThemeColor(styleConfig.themeColor), [styleConfig.themeColor]);
  const fontFamilyLabel = RESUME_FONT_OPTIONS.find((item) => item.value === styleConfig.fontFamily)?.label ?? '字体';
  const themeLabel = THEME_OPTIONS.find((item) => item.value === safeThemeColor)?.label ?? '自定义颜色';
  const activeSectionSummary = getSectionDataSummary(activeSectionId, content);
  const effectiveOverflow = (previewMetrics?.overflowHeight ?? 0) > 0;
  const previewPageCount = Math.max(previewMetrics?.pageCount ?? 1, 1);
  const currentPaperBackground = PAPER_BACKGROUND_OPTIONS.find((item) => item.value === styleConfig.paperBackgroundVariant)?.label ?? '纸张';
  const batchAiBusy =
    optimizingGlobal
    || Boolean(optimizingEntryKey)
    || Boolean(optimizingSectionKey)
    || Boolean(translatingDirection)
    || professionalOptimizing
    || Boolean(batchAiTask);

  const jumpToSection = useCallback((sectionId: ResumeSectionId) => {
    if (!SUPPORTED_SECTION_SET.has(sectionId)) {
      return;
    }
    setActiveSectionId(sectionId as SupportedSectionId);
    editorPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const isDrawerOpen = useCallback((drawerKey: string) => openDrawers[drawerKey] ?? true, [openDrawers]);

  const toggleDrawer = useCallback((drawerKey: string) => {
    setOpenDrawers((prev) => ({ ...prev, [drawerKey]: !(prev[drawerKey] ?? true) }));
  }, []);

  const openOnlyDrawer = useCallback((sectionId: ResumeSectionId, drawerKey: string) => {
    setOpenDrawers((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${sectionId}:`)) {
          next[key] = false;
        }
      });
      next[drawerKey] = true;
      return next;
    });
  }, []);

  const handleSaveDrawer = useCallback(
    async (drawerKey: string) => {
      const okay = await persistCurrentDraft();
      if (okay) {
        setOpenDrawers((prev) => ({ ...prev, [drawerKey]: false }));
        const suggestionTarget = getSuggestionTargetFromDrawerKey(drawerKey);
        if (suggestionTarget) {
          markSuggestionTargetsLoading([suggestionTarget]);
        }
        void fetchSuggestionList();
        startSuggestionPolling();
      }
    },
    [fetchSuggestionList, markSuggestionTargetsLoading, persistCurrentDraft, startSuggestionPolling],
  );

  const updatePersonalField = useCallback((field: keyof ResumeContent['personal'], value: string) => {
    setContent((prev) => ({
      ...prev,
      personal: {
        ...prev.personal,
        [field]: value,
      },
    }));
  }, []);

  const toggleToolbarPanel = useCallback((panel: Exclude<ToolbarPanel, null>) => {
    setActiveToolbarPanel((prev) => (prev === panel ? null : panel));
  }, []);

  const ensureSectionDraftContent = useCallback((sectionId: ResumeSectionId) => {
    setContent((prev) => {
      switch (sectionId) {
        case 'awards':
          return prev.awards.length ? prev : { ...prev, awards: [createEmptyAwardEntry()] };
        case 'languages':
          return prev.languages.length ? prev : { ...prev, languages: [createEmptyLanguageEntry()] };
        case 'campusRoles':
          return prev.campusRoles.length ? prev : { ...prev, campusRoles: [createEmptyCampusRoleEntry()] };
        case 'links':
          return prev.links.length ? prev : { ...prev, links: [createEmptyLinkEntry()] };
        default:
          return prev;
      }
    });
  }, []);

  const updateLayoutItem = useCallback(
    (sectionId: ResumeSectionId, updates: Partial<ResumeLayoutItem>) => {
      setLayout((prev) => sanitizeLayoutItems(prev.map((item) => (item.id === sectionId ? { ...item, ...updates } : item))));
      if ((updates.deleted || updates.visible === false) && activeSectionId === sectionId) {
        setActiveSectionId('personal');
      }
      if (updates.visible && !updates.deleted) {
        ensureSectionDraftContent(sectionId);
      }
    },
    [activeSectionId, ensureSectionDraftContent],
  );

  const moveLayoutItem = useCallback((sectionId: ResumeSectionId, direction: -1 | 1) => {
    setLayout((prev) => {
      if (sectionId === 'personal') {
        return prev;
      }
      const activeIds = prev.filter((item) => item.visible && !item.deleted).map((item) => item.id);
      const currentIndex = activeIds.findIndex((id) => id === sectionId);
      const targetId = activeIds[currentIndex + direction];
      if (currentIndex < 0 || !targetId || targetId === 'personal') {
        return prev;
      }

      const next = [...prev];
      const fromIndex = next.findIndex((item) => item.id === sectionId);
      const toIndex = next.findIndex((item) => item.id === targetId);
      if (fromIndex < 0 || toIndex < 0) {
        return prev;
      }
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return sanitizeLayoutItems(next);
    });
  }, []);

  const reorderLayoutItem = useCallback((fromId: ResumeSectionId, toId: ResumeSectionId, position: 'before' | 'after' = 'before') => {
    if (fromId === toId || fromId === 'personal' || toId === 'personal') {
      return;
    }
    setLayout((prev) => {
      const next = [...prev];
      const fromIndex = next.findIndex((item) => item.id === fromId);
      const toIndex = next.findIndex((item) => item.id === toId);
      if (fromIndex < 0 || toIndex < 0) {
        return prev;
      }
      const [moved] = next.splice(fromIndex, 1);
      const adjustedToIndex = next.findIndex((item) => item.id === toId);
      if (adjustedToIndex < 0) {
        return prev;
      }
      next.splice(position === 'after' ? adjustedToIndex + 1 : adjustedToIndex, 0, moved);
      return sanitizeLayoutItems(next);
    });
  }, []);

  const restoreLayoutItem = useCallback(
    (sectionId: ResumeSectionId) => {
      setLayout((prev) => sanitizeLayoutItems(prev.map((item) => (item.id === sectionId ? { ...item, visible: true, deleted: false } : item))));
      ensureSectionDraftContent(sectionId);
      if (SUPPORTED_SECTION_SET.has(sectionId)) {
        setActiveSectionId(sectionId as SupportedSectionId);
      }
    },
    [ensureSectionDraftContent],
  );

  const createNewDraft = useCallback(async () => {
    if (!token) {
      openAuthRequiredDialog('登录后才可新建简历草稿。');
      return;
    }
    if (creatingDraft) {
      return;
    }

    if (draftList.length >= draftListMeta.limit) {
      if (draftListMeta.memberRoleCode !== 'SUPER_MEMBER') {
        setCreateLimitPromptOpen(true);
      } else {
        showToast(DRAFT_COUNT_COPY[draftListMeta.memberRoleCode].upgradeHint);
      }
      return;
    }

    setCreatingDraft(true);
    try {
      const created = await clientFetch<ResumeDraftRecord>(
        '/me/resume-drafts',
        {
          method: 'POST',
          body: JSON.stringify({
            title: draftList.length === 0 ? '我的简历' : `我的简历 ${draftList.length + 1}`,
          }),
        },
        token,
      );
      await fetchDraftList();
      await loadDraftDetail(created.id);
      exitDraftDeleteMode();
      setActiveDraftManagerOpen(false);
      showToast(RESUME_TOAST_COPY.draftCreated, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '新建简历失败');
    } finally {
      setCreatingDraft(false);
    }
  }, [creatingDraft, draftList.length, draftListMeta.limit, draftListMeta.memberRoleCode, exitDraftDeleteMode, fetchDraftList, loadDraftDetail, openAuthRequiredDialog, token]);

  const switchDraft = useCallback(
    async (id: string) => {
      if (!token) {
        openAuthRequiredDialog('登录后才可切换和管理简历草稿。');
        return;
      }
      if (id === draftId) {
        setActiveDraftManagerOpen(false);
        return;
      }
      const saved = await persistCurrentDraft({ silent: true });
      if (!saved) {
        return;
      }
      await loadDraftDetail(id);
      setActiveDraftManagerOpen(false);
    },
    [draftId, loadDraftDetail, openAuthRequiredDialog, persistCurrentDraft, token],
  );

  const toggleDraftSelection = useCallback((id: string) => {
    setSelectedDraftIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const handleDraftDeleteAction = useCallback(async () => {
    if (!token) {
      openAuthRequiredDialog('登录后才可删除简历草稿。');
      return;
    }

    if (!draftDeleteMode) {
      setDraftDeleteMode(true);
      setSelectedDraftIds([]);
      return;
    }

    if (selectedDraftIds.length === 0) {
      showToast('请先勾选要删除的简历');
      return;
    }

    const confirmed = window.confirm(
      selectedDraftIds.length === 1
        ? '确认删除选中的简历吗？删除后不可恢复。'
        : `确认删除选中的 ${selectedDraftIds.length} 份简历吗？删除后不可恢复。`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingDrafts(true);
    try {
      await Promise.all(
        selectedDraftIds.map((id) =>
          clientFetch(`/me/resume-drafts/${id}`, { method: 'DELETE' }, token),
        ),
      );

      const remainingResponse = await fetchDraftList();
      const remainingDrafts = remainingResponse?.list ?? [];
      const activeDraftDeleted = selectedDraftIds.includes(draftId);

      if (remainingDrafts.length === 0) {
        resetEditorToEmptyDraft();
      } else if (activeDraftDeleted || !remainingDrafts.some((item) => item.id === draftId)) {
        await loadDraftDetail(remainingDrafts[0].id);
      }

      exitDraftDeleteMode();
      showToast(selectedDraftIds.length === 1 ? '简历删除成功' : `已删除 ${selectedDraftIds.length} 份简历`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '删除简历失败');
    } finally {
      setDeletingDrafts(false);
    }
  }, [
    draftDeleteMode,
    draftId,
    exitDraftDeleteMode,
    fetchDraftList,
    loadDraftDetail,
    openAuthRequiredDialog,
    resetEditorToEmptyDraft,
    selectedDraftIds,
    token,
  ]);

  const handleSmartSort = useCallback(() => {
    const incompleteSections: ResumeSectionId[] = [];
    if (hasIncompleteDates(content.education)) incompleteSections.push('education');
    if (hasIncompleteDates(content.internships)) incompleteSections.push('internships');
    if (hasIncompleteDates(content.projects)) incompleteSections.push('projects');

    if (incompleteSections.length) {
      setHighlightedSections(incompleteSections);
      jumpToSection(incompleteSections[0]);
      showToast('请补全时间后再进行自动排序');
      return;
    }

    setHighlightedSections([]);
    setContent((prev) => sortResumeContentByStartDate(prev));
    showToast(RESUME_TOAST_COPY.smartSortDone);
  }, [content.education, content.internships, content.projects, jumpToSection]);

  const handleSmartLayout = useCallback(async () => {
    if (smartOnePageActive && smartOnePageSnapshot) {
      setStyleConfig(smartOnePageSnapshot);
      setSmartOnePageActive(false);
      setSmartOnePageSnapshot(null);
      showToast(RESUME_TOAST_COPY.smartLayoutReverted);
      return;
    }

    setSmartOnePageSnapshot(styleConfig);
    if (!previewMetricsRef.current?.overflowHeight) {
      const compactStyle = {
        ...styleConfig,
        fontSize: Math.max(styleConfig.fontSize - 0.5, AUTO_FIT_LIMITS.fontSize),
        spacingScale: Math.max(Number((styleConfig.spacingScale - 0.05).toFixed(2)), AUTO_FIT_LIMITS.spacingScale),
        pageMargin: Math.max(styleConfig.pageMargin - 1, AUTO_FIT_LIMITS.pageMargin),
      };
      setStyleConfig(sanitizeStyleConfig(compactStyle));
      setSmartOnePageActive(true);
      showToast(RESUME_TOAST_COPY.smartLayoutDone);
      return;
    }

    let nextStyle = styleConfig;
    let attempts = 0;
    while ((previewMetricsRef.current?.overflowHeight ?? 0) > 0 && attempts < 40) {
      const adjusted = shrinkStyle(nextStyle);
      if (isSameStyle(adjusted, nextStyle)) {
        break;
      }
      nextStyle = adjusted;
      setStyleConfig(adjusted);
      attempts += 1;
      await waitForDomPaint();
      measurePreview();
    }

    if ((previewMetricsRef.current?.overflowHeight ?? 0) > 0) {
      setSmartOnePageSnapshot(null);
      showToast('内容仍超出单页，建议优先精简较长描述');
      return;
    }

    setSmartOnePageActive(true);
    showToast(RESUME_TOAST_COPY.smartLayoutDone);
  }, [measurePreview, smartOnePageActive, smartOnePageSnapshot, styleConfig]);

  const handleExportPdf = useCallback(async () => {
    if (exportingPdf) {
      return;
    }

    if (!token || !draftId) {
      openAuthRequiredDialog('登录后才可导出简历。');
      return;
    }

    setExportingPdf(true);
    showToast(RESUME_TOAST_COPY.pdfGenerating);

    try {
      const saved = await persistCurrentDraft({ silent: true });
      if (!saved) {
        return;
      }

      const payload = await clientFetch<ResumeFileDownloadPayload>(
        `/me/resume-drafts/${draftId}/export-pdf`,
        {
          method: 'POST',
        },
        token,
      );
      downloadFilePayload(payload);
      showToast(RESUME_TOAST_COPY.pdfDownloadStarted, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'PDF 导出失败');
    } finally {
      setExportingPdf(false);
    }
  }, [draftId, exportingPdf, persistCurrentDraft, token, router]);

  const renderToolbarPanel = (panel: Exclude<ToolbarPanel, null>, anchorRef: RefObject<HTMLDivElement>) =>
    activeToolbarPanel === panel ? (
      <ResumeToolbarPanel
        anchorRef={anchorRef}
        panel={panel}
        activeStyleTab={activeStyleTab}
        setActiveStyleTab={setActiveStyleTab}
        styleConfig={styleConfig}
        setStyleConfig={setStyleConfig}
        templateConfigs={templateConfigs}
        layout={layout}
        moduleSections={moduleSections}
        activeSectionId={activeSectionId}
        onClose={() => setActiveToolbarPanel(null)}
        onJumpToSection={jumpToSection}
        onMoveLayoutItem={moveLayoutItem}
        onReorderLayoutItem={reorderLayoutItem}
        draggingSectionId={draggingSectionId}
        setDraggingSectionId={setDraggingSectionId}
        onRestoreLayoutItem={restoreLayoutItem}
        onUpdateLayoutItem={updateLayoutItem}
        onApplyTemplate={applyTemplateStyle}
        onExportPdf={() => void handleExportPdf()}
        setMemberAccessMessage={setMemberAccessMessage}
        sectionLabels={content.sectionLabels}
        onUpdateSectionLabel={updateSectionLabel}
        onTranslateResume={handleTranslateResume}
        onProfessionalOptimizeResume={handleProfessionalOptimizeResume}
        translatingDirection={translatingDirection}
        professionalOptimizing={professionalOptimizing}
        batchAiBusy={batchAiBusy}
      />
    ) : null;

  if (!mounted) {
    return (
      <main className="flex h-[calc(100vh-56px)] items-center justify-center bg-[#EEEEEE] px-4 py-6">
        <div className="flex min-h-[240px] w-full max-w-[680px] items-center justify-center rounded-[16px] border border-[#E5E6EB] bg-white text-sm text-slate-500 shadow-sm">
          正在初始化编辑器...
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex h-[calc(100vh-56px)] items-center justify-center bg-[#EEEEEE] px-4 py-6">
        <div className="flex min-h-[240px] w-full max-w-[680px] flex-col items-center justify-center gap-3 rounded-[16px] border border-[#E5E6EB] bg-white text-center shadow-sm">
          <LoaderCircle className="h-6 w-6 animate-spin text-brand" />
          <div>
            <p className="text-base font-semibold text-slate-900">简历编辑器加载中 [v1.0.2]</p>
            <p className="mt-2 text-sm text-slate-500">正在同步你的简历草稿与版式配置。</p>
          </div>
        </div>
      </main>
    );
  }

  if (initError) {
    return (
      <main className="flex h-[calc(100vh-56px)] items-center justify-center bg-[#EEEEEE] px-4 py-6">
        <div className="flex min-h-[280px] w-full max-w-[680px] flex-col items-center justify-center gap-4 rounded-[16px] border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
            <X className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">加载简历失败</h2>
            <p className="mt-2 text-sm text-slate-500">{initError}</p>
          </div>
          <button
            type="button"
            onClick={() => void bootstrapDraft()}
            className="mt-2 rounded-full bg-brand px-6 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            重试一次
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="bg-[#EEF1F5] text-slate-900">
      <main
        className="h-[calc(100vh-56px)] overflow-hidden"
        onPointerDownCapture={handleGuestPointerDownCapture}
        onFocusCapture={handleGuestFocusCapture}
        onBeforeInputCapture={handleGuestBeforeInputCapture}
      >
        <section className="relative flex h-full flex-col overflow-hidden bg-[#EEF1F5]">
        <header className="relative z-30 h-[58px] shrink-0 border-b border-[#D8DEE8] bg-white px-4 shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
          <div className="flex h-full min-w-0 items-center gap-3">
            <button
              type="button"
              data-allow-guest="true"
              onClick={() => router.push('/')}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-[#F2F5F9] hover:text-slate-900"
              aria-label="返回主页"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Input
              value={draftTitle}
              maxLength={120}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="请输入简历标题"
              className="h-9 w-[190px] shrink-0 border-transparent bg-transparent px-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#D8DEE8] focus:ring-[#D8DEE8]/20"
            />
            {isGuestPreview ? (
              <div className="hidden shrink-0 rounded-full bg-brand/8 px-3 py-1 text-xs font-medium text-brand lg:inline-flex">
                未登录预览模式：可浏览页面，填写与生成前需先登录
              </div>
            ) : (
              <div className="hidden shrink-0 items-center gap-1.5 text-xs text-slate-500 lg:inline-flex">
                <Save className={cn('h-3.5 w-3.5', saving && 'animate-pulse text-[#FF734A]', hasUnsavedChanges && !saving && 'text-[#FF734A]')} />
                <span>{saving ? '保存中' : hasUnsavedChanges ? '待同步' : lastSavedAt ? `已保存 ${formatDate(lastSavedAt)}` : '未保存'}</span>
              </div>
            )}

            <div className="ml-auto min-w-0 pb-1 pt-1">
              <div className="flex min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap pr-1">
                <ToolbarDropdownAnchor panel={activeToolbarPanel} name="smart-layout">
                  {() => <DarkToolbarButton active={smartOnePageActive} label="智能一页" onClick={() => void handleSmartLayout()} light />}
                </ToolbarDropdownAnchor>
                <button
                  type="button"
                  onClick={handleSmartSort}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-[#F1D6B5] bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
                >
                  智能排序
                </button>
                <ToolbarDropdownAnchor panel={activeToolbarPanel} name="font">
                  {(anchorRef) => (
                    <>
                      <DarkToolbarButton label={fontFamilyLabel} active={activeToolbarPanel === 'font'} onClick={() => toggleToolbarPanel('font')} light />
                      {renderToolbarPanel('font', anchorRef)}
                    </>
                  )}
                </ToolbarDropdownAnchor>
                <ToolbarDropdownAnchor panel={activeToolbarPanel} name="fontSize">
                  {(anchorRef) => (
                    <>
                      <DarkToolbarButton label={String(styleConfig.fontSize)} active={activeToolbarPanel === 'fontSize'} onClick={() => toggleToolbarPanel('fontSize')} light />
                      {renderToolbarPanel('fontSize', anchorRef)}
                    </>
                  )}
                </ToolbarDropdownAnchor>
                <ToolbarDropdownAnchor panel={activeToolbarPanel} name="spacingScale">
                  {(anchorRef) => (
                    <>
                      <DarkToolbarButton
                        icon={<LineSpacingIcon className="h-4 w-4" />}
                        active={activeToolbarPanel === 'spacingScale'}
                        tooltip={`整体疏密 ${styleConfig.spacingScale.toFixed(2)}`}
                        onClick={() => toggleToolbarPanel('spacingScale')}
                        light
                      />
                      {renderToolbarPanel('spacingScale', anchorRef)}
                    </>
                  )}
                </ToolbarDropdownAnchor>
                <ToolbarDropdownAnchor panel={activeToolbarPanel} name="pageMargin">
                  {(anchorRef) => (
                    <>
                      <DarkToolbarButton icon={<PageMarginIcon className="h-4 w-4" />} active={activeToolbarPanel === 'pageMargin'} tooltip={`页边距 ${styleConfig.pageMargin}mm`} onClick={() => toggleToolbarPanel('pageMargin')} light />
                      {renderToolbarPanel('pageMargin', anchorRef)}
                    </>
                  )}
                </ToolbarDropdownAnchor>
                <ToolbarDropdownAnchor panel={activeToolbarPanel} name="theme">
                  {(anchorRef) => (
                    <>
                      <DarkToolbarButton colorPreview={safeThemeColor} active={activeToolbarPanel === 'theme'} tooltip={`${themeLabel} / ${currentPaperBackground}`} onClick={() => toggleToolbarPanel('theme')} light />
                      {renderToolbarPanel('theme', anchorRef)}
                    </>
                  )}
                </ToolbarDropdownAnchor>
                <ToolbarDropdownAnchor panel={activeToolbarPanel} name="textFormat">
                  {(anchorRef) => (
                    <>
                      <DarkToolbarButton icon={<Type className="h-4 w-4" />} label="标题格式" active={activeToolbarPanel === 'textFormat'} onClick={() => toggleToolbarPanel('textFormat')} light />
                      {renderToolbarPanel('textFormat', anchorRef)}
                    </>
                  )}
                </ToolbarDropdownAnchor>
                <ToolbarDropdownAnchor panel={activeToolbarPanel} name="templateStyle">
                  {(anchorRef) => (
                    <>
                      <DarkToolbarButton label="模板样式" active={activeToolbarPanel === 'templateStyle'} onClick={() => toggleToolbarPanel('templateStyle')} light />
                      {renderToolbarPanel('templateStyle', anchorRef)}
                    </>
                  )}
                </ToolbarDropdownAnchor>
                <ToolbarDropdownAnchor panel={activeToolbarPanel} name="moduleManager">
                  {(anchorRef) => (
                    <>
                      <DarkToolbarButton label="模块管理" active={activeToolbarPanel === 'moduleManager'} onClick={() => toggleToolbarPanel('moduleManager')} light />
                      {renderToolbarPanel('moduleManager', anchorRef)}
                    </>
                  )}
                </ToolbarDropdownAnchor>
                <ToolbarDropdownAnchor panel={activeToolbarPanel} name="translate">
                  {(anchorRef) => (
                    <>
                      <DarkToolbarButton label="翻译" active={activeToolbarPanel === 'translate'} onClick={() => toggleToolbarPanel('translate')} pill light />
                      {renderToolbarPanel('translate', anchorRef)}
                    </>
                  )}
                </ToolbarDropdownAnchor>
                <button
                  type="button"
                  onClick={() => void handleExportPdf()}
                  disabled={exportingPdf}
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-brand px-6 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,128,2,0.24)] transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {exportingPdf ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {exportingPdf ? '下载中...' : '下载'}
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="w-[120px] shrink-0 border-r border-[#D8DEE8] bg-[#F8FAFC] py-4">
            <div className="space-y-2 px-2.5">
              <button
                type="button"
                onClick={() =>
                  setActiveDraftManagerOpen((prev) => {
                    if (prev) {
                      exitDraftDeleteMode();
                    }
                    return !prev;
                  })
                }
                className={cn(
                  'mb-3 flex h-[76px] w-full flex-col items-center justify-center gap-1 rounded-xl border text-[11px] transition',
                  activeDraftManagerOpen
                    ? 'border-brand bg-brand/10 text-brand shadow-[0_8px_24px_rgba(255,128,2,0.16)]'
                    : 'border-transparent bg-white text-slate-600 hover:border-brand/40 hover:text-slate-900',
                )}
              >
                <Wand2 className="h-4 w-4" />
                <span>我的简历</span>
                <span className="text-[10px] text-slate-400">{draftListMeta.total}/{draftListMeta.limit}</span>
              </button>
              {activeDraftManagerOpen ? (
                <div className="mb-3 rounded-2xl border border-[#D8DEE8] bg-white p-2.5 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
                  <p className="px-2 pb-2 text-[11px] font-medium text-slate-500">
                    当前账号最多可管理 {draftListMeta.limit} 份简历
                  </p>
                  <div className="space-y-1">
                    {draftList.map((draft) => (
                      <button
                        key={draft.id}
                        type="button"
                        onClick={() => {
                          if (draftDeleteMode) {
                            toggleDraftSelection(draft.id);
                            return;
                          }
                          void switchDraft(draft.id);
                        }}
                        className={cn(
                          'w-full rounded-xl px-2.5 py-2 text-left text-[11px] transition',
                          draftDeleteMode
                            ? selectedDraftIds.includes(draft.id)
                              ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                              : 'text-slate-600 hover:bg-[#F5F7FA] hover:text-slate-900'
                            : draft.id === draftId
                              ? 'bg-brand/10 text-brand ring-1 ring-brand/30'
                              : 'text-slate-600 hover:bg-[#F5F7FA] hover:text-slate-900',
                        )}
                      >
                        <span className="flex items-start gap-2">
                          {draftDeleteMode ? (
                            <span
                              className={cn(
                                'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[10px] font-semibold',
                                selectedDraftIds.includes(draft.id)
                                  ? 'border-rose-500 bg-rose-500 text-white'
                                  : 'border-slate-300 bg-white text-transparent',
                              )}
                            >
                              ✓
                            </span>
                          ) : null}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{draft.title || '未命名简历'}</span>
                            <span className="mt-1 block text-[10px] text-slate-400">{formatDate(draft.updatedAt)}</span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDraftDeleteAction()}
                    disabled={deletingDrafts}
                    data-resume-guest-block="true"
                    className={cn(
                      'mt-2 flex h-9 w-full items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-70',
                      draftDeleteMode
                        ? 'bg-rose-500 text-white hover:bg-rose-600'
                        : 'border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100',
                    )}
                  >
                    {deletingDrafts ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    {deletingDrafts ? '删除中...' : draftDeleteMode ? '确定删除' : '删除简历'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void createNewDraft()}
                    disabled={creatingDraft}
                      data-resume-guest-block="true"
                    className="mt-2 flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-brand text-[11px] font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {creatingDraft ? '创建中' : '新建简历'}
                  </button>
                </div>
              ) : null}
              {visibleModuleSections.map((section) => {
                const active = activeSectionId === section.id;
                const highlighted = highlightedSections.includes(section.id);
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => jumpToSection(section.id)}
                    data-allow-guest="true"
                    className={cn(
                      'flex h-[70px] w-full flex-col items-center justify-center gap-1 rounded-xl border text-[11px] transition',
                      active
                        ? 'border-brand bg-brand/10 text-brand shadow-[0_8px_24px_rgba(255,128,2,0.16)]'
                        : 'border-transparent bg-white text-slate-600 hover:border-brand/40 hover:text-slate-900',
                      highlighted && !active && 'text-amber-500',
                    )}
                  >
                    <Layers className="h-4 w-4" />
                    <span className="line-clamp-2 text-center leading-4">{getModuleManagerLabel(section.id, content.sectionLabels)}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section ref={editorPanelRef} className="w-[480px] shrink-0 overflow-y-auto border-r border-[#D8DEE8] bg-white px-7 py-7">
            <div className="mb-5 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{getModuleManagerLabel(activeSectionId, content.sectionLabels)}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{SECTION_COPY[activeSectionId].summaryHint}</p>
                </div>
                <div className="text-right text-xs leading-5">
                  <p className="font-semibold text-brand">{activeSectionSummary}</p>
                  <p className="text-slate-500">第 {activeSectionPage} / {previewPageCount} 页</p>
                  <p className={effectiveOverflow ? 'text-amber-600' : 'text-slate-500'}>{effectiveOverflow ? `自动分页 ${previewPageCount} 页` : '单页正常'}</p>
                </div>
              </div>
            </div>

            {renderSectionEditor({
              sectionId: activeSectionId,
              content,
              setContent,
              draftId,
              token,
              optimizingEntryKey,
              optimizingSectionKey,
              updatePersonalField,
              setHighlightedSections,
              isDrawerOpen,
              toggleDrawer,
              openOnlyDrawer,
              onSaveDrawer: handleSaveDrawer,
              onOptimizeEntry: handleOptimizeEntry,
              onOptimizeSection: handleOptimizeSection,
              getEntrySuggestions: (sectionId, entryId) => entrySuggestions[getSuggestionDrawerKey(sectionId, entryId)],
              getUndoHandler: (scope, sectionId, entryId) => {
                if (!aiUndoState) {
                  return undefined;
                }
                if (scope !== aiUndoState.scope) {
                  return undefined;
                }
                if (sectionId && aiUndoState.sectionId && sectionId !== aiUndoState.sectionId) {
                  return undefined;
                }
                if (entryId && aiUndoState.entryId && entryId !== aiUndoState.entryId) {
                  return undefined;
                }
                return () => void handleUndoAiOptimize();
              },
            })}
          </section>

          <aside className="min-w-0 flex-1 bg-[#EEF1F5] p-6">
            <div className="flex h-full items-start justify-center overflow-hidden rounded-[20px] border border-[#D8DEE8] bg-[#EEF1F5] p-4">
              <div ref={previewViewportRef} className="flex h-full w-full items-start justify-center overflow-auto">
                <div className="mx-auto flex justify-center" style={{ minHeight: `${Math.max(previewFrameHeight, 220)}px` }}>
                  <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center' }}>
                    <div ref={previewHostRef}>
                      <ResumeDocument
                        content={previewContent}
                        styleConfig={previewStyleConfig}
                        layout={previewLayout}
                        textPreset={shouldUseEmptyStateTemplate ? 'reference' : 'default'}
                        onSectionClick={jumpToSection}
                        activeSectionId={activeSectionId}
                        onMetricsChange={handlePreviewMetricsChange}
                        onActiveSectionPageChange={setActiveSectionPage}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>
        </section>
        <div className="fixed bottom-6 right-6 z-[80] flex flex-col items-end gap-3">
        {aiUndoState?.scope === 'global' ? (
          <button
            type="button"
            onClick={() => void handleUndoAiOptimize()}
            className="inline-flex items-center gap-2 rounded-full border border-[#D8DEE8] bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-[0_18px_48px_rgba(15,23,42,0.10)] transition hover:bg-slate-50"
          >
            撤回还原
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void handleOptimizeResume()}
          disabled={batchAiBusy || !draftId}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(65,131,255,0.32)] transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {optimizingGlobal ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {optimizingGlobal ? '正在优化整份简历...' : '一键AI优化简历'}
        </button>
        </div>
        {createLimitPromptOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <h3 className="text-xl font-semibold text-slate-900">继续创建新简历需要开通会员</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">{DRAFT_COUNT_COPY[draftListMeta.memberRoleCode].upgradeHint}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateLimitPromptOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#D8DEE8] px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateLimitPromptOpen(false);
                  router.push('/membership');
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-dark"
              >
                去开通会员
              </button>
            </div>
          </div>
        </div>
        ) : null}
        {pendingBatchAiAction ? (
        <BatchAiConfirmDialog
          action={pendingBatchAiAction}
          onCancel={() => setPendingBatchAiAction(null)}
          onConfirm={() => {
            const action = pendingBatchAiAction;
            setPendingBatchAiAction(null);
            void submitBatchAiAction(action);
          }}
        />
        ) : null}
        <MemberAccessDialog
          open={Boolean(memberAccessMessage)}
          message={memberAccessMessage}
          onClose={() => setMemberAccessMessage('')}
          onConfirm={() => {
            setMemberAccessMessage('');
            router.push('/membership');
          }}
        />
        <AuthRequiredDialog
          open={authRequiredDialogOpen}
          onClose={() => setAuthRequiredDialogOpen(false)}
          onConfirm={() => {
            setAuthRequiredDialogOpen(false);
            router.push(`/login?redirect=${encodeURIComponent(REDIRECT_PATH)}`);
          }}
        />
      </main>
      <SiteBeianFooter className="pb-8 pt-6" />
    </div>
  );
}

function ResumeToolbarPanel({
  anchorRef,
  panel,
  activeStyleTab,
  setActiveStyleTab,
  styleConfig,
  setStyleConfig,
  templateConfigs,
  layout,
  moduleSections,
  activeSectionId,
  onClose,
  onJumpToSection,
  onMoveLayoutItem,
  onReorderLayoutItem,
  draggingSectionId,
  setDraggingSectionId,
  onRestoreLayoutItem,
  onUpdateLayoutItem,
  onApplyTemplate,
  onExportPdf,
  setMemberAccessMessage,
  sectionLabels,
  onUpdateSectionLabel,
  onTranslateResume,
  onProfessionalOptimizeResume,
  translatingDirection,
  professionalOptimizing,
  batchAiBusy,
}: {
  anchorRef: RefObject<HTMLDivElement>;
  panel: Exclude<ToolbarPanel, null>;
  activeStyleTab: StylePanelTab;
  setActiveStyleTab: Dispatch<SetStateAction<StylePanelTab>>;
  styleConfig: ResumeStyleConfig;
  setStyleConfig: Dispatch<SetStateAction<ResumeStyleConfig>>;
  templateConfigs: ResumeTemplateConfigRecord[];
  layout: ResumeLayoutItem[];
  moduleSections: ResumeLayoutItem[];
  activeSectionId: SupportedSectionId;
  onClose: () => void;
  onJumpToSection: (sectionId: ResumeSectionId) => void;
  onMoveLayoutItem: (sectionId: ResumeSectionId, direction: -1 | 1) => void;
  onReorderLayoutItem: (fromId: ResumeSectionId, toId: ResumeSectionId, position?: 'before' | 'after') => void;
  draggingSectionId: ResumeSectionId | null;
  setDraggingSectionId: Dispatch<SetStateAction<ResumeSectionId | null>>;
  onRestoreLayoutItem: (sectionId: ResumeSectionId) => void;
  onUpdateLayoutItem: (sectionId: ResumeSectionId, updates: Partial<ResumeLayoutItem>) => void;
  onApplyTemplate: (templateCode: ResumeTemplateCode | string) => void;
  onExportPdf: () => void;
  setMemberAccessMessage: Dispatch<SetStateAction<string>>;
  sectionLabels: ResumeContent['sectionLabels'];
  onUpdateSectionLabel: (sectionId: ResumeSectionId, value: string) => void;
  onTranslateResume: (direction: ResumeAiTranslateDirection) => void;
  onProfessionalOptimizeResume: () => void;
  translatingDirection: ResumeAiTranslateDirection | null;
  professionalOptimizing: boolean;
  batchAiBusy: boolean;
}) {
  if (panel === 'templateStyle') {
    return (
      <FloatingPanel anchorRef={anchorRef} align="center" className="w-[820px] max-w-[calc(100vw-48px)]" onClose={onClose}>
        <div className="flex border-b border-[#E5EAF1] bg-[#F8FAFC] px-6">
          {STYLE_PANEL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveStyleTab(tab.id)}
              className={cn(
                'relative h-14 px-5 text-sm font-medium transition',
                activeStyleTab === tab.id ? 'text-brand' : 'text-slate-500 hover:text-slate-900',
              )}
            >
              {tab.label}
              {activeStyleTab === tab.id ? <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-brand" /> : null}
            </button>
          ))}
        </div>
        <div className="max-h-[72vh] overflow-y-auto px-7 py-6">
          <TemplateStyleTabContent
            activeStyleTab={activeStyleTab}
            styleConfig={styleConfig}
            setStyleConfig={setStyleConfig}
            templateConfigs={templateConfigs}
            onApplyTemplate={onApplyTemplate}
          />
        </div>
      </FloatingPanel>
    );
  }

  if (panel === 'moduleManager') {
    return (
      <FloatingPanel anchorRef={anchorRef} align="right" className="w-[420px] max-w-[calc(100vw-32px)]" onClose={onClose}>
        <ModuleManagerPanel
          layout={layout}
          moduleSections={moduleSections}
          sectionLabels={sectionLabels}
          activeSectionId={activeSectionId}
          onJumpToSection={onJumpToSection}
          onMoveLayoutItem={onMoveLayoutItem}
          onReorderLayoutItem={onReorderLayoutItem}
          draggingSectionId={draggingSectionId}
          setDraggingSectionId={setDraggingSectionId}
          onRestoreLayoutItem={onRestoreLayoutItem}
          onUpdateLayoutItem={onUpdateLayoutItem}
          onUpdateSectionLabel={onUpdateSectionLabel}
        />
      </FloatingPanel>
    );
  }

  if (panel === 'textFormat') {
    return (
      <FloatingPanel anchorRef={anchorRef} align="center" className="w-[440px] max-w-[calc(100vw-32px)]" onClose={onClose}>
        <TextFormatPanel styleConfig={styleConfig} setStyleConfig={setStyleConfig} />
      </FloatingPanel>
    );
  }

  if (panel === 'theme') {
    return (
      <FloatingPanel anchorRef={anchorRef} align="right" className="w-[420px] max-w-[calc(100vw-32px)]" onClose={onClose}>
        <ThemeAndPaperPanel styleConfig={styleConfig} setStyleConfig={setStyleConfig} />
      </FloatingPanel>
    );
  }

  if (panel === 'translate') {
    return (
      <FloatingPanel anchorRef={anchorRef} align="right" className="w-[320px] max-w-[calc(100vw-32px)]" onClose={onClose}>
        <div className="space-y-4 p-4">
          <DarkPanelSection title="翻译">
          <DarkOptionButton
            label={translatingDirection === 'zh-to-en' ? '中译英进行中...' : '中译英'}
            description="生成英文简历草稿"
            disabled={batchAiBusy}
            onClick={() => void onTranslateResume('zh-to-en')}
          />
          <DarkOptionButton
            label={translatingDirection === 'en-to-zh' ? '英译中进行中...' : '英译中'}
            description="还原中文求职表达"
            disabled={batchAiBusy}
            onClick={() => void onTranslateResume('en-to-zh')}
          />
          <DarkOptionButton
            label={professionalOptimizing ? '专业术语优化进行中...' : '专业术语优化'}
            description="按目标岗位做专业表达升级"
            badge={PREMIUM_BADGE}
            disabled={batchAiBusy}
            onClick={onProfessionalOptimizeResume}
          />
          </DarkPanelSection>
        </div>
      </FloatingPanel>
    );
  }

  if (panel === 'download') {
    return (
      <FloatingPanel anchorRef={anchorRef} align="right" className="w-[300px] max-w-[calc(100vw-32px)]" onClose={onClose}>
        <DarkPanelSection title="下载">
          <DarkOptionButton label="普通 PDF" description="免费权益，可能带水印" onClick={onExportPdf} />
          <DarkOptionButton label={`无水印 PDF ${PREMIUM_BADGE}`} description="会员权益" onClick={() => setMemberAccessMessage('无水印下载需要开通会员')} />
        </DarkPanelSection>
      </FloatingPanel>
    );
  }

  const simplePanelMap = {
    font: {
      title: '字体',
      items: RESUME_FONT_OPTIONS.map((item) => ({ label: item.label, value: item.value })),
      current: styleConfig.fontFamily,
      onPick: (value: string) => setStyleConfig((prev) => ({ ...prev, fontFamily: value as ResumeStyleConfig['fontFamily'] })),
    },
    fontSize: {
      title: '字号',
      items: FONT_SIZE_OPTIONS.map((size) => ({ label: String(size), value: String(size) })),
      current: String(styleConfig.fontSize),
      onPick: (value: string) => updateNumericStyle(setStyleConfig, 'fontSize', value, 10, 18),
    },
    spacingScale: {
      title: '整体疏密',
      items: SPACING_SCALE_OPTIONS.map((size) => ({ label: `${size.toFixed(2)} 倍`, value: String(size) })),
      current: String(styleConfig.spacingScale),
      onPick: (value: string) => updateNumericStyle(setStyleConfig, 'spacingScale', value, 0.8, 1.2),
    },
    pageMargin: {
      title: '页边距',
      items: PAGE_MARGIN_OPTIONS.map((size) => ({ label: `${size}mm`, value: String(size) })),
      current: String(styleConfig.pageMargin),
      onPick: (value: string) => updateNumericStyle(setStyleConfig, 'pageMargin', value, 5, 25),
    },
  }[panel as 'font' | 'fontSize' | 'spacingScale' | 'pageMargin'];

  return (
    <FloatingPanel anchorRef={anchorRef} align="center" className="w-[220px] max-w-[calc(100vw-32px)]" onClose={onClose}>
      <div className="p-4">
        <DarkPanelSection title={simplePanelMap.title}>
          <div className="grid max-h-[340px] gap-2 overflow-y-auto">
            {simplePanelMap.items.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => simplePanelMap.onPick(item.value)}
                className={cn(
                  'h-10 rounded-xl border px-3 text-left text-sm transition',
                  simplePanelMap.current === item.value
                    ? 'border-brand/30 bg-brand/10 text-brand shadow-[0_8px_24px_rgba(255,128,2,0.16)]'
                    : 'border-[#E5EAF1] bg-white text-slate-700 hover:border-brand/40 hover:bg-brand/10 hover:text-slate-900',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </DarkPanelSection>
        </div>
    </FloatingPanel>
  );
}

function TemplateStyleTabContent({
  activeStyleTab,
  styleConfig,
  setStyleConfig,
  templateConfigs,
  onApplyTemplate,
}: {
  activeStyleTab: StylePanelTab;
  styleConfig: ResumeStyleConfig;
  setStyleConfig: Dispatch<SetStateAction<ResumeStyleConfig>>;
  templateConfigs: ResumeTemplateConfigRecord[];
  onApplyTemplate: (templateCode: ResumeTemplateCode | string) => void;
}) {
  const allowedHeaderAligns = useMemo(
    () => new Set(getAllowedHeaderAlignsByVariant(styleConfig.headerVariant)),
    [styleConfig.headerVariant],
  );
  const isFixedHeaderAlignVariant = styleConfig.headerVariant === 'business' || styleConfig.headerVariant === 'work';

  if (activeStyleTab === 'template') {
    return (
      <TemplateSwitchPanel
        templateConfigs={templateConfigs}
        currentTemplateCode={styleConfig.templateCode}
        onApplyTemplate={onApplyTemplate}
      />
    );
  }

  if (activeStyleTab === 'header') {
    return (
      <div className="space-y-7">
        <DarkPanelSection title="信息布局">
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: 'left', label: '居左', icon: <AlignLeft className="h-4 w-4" /> },
              { value: 'center', label: '居中', icon: <AlignCenter className="h-4 w-4" /> },
              { value: 'right', label: '居右', icon: <AlignRight className="h-4 w-4" /> },
            ].map((item) => (
              <StyleChoiceButton
                key={item.value}
                active={styleConfig.headerAlign === item.value}
                label={item.label}
                icon={item.icon}
                disabled={isFixedHeaderAlignVariant || !allowedHeaderAligns.has(item.value as ResumeStyleConfig['headerAlign'])}
                onClick={() => setStyleConfig((prev) => sanitizeStyleConfig({ ...prev, headerAlign: item.value as ResumeStyleConfig['headerAlign'] }))}
              />
            ))}
          </div>
        </DarkPanelSection>
        <PreviewGrid
          title="布局样式"
          items={RESUME_HEADER_VARIANT_OPTIONS.map((item) => ({
            value: item.value,
            label: getHeaderVariantDisplayName(item.value),
            premium: item.value === 'formal',
          }))}
          current={styleConfig.headerVariant}
          onPick={(value) =>
            setStyleConfig((prev) =>
              sanitizeStyleConfig({
                ...prev,
                headerVariant: value as ResumeStyleConfig['headerVariant'],
              }),
            )
          }
          previewKind="header"
        styleConfig={styleConfig}
        />
      </div>
    );
  }

  if (activeStyleTab === 'basic') {
    return (
      <PreviewGrid
        title="联系方式样式"
        items={RESUME_BASIC_INFO_VARIANT_OPTIONS.map((item) => ({
          value: item.value,
          label: getBasicInfoDisplayName(item.value),
        }))}
        current={styleConfig.basicInfoVariant}
        onPick={(value) => setStyleConfig((prev) => ({ ...prev, basicInfoVariant: value as ResumeStyleConfig['basicInfoVariant'] }))}
        previewKind="basic"
        styleConfig={styleConfig}
      />
    );
  }

  if (activeStyleTab === 'section') {
    return (
      <PreviewGrid
        title="模块样式"
        items={RESUME_SECTION_TITLE_VARIANT_OPTIONS.map((item) => ({
          value: item.value,
          label: getSectionTitleDisplayName(item.value),
          premium: item.value === 'bg-block',
        }))}
        current={styleConfig.sectionTitleVariant}
        onPick={(value) => setStyleConfig((prev) => ({ ...prev, sectionTitleVariant: value as ResumeStyleConfig['sectionTitleVariant'] }))}
        previewKind="section"
        styleConfig={styleConfig}
      />
    );
  }

  if (activeStyleTab === 'paper') {
    return <ThemeAndPaperPanel styleConfig={styleConfig} setStyleConfig={setStyleConfig} compact />;
  }

  return (
    <PreviewGrid
      title="技能样式"
      items={RESUME_SKILL_VARIANT_OPTIONS.map((item) => ({
        value: item.value,
        label: getSkillDisplayName(item.value),
        premium: item.value === 'icon-grid',
      }))}
      current={styleConfig.skillVariant}
      onPick={(value) => setStyleConfig((prev) => ({ ...prev, skillVariant: value as ResumeStyleConfig['skillVariant'] }))}
      previewKind="skill"
      styleConfig={styleConfig}
    />
  );
}

function TextFormatPanel({
  styleConfig,
  setStyleConfig,
}: {
  styleConfig: ResumeStyleConfig;
  setStyleConfig: Dispatch<SetStateAction<ResumeStyleConfig>>;
}) {
  return (
    <div className="space-y-6 p-6">
      <DarkPanelTitle>文本格式</DarkPanelTitle>
      <DarkPanelSection title="日期时间">
        <SegmentedChoice
          items={[
            { value: 'cn', label: '2021年1月' },
            { value: 'dot', label: '2021.01' },
          ]}
          current={styleConfig.dateFormat}
          onPick={(value) => setStyleConfig((prev) => ({ ...prev, dateFormat: value as ResumeStyleConfig['dateFormat'] }))}
        />
      </DarkPanelSection>
      <DarkPanelSection title="经历标题">
        <SegmentedChoice
          items={[
            { value: 'double', label: '双行标题' },
            { value: 'single', label: '单行标题' },
          ]}
          current={styleConfig.titleStyle}
          onPick={(value) =>
            setStyleConfig((prev) => ({
              ...prev,
              titleStyle: value as ResumeStyleConfig['titleStyle'],
              experienceHeaderVariant: value === 'double' ? 'double-line' : 'single-line',
            }))
          }
        />
      </DarkPanelSection>
    </div>
  );
}

function ThemeAndPaperPanel({
  styleConfig,
  setStyleConfig,
  compact = false,
}: {
  styleConfig: ResumeStyleConfig;
  setStyleConfig: Dispatch<SetStateAction<ResumeStyleConfig>>;
  compact?: boolean;
}) {
  return (
    <div className={cn('space-y-7', compact ? '' : 'p-6')}>
      {!compact ? <DarkPanelTitle>主题与背景</DarkPanelTitle> : null}
      <DarkPanelSection title="主题颜色">
        <div className="flex flex-wrap gap-3">
          {THEME_OPTIONS.map((item, index) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setStyleConfig((prev) => ({ ...prev, themeColor: item.value }))}
              className={cn(
                'relative h-9 w-9 rounded-lg border transition',
                styleConfig.themeColor === item.value ? 'border-brand ring-2 ring-brand/20' : 'border-[#E5EAF1] hover:border-brand/40',
              )}
              style={{ backgroundColor: item.value }}
              aria-label={item.label}
            >
              {styleConfig.themeColor === item.value ? <span className="absolute inset-0 flex items-center justify-center text-lg text-white">✓</span> : null}
              {index > 4 ? <PremiumCorner /> : null}
            </button>
          ))}
          <label className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-md bg-white">
            <input
              type="color"
              value={normalizeThemeColor(styleConfig.themeColor)}
              onChange={(event) => setStyleConfig((prev) => ({ ...prev, themeColor: event.target.value }))}
              className="h-12 w-12 cursor-pointer border-0 p-0"
              aria-label="自定义主题色"
            />
          </label>
        </div>
      </DarkPanelSection>
      <DarkPanelSection title="背景样式">
        <div className="grid grid-cols-3 gap-4">
          {PAPER_BACKGROUND_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setStyleConfig((prev) => ({ ...prev, paperBackgroundVariant: item.value }))}
              className={cn(
                'relative aspect-square overflow-hidden rounded-xl border bg-white transition',
                styleConfig.paperBackgroundVariant === item.value ? 'border-brand ring-2 ring-brand/20' : 'border-[#E5EAF1] hover:border-brand/40',
              )}
              aria-label={item.label}
            >
              <span
                className="absolute inset-0"
                style={{
                  backgroundImage: buildPaperPreviewBackground(item.value),
                  backgroundPosition: 'center',
                  backgroundSize: item.value === 'none' ? 'auto' : '72px 72px',
                }}
              />
              {styleConfig.paperBackgroundVariant === item.value ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-lg text-white">✓</span>
                </span>
              ) : null}
              {item.premium ? <PremiumCorner /> : null}
            </button>
          ))}
        </div>
      </DarkPanelSection>
      <DarkPanelSection title="背景位置">
        <SegmentedChoice
          items={[
            { value: 'right', label: '居右' },
            { value: 'left', label: '居左' },
          ]}
          current={styleConfig.paperBackgroundPosition}
          onPick={(value) => setStyleConfig((prev) => ({ ...prev, paperBackgroundPosition: value as ResumeStyleConfig['paperBackgroundPosition'] }))}
        />
      </DarkPanelSection>
    </div>
  );
}

function ModuleManagerPanel({
  layout,
  moduleSections,
  sectionLabels,
  activeSectionId,
  onJumpToSection,
  onMoveLayoutItem,
  onReorderLayoutItem,
  draggingSectionId,
  setDraggingSectionId,
  onRestoreLayoutItem,
  onUpdateLayoutItem,
  onUpdateSectionLabel,
}: {
  layout: ResumeLayoutItem[];
  moduleSections: ResumeLayoutItem[];
  sectionLabels: ResumeContent['sectionLabels'];
  activeSectionId: SupportedSectionId;
  onJumpToSection: (sectionId: ResumeSectionId) => void;
  onMoveLayoutItem: (sectionId: ResumeSectionId, direction: -1 | 1) => void;
  onReorderLayoutItem: (fromId: ResumeSectionId, toId: ResumeSectionId, position?: 'before' | 'after') => void;
  draggingSectionId: ResumeSectionId | null;
  setDraggingSectionId: Dispatch<SetStateAction<ResumeSectionId | null>>;
  onRestoreLayoutItem: (sectionId: ResumeSectionId) => void;
  onUpdateLayoutItem: (sectionId: ResumeSectionId, updates: Partial<ResumeLayoutItem>) => void;
  onUpdateSectionLabel: (sectionId: ResumeSectionId, value: string) => void;
}) {
  const [editingSectionId, setEditingSectionId] = useState<ResumeSectionId | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [dragOverSectionId, setDragOverSectionId] = useState<ResumeSectionId | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after'>('before');
  const activeModules = moduleSections.filter((item) => item.visible && !item.deleted);
  const optionalModules = RESUME_SECTION_DEFINITIONS.filter((item) => item.deletable);
  const restorableModules = optionalModules.filter((definition) => {
    const current = layout.find((item) => item.id === definition.id);
    return !current || current.deleted || !current.visible;
  });
  const clearDraggingState = useCallback(() => {
    setDraggingSectionId(null);
    setDragOverSectionId(null);
    setDragOverPosition('before');
  }, [setDraggingSectionId]);
  const resolveDropPosition = useCallback(
    (clientY: number, rect: DOMRect, currentTargetId: ResumeSectionId) => {
      const offsetY = clientY - rect.top;
      const edgeZone = Math.min(Math.max(rect.height * 0.36, 18), Math.max(rect.height / 2 - 4, 18));
      if (offsetY <= edgeZone) {
        return 'before' as const;
      }
      if (offsetY >= rect.height - edgeZone) {
        return 'after' as const;
      }
      if (dragOverSectionId === currentTargetId) {
        return dragOverPosition;
      }
      return offsetY <= rect.height / 2 ? ('before' as const) : ('after' as const);
    },
    [dragOverPosition, dragOverSectionId],
  );

  return (
    <div className="space-y-7 p-6">
      <div>
        <DarkPanelTitle>已有模块</DarkPanelTitle>
        <p className="mt-2 text-sm text-slate-500">基本信息固定在顶部，其余模块支持自由拖拽排序，左侧编辑区和右侧简历预览会实时同步。</p>
      </div>
      <div className="space-y-3">
        {activeModules.map((item, index) => {
          const active = activeSectionId === item.id;
          const isPinnedSection = item.id === 'personal';
          const canDropOnCurrent = Boolean(draggingSectionId && draggingSectionId !== 'personal' && draggingSectionId !== item.id && !isPinnedSection);
          const showDropBefore = Boolean(canDropOnCurrent && dragOverSectionId === item.id && dragOverPosition === 'before');
          const showDropAfter = Boolean(canDropOnCurrent && dragOverSectionId === item.id && dragOverPosition === 'after');
          return (
            <div key={item.id} className="relative space-y-2">
              {showDropBefore ? <div className="absolute -top-1 left-3 right-3 z-10 h-0.5 rounded-full bg-brand shadow-[0_0_0_3px_rgba(255,128,2,0.12)]" /> : null}
              <div
                draggable={!isPinnedSection}
                onDragStart={(event) => {
                  if (isPinnedSection) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.effectAllowed = 'move';
                  setDraggingSectionId(item.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!draggingSectionId || draggingSectionId === 'personal' || draggingSectionId === item.id || isPinnedSection) {
                    return;
                  }
                  const rect = event.currentTarget.getBoundingClientRect();
                  const nextPosition = resolveDropPosition(event.clientY, rect, item.id);
                  if (dragOverSectionId !== item.id) {
                    setDragOverSectionId(item.id);
                  }
                  if (dragOverPosition !== nextPosition) {
                    setDragOverPosition(nextPosition);
                  }
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDragOverSectionId((prev) => (prev === item.id ? null : prev));
                  }
                }}
                onDrop={() => {
                  if (draggingSectionId && draggingSectionId !== item.id) {
                    onReorderLayoutItem(draggingSectionId, item.id, dragOverPosition);
                  }
                  clearDraggingState();
                }}
                onDragEnd={clearDraggingState}
                className={cn(
                  'flex min-h-[52px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm transition duration-150',
                  active
                    ? 'border-brand/30 bg-brand/10 text-brand shadow-[0_8px_24px_rgba(255,128,2,0.16)]'
                    : 'border-[#E5EAF1] bg-white text-slate-700 hover:border-brand/40 hover:bg-brand/10',
                  draggingSectionId === item.id && 'cursor-grabbing border-brand/30 bg-brand/5 opacity-55 shadow-[0_14px_36px_rgba(255,128,2,0.12)]',
                  (showDropBefore || showDropAfter) && 'border-brand/40 bg-brand/5',
                )}
              >
                <button
                  type="button"
                  disabled={isPinnedSection}
                  data-resume-guest-block="true"
                  className={cn(
                    'text-slate-400 transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-35',
                    draggingSectionId === item.id ? 'cursor-grabbing text-brand' : 'cursor-grab active:cursor-grabbing',
                  )}
                  aria-label="拖拽排序"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onJumpToSection(item.id)} data-allow-guest="true" className="min-w-0 flex-1 truncate text-left font-medium">
                  {getModuleManagerLabel(item.id, sectionLabels)}
                </button>
                <button
                  type="button"
                  className="text-slate-400 transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-35"
                  onClick={() => onMoveLayoutItem(item.id, -1)}
                  disabled={isPinnedSection || index <= 1}
                  data-resume-guest-block="true"
                  aria-label="上移模块"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="text-slate-400 transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-35"
                  onClick={() => onMoveLayoutItem(item.id, 1)}
                  disabled={isPinnedSection || index === activeModules.length - 1}
                  data-resume-guest-block="true"
                  aria-label="下移模块"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingSectionId(item.id);
                    setEditingLabel(getModuleManagerLabel(item.id, sectionLabels));
                  }}
                  data-resume-guest-block="true"
                  className="text-slate-400 transition hover:text-brand"
                  aria-label="编辑模块名称"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateLayoutItem(item.id, { visible: false, deleted: false })}
                  data-resume-guest-block="true"
                  className="text-slate-400 transition hover:text-slate-700"
                  aria-label="隐藏模块"
                >
                  <EyeOff className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateLayoutItem(item.id, { visible: false, deleted: true })}
                  data-resume-guest-block="true"
                  className="text-slate-400 transition hover:text-red-500"
                  aria-label="删除模块"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {showDropAfter ? <div className="absolute -bottom-1 left-3 right-3 z-10 h-0.5 rounded-full bg-brand shadow-[0_0_0_3px_rgba(255,128,2,0.12)]" /> : null}
              {editingSectionId === item.id && item.id !== 'personal' ? (
                <div className="flex items-center gap-2 rounded-2xl border border-[#E5EAF1] bg-[#F8FAFC] p-3">
                  <Input value={editingLabel} maxLength={24} onChange={(event) => setEditingLabel(event.target.value)} className="h-10" placeholder="输入模块展示名称" />
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSectionLabel(item.id, editingLabel);
                      setEditingSectionId(null);
                    }}
                    data-resume-guest-block="true"
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-brand px-3 text-sm font-medium text-white transition hover:bg-brand-dark"
                  >
                    保存
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div>
        <DarkPanelTitle>添加模块</DarkPanelTitle>
        <p className="mt-2 text-sm text-slate-500">新增模块后，左侧编辑区会自动生成对应内容卡片。</p>
      </div>
      <div className="space-y-3">
        {restorableModules.length ? (
          restorableModules.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onRestoreLayoutItem(item.id)}
              data-resume-guest-block="true"
              className="flex h-12 w-full items-center gap-3 rounded-2xl border border-dashed border-brand/30 bg-brand/5 px-4 text-left text-sm font-medium text-slate-700 transition hover:bg-brand/10 hover:text-brand"
            >
              <Plus className="h-4 w-4" />
              {item.label}
              {item.id === 'links' ? <span className="text-brand">{PREMIUM_BADGE}</span> : null}
            </button>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-[#D8DEE8] bg-[#F8FAFC] px-4 py-3 text-sm text-slate-500">所有可选模块都已添加</p>
        )}
      </div>
    </div>
  );
}

function PreviewGrid({
  title,
  items,
  current,
  onPick,
  previewKind,
  styleConfig,
}: {
  title: string;
  items: Array<{ value: string; label: string; premium?: boolean }>;
  current: string;
  onPick: (value: string) => void;
  previewKind: 'header' | 'basic' | 'section' | 'skill';
  styleConfig: ResumeStyleConfig;
}) {
  return (
    <DarkPanelSection title={title}>
      <div className="grid grid-cols-2 gap-x-5 gap-y-6">
        {items.map((item) => (
          <button key={item.value} type="button" onClick={() => onPick(item.value)} data-resume-guest-block="true" className="group text-left">
            <div
              className={cn(
                'relative h-[128px] overflow-hidden rounded-xl border bg-white p-4 transition',
                current === item.value ? 'border-brand ring-2 ring-brand/20' : 'border-[#E5EAF1] group-hover:border-brand/40',
              )}
            >
              <LiveTemplatePreview previewKind={previewKind} styleConfig={buildTemplatePreviewStyleConfig(styleConfig, previewKind, item.value)} />
              {current === item.value ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-lg text-white">✓</span>
                </span>
              ) : null}
              {item.premium ? <PremiumCorner /> : null}
            </div>
            <p className="mt-3 text-center text-sm font-medium text-slate-700">{item.label}</p>
          </button>
        ))}
      </div>
    </DarkPanelSection>
  );
}

function TemplateSwitchPanel({
  templateConfigs,
  currentTemplateCode,
  onApplyTemplate,
}: {
  templateConfigs: ResumeTemplateConfigRecord[];
  currentTemplateCode: ResumeTemplateCode;
  onApplyTemplate: (templateCode: ResumeTemplateCode | string) => void;
}) {
  return (
    <DarkPanelSection title="模板切换">
      <div className="grid grid-cols-2 gap-x-5 gap-y-6">
        {templateConfigs.map((item) => (
          <button
            key={item.templateCode}
            type="button"
            onClick={() => onApplyTemplate(item.templateCode)}
            className="group text-left"
          >
            <div
              className={cn(
                'relative h-[172px] overflow-hidden rounded-xl border bg-white p-4 transition',
                currentTemplateCode === item.templateCode ? 'border-brand ring-2 ring-brand/20' : 'border-[#E5EAF1] group-hover:border-brand/40',
              )}
            >
              <LiveTemplatePreview
                previewKind="template"
                styleConfig={item.styleJson}
              />
              {currentTemplateCode === item.templateCode ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-lg text-white">✓</span>
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm font-medium text-slate-700">{item.templateName}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.description || '使用后台模板默认排版参数'}</p>
          </button>
        ))}
      </div>
    </DarkPanelSection>
  );
}

function LiveTemplatePreview({
  previewKind,
  styleConfig,
}: {
  previewKind: 'header' | 'basic' | 'section' | 'skill' | 'template';
  styleConfig: ResumeStyleConfig;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl bg-white">
      <div className="pointer-events-none absolute left-0 top-0 [&_.pointer-events-none.absolute]:hidden" style={{ width: '794px', transform: 'translateZ(0) scale(0.5)', transformOrigin: 'top left', willChange: 'transform', backfaceVisibility: 'hidden' }}>
        <ResumeDocument content={getPreviewContent(previewKind)} styleConfig={styleConfig} layout={getPreviewLayout(previewKind)} />
      </div>
    </div>
  );
}

function buildTemplatePreviewStyleConfig(
  baseStyle: ResumeStyleConfig,
  previewKind: 'header' | 'basic' | 'section' | 'skill' | 'template',
  value: string,
) {
  if (previewKind === 'template') {
    return sanitizeStyleConfig({ ...baseStyle, templateCode: value as ResumeTemplateCode });
  }
  if (previewKind === 'header') {
    return sanitizeStyleConfig({ ...baseStyle, headerVariant: value as ResumeStyleConfig['headerVariant'] });
  }
  if (previewKind === 'basic') {
    return sanitizeStyleConfig({ ...baseStyle, basicInfoVariant: value as ResumeStyleConfig['basicInfoVariant'] });
  }
  if (previewKind === 'section') {
    return sanitizeStyleConfig({ ...baseStyle, sectionTitleVariant: value as ResumeStyleConfig['sectionTitleVariant'] });
  }
  return sanitizeStyleConfig({ ...baseStyle, skillVariant: value as ResumeStyleConfig['skillVariant'] });
}

function FloatingPanel({
  anchorRef,
  align = 'center',
  className,
  onClose,
  children,
}: {
  anchorRef: RefObject<HTMLDivElement>;
  align?: 'center' | 'right';
  className: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) {
        return;
      }

      const rect = anchor.getBoundingClientRect();
      setPosition({
        left: align === 'right' ? rect.right : rect.left + rect.width / 2,
        top: rect.bottom + FLOATING_PANEL_OFFSET,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, anchorRef]);

  if (typeof document === 'undefined' || !position) {
    return null;
  }

  return createPortal(
    <>
      <button type="button" aria-label="关闭面板" className="fixed inset-0 z-20 cursor-default bg-transparent" onClick={onClose} />
      <div
        className={cn(
          'fixed z-[70] overflow-hidden rounded-2xl border border-[#D8DEE8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)]',
          align === 'center' ? '-translate-x-1/2' : '-translate-x-full',
          className,
        )}
        style={{ left: position.left, top: position.top }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

function ToolbarDropdownAnchor({
  panel,
  name,
  children,
}: {
  panel: ToolbarPanel;
  name: Exclude<ToolbarPanel, null> | 'smart-layout';
  children: (anchorRef: RefObject<HTMLDivElement>) => ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  return <div ref={anchorRef} className={cn('relative shrink-0', panel === name && 'z-50')}>{children(anchorRef)}</div>;
}

function DarkToolbarButton({
  icon,
  label,
  active,
  badge,
  colorPreview,
  tooltip,
  pill = false,
  light = false,
  onClick,
}: {
  icon?: ReactNode;
  label?: string;
  active?: boolean;
  badge?: string;
  colorPreview?: string;
  tooltip?: string;
  pill?: boolean;
  light?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={tooltip}
      onClick={onClick}
      data-resume-guest-block="true"
      className={cn(
        'relative inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition',
        pill && 'rounded-full px-6',
        light
          ? active
            ? 'border-brand/30 bg-brand/10 text-brand shadow-[0_8px_24px_rgba(255,128,2,0.14)]'
            : 'border-[#F1D6B5] bg-white text-slate-700 hover:border-brand/40 hover:bg-brand/10 hover:text-brand'
          : active
            ? 'border-brand/30 bg-brand/10 text-brand'
            : 'border-[#F1D6B5] bg-white text-slate-700 hover:border-brand/40 hover:bg-brand/10',
      )}
    >
      {badge ? <span className="absolute -right-2 -top-3 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">{badge}</span> : null}
      {colorPreview ? <span className="h-5 w-5 rounded border border-[#E8C89B]" style={{ backgroundColor: colorPreview }} /> : icon}
      {label ? <span>{label}</span> : null}
      <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition', active && 'rotate-180 text-brand')} />
    </button>
  );
}

function LineSpacingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 4v16" />
      <path d="m3.5 6 2.5-2.5L8.5 6" />
      <path d="m3.5 18 2.5 2.5L8.5 18" />
      <path d="M12 7h8" />
      <path d="M12 12h8" />
      <path d="M12 17h8" />
    </svg>
  );
}

function PageMarginIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
      <path d="M12 4.5v2" />
      <path d="M12 17.5v2" />
      <path d="M4.5 12h2" />
      <path d="M17.5 12h2" />
    </svg>
  );
}

function DarkPanelTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xl font-semibold text-slate-900">{children}</h3>;
}

function DarkPanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h4 className="text-sm font-semibold text-slate-500">{title}</h4>
      {children}
    </section>
  );
}

function DarkOptionButton({
  label,
  description,
  badge,
  onClick,
  disabled = false,
}: {
  label: string;
  description: string;
  badge?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-resume-guest-block="true"
      className={cn(
        'w-full rounded-xl border px-4 py-3 text-left transition',
        disabled
          ? 'cursor-not-allowed border-[#E5EAF1] bg-slate-100'
          : 'border-[#E5EAF1] bg-[#F8FAFC] hover:border-brand/40 hover:bg-brand/10',
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className={cn('block text-sm font-semibold', disabled ? 'text-slate-400' : 'text-slate-900')}>{label}</span>
        {badge ? <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">{badge}</span> : null}
      </span>
      <span className={cn('mt-1 block text-xs', disabled ? 'text-slate-400' : 'text-slate-500')}>{description}</span>
    </button>
  );
}

function BatchAiConfirmDialog({
  action,
  onCancel,
  onConfirm,
}: {
  action: ResumeBatchAiAction;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const actionLabel =
    action.type === 'translate'
      ? action.direction === 'zh-to-en'
        ? '中译英'
        : '英译中'
      : '专业术语优化';

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center bg-slate-950/45 px-4">
      <div className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <h3 className="text-xl font-semibold text-slate-900">确认发起{actionLabel}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          系统会在后台先复制当前简历，生成一份新副本，再对副本执行{actionLabel}。原简历不会被直接覆盖，任务提交后你无需停留在当前页面等待。
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#D8DEE8] px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-dark"
          >
            确认并后台执行
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthRequiredDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <h3 className="text-xl font-semibold text-slate-900">登录后即可继续</h3>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          未登录状态下可先浏览 AI简历优化 页面内容与填写样式；当你开始填写、选择、编辑、导出或发起 AI 操作时，需要先登录账号。
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#D8DEE8] px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            关闭弹窗
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-dark"
          >
            去登录
          </button>
        </div>
      </div>
    </div>
  );
}

function StyleChoiceButton({
  active,
  label,
  icon,
  onClick,
  disabled = false,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-12 items-center justify-center gap-2 rounded-xl border text-sm transition',
        disabled && active
          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 opacity-80'
          : active
          ? 'border-brand/30 bg-brand/10 text-brand shadow-[0_8px_24px_rgba(255,128,2,0.16)]'
          : disabled
            ? 'cursor-not-allowed border-[#E5EAF1] bg-slate-50 text-slate-400 opacity-70'
            : 'border-[#E5EAF1] bg-white text-slate-600 hover:border-brand/40 hover:bg-brand/10',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SegmentedChoice({
  items,
  current,
  onPick,
}: {
  items: Array<{ value: string; label: string }>;
  current: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onPick(item.value)}
          className={cn(
            'h-11 rounded-xl border text-sm font-medium transition',
            current === item.value
              ? 'border-brand/30 bg-brand/10 text-brand shadow-[0_8px_24px_rgba(255,128,2,0.16)]'
              : 'border-[#E5EAF1] bg-white text-slate-600 hover:border-brand/40 hover:bg-brand/10 hover:text-slate-900',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}



function PremiumCorner() {
  return <span className="absolute right-1.5 top-1.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">{PREMIUM_BADGE}</span>;
}

function renderSectionEditor({
  sectionId,
  content,
  setContent,
  draftId,
  token,
  optimizingEntryKey,
  optimizingSectionKey,
  updatePersonalField,
  setHighlightedSections,
  isDrawerOpen,
  toggleDrawer,
  openOnlyDrawer,
  onSaveDrawer,
  onOptimizeEntry,
  onOptimizeSection,
  getEntrySuggestions,
  getUndoHandler,
}: {
  sectionId: SupportedSectionId;
  content: ResumeContent;
  setContent: Dispatch<SetStateAction<ResumeContent>>;
  draftId: string;
  token: string | null;
  optimizingEntryKey: string | null;
  optimizingSectionKey: string | null;
  updatePersonalField: (field: keyof ResumeContent['personal'], value: string) => void;
  setHighlightedSections: Dispatch<SetStateAction<ResumeSectionId[]>>;
  isDrawerOpen: (drawerKey: string) => boolean;
  toggleDrawer: (drawerKey: string) => void;
  openOnlyDrawer: (sectionId: ResumeSectionId, drawerKey: string) => void;
  onSaveDrawer: (drawerKey: string) => Promise<void>;
  onOptimizeEntry: (sectionId: ResumeAiOptimizeEntrySectionId, entryId: string, selectedSuggestion?: string) => Promise<void>;
  onOptimizeSection: (sectionId: ResumeAiOptimizeSectionId, selectedSuggestion?: string) => Promise<void>;
  getEntrySuggestions: (sectionId: ResumeSuggestionTargetSectionId, entryId?: string) => ResumeEntrySuggestionState | undefined;
  getUndoHandler: (scope: ResumeAiUndoScope, sectionId?: SupportedSectionId, entryId?: string) => (() => void) | undefined;
}) {
  switch (sectionId) {
    case 'personal': {
      const drawerKey = getDrawerKey('personal');
      return (
        <DrawerCard
          title="基本信息"
          open={isDrawerOpen(drawerKey)}
          onToggle={() => toggleDrawer(drawerKey)}
          onSave={() => void onSaveDrawer(drawerKey)}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <FieldBlock label="姓名">
              <Input value={content.personal.name} onChange={(event) => updatePersonalField('name', event.target.value)} className={fieldClassName} placeholder="请输入姓名" />
            </FieldBlock>
            <FieldBlock label="联系电话">
              <Input value={content.personal.phone} onChange={(event) => updatePersonalField('phone', event.target.value)} className={fieldClassName} placeholder="请输入手机号" />
            </FieldBlock>
            <FieldBlock label="邮箱">
              <Input value={content.personal.email} onChange={(event) => updatePersonalField('email', event.target.value)} className={fieldClassName} placeholder="请输入邮箱" />
            </FieldBlock>
            <FieldBlock label="到岗时间">
              <Input value={content.personal.availability} onChange={(event) => updatePersonalField('availability', event.target.value)} className={fieldClassName} placeholder="例如：两周内到岗" />
            </FieldBlock>
            <FieldBlock label="求职意向">
              <Input value={content.personal.expectedRole} onChange={(event) => updatePersonalField('expectedRole', event.target.value)} className={fieldClassName} placeholder="例如：前端开发" />
            </FieldBlock>
            <FieldBlock label="现居城市">
              <Input value={content.personal.expectedCity} onChange={(event) => updatePersonalField('expectedCity', event.target.value)} className={fieldClassName} placeholder="请输入城市" />
            </FieldBlock>
            <FieldBlock label="作品链接" className="md:col-span-2">
              <Input value={content.personal.website} onChange={(event) => updatePersonalField('website', event.target.value)} className={fieldClassName} placeholder="可填写作品集或主页链接" />
            </FieldBlock>
            <FieldBlock label="简历头像">
              <ImageUploadField
                value={content.personal.avatarUrl}
                previewUrl={content.personal.avatarPreviewUrl}
                emptyLabel="上传头像"
                scene={OSS_IMAGE_UPLOAD_SCENES.avatar}
                bizId={draftId || undefined}
                token={token}
                onChange={({ objectKey, previewUrl }) =>
                  setContent((prev) => ({
                    ...prev,
                    personal: {
                      ...prev.personal,
                      avatarUrl: objectKey,
                      avatarPreviewUrl: previewUrl,
                    },
                  }))
                }
              />
            </FieldBlock>
          </div>
        </DrawerCard>
      );
    }
    case 'education':
      return (
        <div className="space-y-4">
          {content.education.map((item, index) => {
            const drawerKey = getDrawerKey('education', item.id);
            return (
              <DrawerCard
                key={item.id}
                title={`教育经历 ${index + 1}`}
                open={isDrawerOpen(drawerKey)}
                onToggle={() => toggleDrawer(drawerKey)}
                onOptimize={() => void onOptimizeEntry('education', item.id)}
                optimizing={optimizingEntryKey === drawerKey}
                onUndo={getUndoHandler('entry', 'education', item.id)}
                suggestions={getEntrySuggestions('education', item.id)?.suggestions ?? []}
                suggestionsLoading={getEntrySuggestions('education', item.id)?.loading ?? false}
                onSuggestionPick={(suggestion) => void onOptimizeEntry('education', item.id, suggestion)}
                onDelete={() =>
                  setContent((prev) => ({
                    ...prev,
                    education: prev.education.length === 1 ? [resetItemValues(prev.education[0])] : prev.education.filter((entry) => entry.id !== item.id),
                  }))
                }
                onSave={() => void onSaveDrawer(drawerKey)}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldBlock label="学校名称">
                    <Input value={item.schoolName} onChange={(event) => setContent((prev) => ({ ...prev, education: updateItemField(prev.education, item.id, 'schoolName', event.target.value) }))} className={fieldClassName} />
                  </FieldBlock>
                  <FieldBlock label="学历">
                    <Input value={item.degree} onChange={(event) => setContent((prev) => ({ ...prev, education: updateItemField(prev.education, item.id, 'degree', event.target.value) }))} className={fieldClassName} placeholder="本科 / 硕士" />
                  </FieldBlock>
                  <FieldBlock label="专业">
                    <Input value={item.major} onChange={(event) => setContent((prev) => ({ ...prev, education: updateItemField(prev.education, item.id, 'major', event.target.value) }))} className={fieldClassName} />
                  </FieldBlock>
                  <FieldBlock label="学校校徽">
                    <ImageUploadField
                      value={item.logoUrl}
                      previewUrl={item.logoPreviewUrl}
                      emptyLabel="上传校徽"
                      scene={OSS_IMAGE_UPLOAD_SCENES.schoolLogo}
                      bizId={draftId || item.id}
                      token={token}
                      onChange={({ objectKey, previewUrl }) =>
                        setContent((prev) => ({
                          ...prev,
                          education: prev.education.map((entry) =>
                            entry.id === item.id
                              ? {
                                  ...entry,
                                  logoUrl: objectKey,
                                  logoPreviewUrl: previewUrl,
                                }
                              : entry,
                          ),
                        }))
                      }
                    />
                  </FieldBlock>
                  <DateRangeFields
                    startDate={item.startDate}
                    endDate={item.endDate}
                    onStartChange={(value) => {
                      setHighlightedSections((prev) => prev.filter((entry) => entry !== 'education'));
                      setContent((prev) => ({ ...prev, education: updateItemField(prev.education, item.id, 'startDate', value) }));
                    }}
                    onEndChange={(value) => {
                      setHighlightedSections((prev) => prev.filter((entry) => entry !== 'education'));
                      setContent((prev) => ({ ...prev, education: updateItemField(prev.education, item.id, 'endDate', value) }));
                    }}
                  />
                  <FieldBlock label="教育亮点" className="md:col-span-2">
                    <ResumeRichTextEditor
                      value={item.description}
                      onChange={(value) => setContent((prev) => ({ ...prev, education: updateItemField(prev.education, item.id, 'description', value) }))}
                      className="min-h-[148px]"
                      placeholder="支持项目符号、数字排序和加粗，例如主修课程、成绩、证书"
                      preset="list"
                    />
                  </FieldBlock>
                </div>
              </DrawerCard>
            );
          })}
          <AddDrawerButton
            onClick={() => {
              const nextItem = createEmptyEducationEntry();
              setContent((prev) => ({ ...prev, education: [...prev.education, nextItem] }));
              openOnlyDrawer('education', getDrawerKey('education', nextItem.id));
            }}
          >
            {SECTION_COPY.education.addLabel}
          </AddDrawerButton>
        </div>
      );
    case 'internships':
      return (
        <ExperienceEditorSection
          sectionId="internships"
          title="实习经历"
          itemLabel="实习经历"
          items={content.internships}
          addLabel={SECTION_COPY.internships.addLabel ?? '+ 再增加一段实习经历'}
          isDrawerOpen={isDrawerOpen}
          toggleDrawer={toggleDrawer}
          onSaveDrawer={onSaveDrawer}
          onAdd={() => {
            const nextItem = createEmptyExperienceEntry();
            setContent((prev) => ({ ...prev, internships: [...prev.internships, nextItem] }));
            openOnlyDrawer('internships', getDrawerKey('internships', nextItem.id));
          }}
          onDelete={(id) =>
            setContent((prev) => ({
              ...prev,
              internships:
                prev.internships.length === 1 ? [resetItemValues(prev.internships[0])] : prev.internships.filter((entry) => entry.id !== id),
            }))
          }
          onChange={(id, key, value) =>
            setContent((prev) => ({
              ...prev,
              internships: updateItemField(prev.internships, id, key, value),
            }))
          }
          onDateChange={(id, key, value) => {
            setHighlightedSections((prev) => prev.filter((entry) => entry !== 'internships'));
            setContent((prev) => ({
              ...prev,
              internships: updateItemField(prev.internships, id, key, value),
            }));
          }}
          optimizingEntryKey={optimizingEntryKey}
          onOptimize={onOptimizeEntry}
          getSuggestions={getEntrySuggestions}
          getUndoHandler={getUndoHandler}
          primaryFieldLabel="公司名称"
        />
      );
    case 'projects':
      return (
        <ExperienceEditorSection
          sectionId="projects"
          title="项目经历"
          itemLabel="项目经历"
          items={content.projects}
          addLabel={SECTION_COPY.projects.addLabel ?? '+ 再增加一段项目经历'}
          isDrawerOpen={isDrawerOpen}
          toggleDrawer={toggleDrawer}
          onSaveDrawer={onSaveDrawer}
          onAdd={() => {
            const nextItem = createEmptyProjectEntry();
            setContent((prev) => ({ ...prev, projects: [...prev.projects, nextItem] }));
            openOnlyDrawer('projects', getDrawerKey('projects', nextItem.id));
          }}
          onDelete={(id) =>
            setContent((prev) => ({
              ...prev,
              projects: prev.projects.length === 1 ? [resetItemValues(prev.projects[0])] : prev.projects.filter((entry) => entry.id !== id),
            }))
          }
          onChange={(id, key, value) =>
            setContent((prev) => ({
              ...prev,
              projects: updateItemField(prev.projects, id, key, value),
            }))
          }
          onDateChange={(id, key, value) => {
            setHighlightedSections((prev) => prev.filter((entry) => entry !== 'projects'));
            setContent((prev) => ({
              ...prev,
              projects: updateItemField(prev.projects, id, key, value),
            }));
          }}
          optimizingEntryKey={optimizingEntryKey}
          onOptimize={onOptimizeEntry}
          getSuggestions={getEntrySuggestions}
          getUndoHandler={getUndoHandler}
          primaryFieldLabel="项目名称"
        />
      );
    case 'selfEvaluation': {
      const drawerKey = getDrawerKey('selfEvaluation');
      const suggestionState = getEntrySuggestions('selfEvaluation');
      return (
        <DrawerCard
          title="个人评价"
          open={isDrawerOpen(drawerKey)}
          onToggle={() => toggleDrawer(drawerKey)}
          onOptimize={() => void onOptimizeSection('selfEvaluation')}
          optimizing={optimizingSectionKey === drawerKey}
          onUndo={getUndoHandler('entry', 'selfEvaluation', 'section')}
          suggestions={suggestionState?.suggestions ?? []}
          suggestionsLoading={suggestionState?.loading ?? false}
          onSuggestionPick={(suggestion) => void onOptimizeSection('selfEvaluation', suggestion)}
          onSave={() => void onSaveDrawer(drawerKey)}
        >
          <FieldBlock label="总结内容">
            <ResumeRichTextEditor
              value={content.selfEvaluation}
              onChange={(value) => setContent((prev) => ({ ...prev, selfEvaluation: value }))}
              placeholder="支持加粗、项目符号、数字排序，用 3-5 句总结优势、方法论与岗位匹配度"
              preset="paragraph"
            />
          </FieldBlock>
        </DrawerCard>
      );
    }
    case 'awards':
      return (
        <div className="space-y-4">
          {content.awards.length ? (
            content.awards.map((item, index) => {
              const drawerKey = getDrawerKey('awards', item.id);
              return (
                <DrawerCard
                  key={item.id}
                  title={`荣誉奖项 ${index + 1}`}
                  open={isDrawerOpen(drawerKey)}
                  onToggle={() => toggleDrawer(drawerKey)}
                  onOptimize={() => void onOptimizeEntry('awards', item.id)}
                  optimizing={optimizingEntryKey === drawerKey}
                  onUndo={getUndoHandler('entry', 'awards', item.id)}
                  suggestions={getEntrySuggestions('awards', item.id)?.suggestions ?? []}
                  suggestionsLoading={getEntrySuggestions('awards', item.id)?.loading ?? false}
                  onSuggestionPick={(suggestion) => void onOptimizeEntry('awards', item.id, suggestion)}
                  onDelete={() =>
                    setContent((prev) => ({
                      ...prev,
                      awards: prev.awards.length === 1 ? [resetItemValues(prev.awards[0])] : prev.awards.filter((entry) => entry.id !== item.id),
                    }))
                  }
                  onSave={() => void onSaveDrawer(drawerKey)}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <FieldBlock label="奖项名称">
                      <Input value={item.title} onChange={(event) => setContent((prev) => ({ ...prev, awards: updateItemField(prev.awards, item.id, 'title', event.target.value) }))} className={fieldClassName} />
                    </FieldBlock>
                    <FieldBlock label="奖项级别">
                      <Input value={item.level} onChange={(event) => setContent((prev) => ({ ...prev, awards: updateItemField(prev.awards, item.id, 'level', event.target.value) }))} className={fieldClassName} placeholder="国家级 / 校级" />
                    </FieldBlock>
                    <FieldBlock label="获奖时间">
                      <Input type="month" value={item.awardDate} onChange={(event) => setContent((prev) => ({ ...prev, awards: updateItemField(prev.awards, item.id, 'awardDate', event.target.value) }))} className={fieldClassName} />
                    </FieldBlock>
                    <div className="hidden md:block" />
                    <FieldBlock label="补充说明" className="md:col-span-2">
                      <ResumeRichTextEditor
                        value={item.description}
                        onChange={(value) => setContent((prev) => ({ ...prev, awards: updateItemField(prev.awards, item.id, 'description', value) }))}
                        placeholder="支持项目符号、数字排序和加粗，可补充获奖背景、排名或成果"
                        preset="paragraph"
                      />
                    </FieldBlock>
                  </div>
                </DrawerCard>
              );
            })
          ) : (
            <EmptySectionBlock onClick={() => {
              const nextItem = createEmptyAwardEntry();
              setContent((prev) => ({ ...prev, awards: [nextItem] }));
              openOnlyDrawer('awards', getDrawerKey('awards', nextItem.id));
            }}>
              {SECTION_COPY.awards.emptyLabel}
            </EmptySectionBlock>
          )}
          <AddDrawerButton
            onClick={() => {
              const nextItem = createEmptyAwardEntry();
              setContent((prev) => ({ ...prev, awards: [...prev.awards, nextItem] }));
              openOnlyDrawer('awards', getDrawerKey('awards', nextItem.id));
            }}
          >
            {SECTION_COPY.awards.addLabel}
          </AddDrawerButton>
        </div>
      );
    case 'skills':
      return (
        <div className="space-y-4">
          {content.skills.map((item, index) => {
            const drawerKey = getDrawerKey('skills', item.id);
            return (
              <DrawerCard
                key={item.id}
                title={`专业技能 ${index + 1}`}
                open={isDrawerOpen(drawerKey)}
                onToggle={() => toggleDrawer(drawerKey)}
                onOptimize={() => void onOptimizeEntry('skills', item.id)}
                optimizing={optimizingEntryKey === drawerKey}
                onUndo={getUndoHandler('entry', 'skills', item.id)}
                suggestions={getEntrySuggestions('skills', item.id)?.suggestions ?? []}
                suggestionsLoading={getEntrySuggestions('skills', item.id)?.loading ?? false}
                onSuggestionPick={(suggestion) => void onOptimizeEntry('skills', item.id, suggestion)}
                onDelete={() =>
                  setContent((prev) => ({
                    ...prev,
                    skills: prev.skills.length === 1 ? [resetItemValues(prev.skills[0])] : prev.skills.filter((entry) => entry.id !== item.id),
                  }))
                }
                onSave={() => void onSaveDrawer(drawerKey)}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldBlock label="技能分类">
                    <Input value={item.category} onChange={(event) => setContent((prev) => ({ ...prev, skills: updateItemField(prev.skills, item.id, 'category', event.target.value) }))} className={fieldClassName} placeholder="例如：前端 / 数据分析" />
                  </FieldBlock>
                  <div className="hidden md:block" />
                  <FieldBlock label="技能内容" className="md:col-span-2">
                    <ResumeRichTextEditor
                      value={item.content}
                      onChange={(value) => setContent((prev) => ({ ...prev, skills: updateItemField(prev.skills, item.id, 'content', value) }))}
                      placeholder="支持项目符号、数字排序和加粗，例如 React、SQL、Python、建模能力"
                      preset="list"
                    />
                  </FieldBlock>
                </div>
              </DrawerCard>
            );
          })}
          <AddDrawerButton
            onClick={() => {
              const nextItem = createEmptySkillEntry();
              setContent((prev) => ({ ...prev, skills: [...prev.skills, nextItem] }));
              openOnlyDrawer('skills', getDrawerKey('skills', nextItem.id));
            }}
          >
            {SECTION_COPY.skills.addLabel}
          </AddDrawerButton>
        </div>
      );
    case 'languages':
      return (
        <div className="space-y-4">
          {content.languages.length ? (
            content.languages.map((item, index) => {
              const drawerKey = getDrawerKey('languages', item.id);
              return (
                <DrawerCard
                  key={item.id}
                  title={`语言能力 ${index + 1}`}
                  open={isDrawerOpen(drawerKey)}
                  onToggle={() => toggleDrawer(drawerKey)}
                  onOptimize={() => void onOptimizeEntry('languages', item.id)}
                  optimizing={optimizingEntryKey === drawerKey}
                  onUndo={getUndoHandler('entry', 'languages', item.id)}
                  suggestions={getEntrySuggestions('languages', item.id)?.suggestions ?? []}
                  suggestionsLoading={getEntrySuggestions('languages', item.id)?.loading ?? false}
                  onSuggestionPick={(suggestion) => void onOptimizeEntry('languages', item.id, suggestion)}
                  onDelete={() =>
                    setContent((prev) => ({
                      ...prev,
                      languages: prev.languages.length === 1 ? [resetItemValues(prev.languages[0])] : prev.languages.filter((entry) => entry.id !== item.id),
                    }))
                  }
                  onSave={() => void onSaveDrawer(drawerKey)}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <FieldBlock label="语言">
                      <Input value={item.language} onChange={(event) => setContent((prev) => ({ ...prev, languages: updateItemField(prev.languages, item.id, 'language', event.target.value) }))} className={fieldClassName} />
                    </FieldBlock>
                    <FieldBlock label="成绩 / 等级">
                      <Input value={item.score} onChange={(event) => setContent((prev) => ({ ...prev, languages: updateItemField(prev.languages, item.id, 'score', event.target.value) }))} className={fieldClassName} placeholder="例如：雅思 7.5 / CET-6" />
                    </FieldBlock>
                    <FieldBlock label="补充说明" className="md:col-span-2">
                      <ResumeRichTextEditor
                        value={item.description}
                        onChange={(value) => setContent((prev) => ({ ...prev, languages: updateItemField(prev.languages, item.id, 'description', value) }))}
                        placeholder="可补充口语、书写、工作语言场景"
                        preset="paragraph"
                      />
                    </FieldBlock>
                  </div>
                </DrawerCard>
              );
            })
          ) : (
            <EmptySectionBlock
              onClick={() => {
                const nextItem = createEmptyLanguageEntry();
                setContent((prev) => ({ ...prev, languages: [nextItem] }));
                openOnlyDrawer('languages', getDrawerKey('languages', nextItem.id));
              }}
            >
              新增第一项语言能力
            </EmptySectionBlock>
          )}
          <AddDrawerButton
            onClick={() => {
              const nextItem = createEmptyLanguageEntry();
              setContent((prev) => ({ ...prev, languages: [...prev.languages, nextItem] }));
              openOnlyDrawer('languages', getDrawerKey('languages', nextItem.id));
            }}
          >
            + 新增语言能力
          </AddDrawerButton>
        </div>
      );
    case 'campusRoles':
      return (
        <ExperienceEditorSection
          sectionId="campusRoles"
          title="校园经历"
          itemLabel="校园经历"
          items={content.campusRoles}
          addLabel="+ 新增校园经历"
          isDrawerOpen={isDrawerOpen}
          toggleDrawer={toggleDrawer}
          onSaveDrawer={onSaveDrawer}
          onAdd={() => {
            const nextItem = createEmptyCampusRoleEntry();
            setContent((prev) => ({ ...prev, campusRoles: [...prev.campusRoles, nextItem] }));
            openOnlyDrawer('campusRoles', getDrawerKey('campusRoles', nextItem.id));
          }}
          onDelete={(id) =>
            setContent((prev) => ({
              ...prev,
              campusRoles: prev.campusRoles.length === 1 ? [resetItemValues(prev.campusRoles[0])] : prev.campusRoles.filter((entry) => entry.id !== id),
            }))
          }
          onChange={(id, key, value) =>
            setContent((prev) => ({
              ...prev,
              campusRoles: updateItemField(prev.campusRoles, id, key, value),
            }))
          }
          onDateChange={(id, key, value) =>
            setContent((prev) => ({
              ...prev,
              campusRoles: updateItemField(prev.campusRoles, id, key, value),
            }))
          }
          optimizingEntryKey={optimizingEntryKey}
          onOptimize={onOptimizeEntry}
          getSuggestions={getEntrySuggestions}
          getUndoHandler={getUndoHandler}
          primaryFieldLabel="组织 / 社团"
        />
      );
    case 'links':
      return (
        <div className="space-y-4">
          {content.links.length ? (
            content.links.map((item, index) => {
              const drawerKey = getDrawerKey('links', item.id);
              return (
                <DrawerCard
                  key={item.id}
                  title={`作品集 ${index + 1}`}
                  open={isDrawerOpen(drawerKey)}
                  onToggle={() => toggleDrawer(drawerKey)}
                  onDelete={() =>
                    setContent((prev) => ({
                      ...prev,
                      links: prev.links.length === 1 ? [resetItemValues(prev.links[0])] : prev.links.filter((entry) => entry.id !== item.id),
                    }))
                  }
                  onSave={() => void onSaveDrawer(drawerKey)}
                >
                  <div className="grid gap-3">
                    <FieldBlock label="链接名称">
                      <Input value={item.label} onChange={(event) => setContent((prev) => ({ ...prev, links: updateItemField(prev.links, item.id, 'label', event.target.value) }))} className={fieldClassName} placeholder="例如：个人主页 / Github / 作品集" />
                    </FieldBlock>
                    <FieldBlock label="链接地址">
                      <Input value={item.url} onChange={(event) => setContent((prev) => ({ ...prev, links: updateItemField(prev.links, item.id, 'url', event.target.value) }))} className={fieldClassName} placeholder="请输入完整 URL" />
                    </FieldBlock>
                  </div>
                </DrawerCard>
              );
            })
          ) : (
            <EmptySectionBlock
              onClick={() => {
                const nextItem = createEmptyLinkEntry();
                setContent((prev) => ({ ...prev, links: [nextItem] }));
                openOnlyDrawer('links', getDrawerKey('links', nextItem.id));
              }}
            >
              新增第一条作品集链接
            </EmptySectionBlock>
          )}
          <AddDrawerButton
            onClick={() => {
              const nextItem = createEmptyLinkEntry();
              setContent((prev) => ({ ...prev, links: [...prev.links, nextItem] }));
              openOnlyDrawer('links', getDrawerKey('links', nextItem.id));
            }}
          >
            + 新增作品集链接
          </AddDrawerButton>
        </div>
      );
    default:
      return null;
  }
}

function ExperienceEditorSection<T extends {
  id: string;
  roleName: string;
  city?: string;
  startDate: string;
  endDate: string;
  description: string;
  companyName?: string;
  projectName?: string;
  organization?: string;
}>({
  sectionId,
  title,
  itemLabel,
  items,
  addLabel,
  primaryFieldLabel,
  isDrawerOpen,
  toggleDrawer,
  onSaveDrawer,
  onAdd,
  onDelete,
  onChange,
  onDateChange,
  optimizingEntryKey,
  onOptimize,
  getSuggestions,
  getUndoHandler,
}: {
  sectionId: 'internships' | 'projects' | 'campusRoles';
  title: string;
  itemLabel: string;
  items: T[];
  addLabel: string;
  primaryFieldLabel: string;
  isDrawerOpen: (drawerKey: string) => boolean;
  toggleDrawer: (drawerKey: string) => void;
  onSaveDrawer: (drawerKey: string) => Promise<void>;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onChange: (id: string, key: keyof T, value: string) => void;
  onDateChange: (id: string, key: keyof T, value: string) => void;
  optimizingEntryKey: string | null;
  onOptimize: (sectionId: ResumeAiOptimizeEntrySectionId, entryId: string, selectedSuggestion?: string) => Promise<void>;
  getSuggestions: (sectionId: ResumeAiOptimizeEntrySectionId, entryId: string) => ResumeEntrySuggestionState | undefined;
  getUndoHandler: (scope: ResumeAiUndoScope, sectionId?: SupportedSectionId, entryId?: string) => (() => void) | undefined;
}) {
  const primaryKey = (sectionId === 'projects' ? 'projectName' : sectionId === 'campusRoles' ? 'organization' : 'companyName') as keyof T;

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const drawerKey = getDrawerKey(sectionId, item.id);
        const suggestionState = getSuggestions(sectionId, item.id);
        return (
          <DrawerCard
            key={item.id}
            title={`${title} ${index + 1}`}
            open={isDrawerOpen(drawerKey)}
            onToggle={() => toggleDrawer(drawerKey)}
            onOptimize={() => void onOptimize(sectionId, item.id)}
            optimizing={optimizingEntryKey === drawerKey}
            onUndo={getUndoHandler('entry', sectionId, item.id)}
            suggestions={suggestionState?.suggestions ?? []}
            suggestionsLoading={suggestionState?.loading ?? false}
            onSuggestionPick={(suggestion: string) => void onOptimize(sectionId, item.id, suggestion)}
            onDelete={() => onDelete(item.id)}
            onSave={() => void onSaveDrawer(drawerKey)}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <FieldBlock label={primaryFieldLabel}>
                <Input value={String(item[primaryKey] ?? '')} onChange={(event) => onChange(item.id, primaryKey, event.target.value)} className={fieldClassName} />
              </FieldBlock>
              <FieldBlock label="职位 / 角色">
                <Input value={item.roleName} onChange={(event) => onChange(item.id, 'roleName' as keyof T, event.target.value)} className={fieldClassName} />
              </FieldBlock>
              <FieldBlock label="所在城市">
                <Input value={item.city} onChange={(event) => onChange(item.id, 'city' as keyof T, event.target.value)} className={fieldClassName} placeholder="请输入城市" />
              </FieldBlock>
              <DateRangeFields startDate={item.startDate} endDate={item.endDate} onStartChange={(value) => onDateChange(item.id, 'startDate' as keyof T, value)} onEndChange={(value) => onDateChange(item.id, 'endDate' as keyof T, value)} />
              <FieldBlock label={`${itemLabel}描述`} className="md:col-span-2">
                <ResumeRichTextEditor
                  value={item.description}
                  onChange={(value) => onChange(item.id, 'description' as keyof T, value)}
                  placeholder="支持项目符号、数字排序和加粗，建议按成果点分条表达"
                  preset="list"
                />
              </FieldBlock>
            </div>
          </DrawerCard>
        );
      })}
      <AddDrawerButton onClick={onAdd}>{addLabel}</AddDrawerButton>
    </div>
  );
}

function DrawerCard({
  title,
  open,
  onToggle,
  onOptimize,
  optimizing = false,
  onUndo,
  suggestions = [],
  suggestionsLoading: _suggestionsLoading = false,
  onSuggestionPick,
  onDelete,
  onSave,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  onOptimize?: () => void;
  optimizing?: boolean;
  onUndo?: () => void;
  suggestions?: string[];
  suggestionsLoading?: boolean;
  onSuggestionPick?: (suggestion: string) => void;
  onDelete?: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[#E5E6EB] bg-white">
      <div className="flex items-center justify-between gap-3 bg-[#F7F8FA] px-4 py-3">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <div className="flex items-center gap-1.5">
          {onOptimize ? (
            <button
              type="button"
              onClick={onOptimize}
              disabled={optimizing}
              data-resume-guest-block="true"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-transparent px-2.5 text-xs text-brand transition hover:border-brand/20 hover:bg-brand/10 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <Wand2 className="h-3.5 w-3.5" />
              {optimizing ? '优化中...' : 'AI优化'}
            </button>
          ) : null}
          {onDelete ? (
            <IconButton label={`清空 ${title}`} onClick={onDelete} guestBlocked>
              <Trash2 className="h-4 w-4 text-slate-500" />
            </IconButton>
          ) : null}
          <IconButton label={open ? `收起 ${title}` : `展开 ${title}`} onClick={onToggle}>
            {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </IconButton>
        </div>
      </div>
      {open ? (
        <div className="space-y-4 px-4 py-4">
          {children}
          {onSuggestionPick ? (
            <div className="rounded-xl border border-brand/40 bg-white p-3 shadow-[0_10px_28px_rgba(65,131,255,0.08)] transition hover:border-brand/60 hover:bg-brand/5 hover:shadow-[0_14px_36px_rgba(65,131,255,0.12)]">
              <p className="text-xs font-semibold text-brand">AI优化建议</p>
              {(_suggestionsLoading || optimizing) ? (
                <p className="mt-3 text-xs text-brand/80">正在基于当前已保存内容生成 2-3 条优化建议...</p>
              ) : suggestions.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => onSuggestionPick(suggestion)}
                      data-resume-guest-block="true"
                      className="rounded-full border border-brand/40 bg-white px-3 py-1.5 text-xs text-brand transition hover:border-brand/60 hover:bg-brand/10"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-brand/80">保存当前模块后，系统会自动评估并展示优化方向。</p>
              )}
            </div>
          ) : null}
          <div className="flex justify-end gap-3">
            {onUndo ? (
              <button
                type="button"
                onClick={onUndo}
                data-resume-guest-block="true"
                className="inline-flex h-9 items-center rounded-md border border-[#D8DEE8] px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                撤回还原
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSave}
              data-resume-guest-block="true"
              className="inline-flex h-9 items-center rounded-md bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand-dark"
            >
              保存
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  guestBlocked = false,
  children,
}: {
  label: string;
  onClick: () => void;
  guestBlocked?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      data-resume-guest-block={guestBlocked ? 'true' : undefined}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-400 transition hover:border-[#E5E6EB] hover:bg-[#F0F1F3] hover:text-slate-600"
    >
      {children}
    </button>
  );
}

function AddDrawerButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-resume-guest-block="true"
      className="flex w-full items-center justify-center rounded-md border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-4 py-3 text-sm text-slate-600 transition hover:border-brand hover:bg-brand/10 hover:text-brand"
    >
      {children}
    </button>
  );
}

function EmptySectionBlock({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-resume-guest-block="true"
      className="flex h-32 w-full items-center justify-center rounded-md border border-dashed border-[#D1D5DB] bg-[#F9FAFB] text-sm text-slate-600 transition hover:border-brand hover:bg-brand/10 hover:text-brand"
    >
      {children}
    </button>
  );
}

function FieldBlock({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-xs text-slate-500">{label}</p>
      {children}
    </div>
  );
}

function ImageUploadField({
  value,
  previewUrl,
  onChange,
  emptyLabel,
  scene,
  bizId,
  token,
}: {
  value: string;
  previewUrl?: string;
  onChange: (payload: { objectKey: string; previewUrl: string }) => void;
  emptyLabel: string;
  scene: (typeof OSS_IMAGE_UPLOAD_SCENES)[keyof typeof OSS_IMAGE_UPLOAD_SCENES];
  bizId?: string;
  token: string | null;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cropState, setCropState] = useState<AvatarCropState | null>(null);
  const cropConfig = IMAGE_CROP_CONFIGS[scene];

  const closeCropModal = useCallback(() => {
    setCropState((current) => {
      if (current) {
        URL.revokeObjectURL(current.sourceUrl);
      }
      return null;
    });
  }, []);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    let imageMeta: { width: number; height: number } | undefined;

    if (!file.type.startsWith('image/')) {
      showToast('请上传图片格式文件');
      return;
    }

    try {
      if (cropConfig) {
        const { width, height } = await readImageDimensions(file);
        const sourceUrl = URL.createObjectURL(file);
        setCropState((current) => {
          if (current) {
            URL.revokeObjectURL(current.sourceUrl);
          }
          return createInitialImageCropState(file, sourceUrl, width, height, cropConfig);
        });
        return;
      }

      if (!token) {
        showToast(COMMON_TOAST_COPY.loginRequired);
        return;
      }

      setUploading(true);
      const session = await requestOssUploadSession({ token, scene, file, bizId, imageMeta });
      const { signedUrl: uploadedPreviewUrl } = await sharedUploadFileToOss(session, file);
      onChange({
        objectKey: session.objectKey,
        previewUrl: uploadedPreviewUrl,
      });
      showToast(RESUME_TOAST_COPY.imageUploaded, 'success');
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : '图片上传失败';
      if (errorMessage.includes('OSS 暂未完成环境配置')) {
        errorMessage = `上传环境未配置完成：${errorMessage.replace(/^.*?(OSS 暂未完成环境配置)/, '$1')}`;
      } else if (errorMessage.includes('SignatureDoesNotMatch')) {
        errorMessage = 'OSS 签名不匹配：请检查 STS 凭证、地域、Bucket 与 Endpoint 配置是否一致';
      } else if (errorMessage.includes('AccessDenied')) {
        errorMessage = 'OSS 权限不足：请检查 RAM 角色、Bucket 写入权限及 STS 授权策略';
      } else if (errorMessage.includes('InvalidAccessKeyId') || errorMessage.includes('SecurityToken')) {
        errorMessage = 'OSS 认证信息无效：请检查 AccessKey、STS 临时凭证和过期时间';
      } else if (errorMessage.includes('etag of expose-headers')) {
        errorMessage = 'OSS 跨域配置错误：请在阿里云后台将 ETag 加入“暴露 Headers (Expose Headers)”中';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network Error')) {
        errorMessage = '网络或跨域错误：请检查 OSS 跨域配置的“来源”是否包含 http://localhost:13000';
      }
      showToast(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleCropConfirm = useCallback(async () => {
    if (!cropState) {
      return;
    }
    if (!token) {
      showToast(COMMON_TOAST_COPY.loginRequired);
      return;
    }

    setUploading(true);
    try {
      const croppedFile = await buildCroppedImageFile(cropState);
      const imageMeta = {
        width: cropState.cropConfig.outputWidth,
        height: cropState.cropConfig.outputHeight,
      };
      const session = await requestOssUploadSession({
        token,
        scene,
        file: croppedFile,
        bizId,
        imageMeta,
      });
      const { signedUrl: uploadedPreviewUrl } = await sharedUploadFileToOss(session, croppedFile);
      onChange({
        objectKey: session.objectKey,
        previewUrl: uploadedPreviewUrl,
      });
      closeCropModal();
      showToast(cropState.cropConfig.successMessage, 'success');
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : '图片上传失败';
      if (errorMessage.includes('OSS 暂未完成环境配置')) {
        errorMessage = `上传环境未配置完成：${errorMessage.replace(/^.*?(OSS 暂未完成环境配置)/, '$1')}`;
      } else if (errorMessage.includes('SignatureDoesNotMatch')) {
        errorMessage = 'OSS 签名不匹配：请检查 STS 凭证、地域、Bucket 与 Endpoint 配置是否一致';
      } else if (errorMessage.includes('AccessDenied')) {
        errorMessage = 'OSS 权限不足：请检查 RAM 角色、Bucket 写入权限及 STS 授权策略';
      } else if (errorMessage.includes('InvalidAccessKeyId') || errorMessage.includes('SecurityToken')) {
        errorMessage = 'OSS 认证信息无效：请检查 AccessKey、STS 临时凭证和过期时间';
      } else if (errorMessage.includes('etag of expose-headers')) {
        errorMessage = 'OSS 跨域配置错误：请在阿里云后台将 ETag 加入“暴露 Headers (Expose Headers)”中';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network Error')) {
        errorMessage = '网络或跨域错误：请检查 OSS 跨域配置的“来源”是否包含 http://localhost:13000';
      }
      showToast(errorMessage);
    } finally {
      setUploading(false);
    }
  }, [bizId, closeCropModal, cropState, onChange, scene, token]);

  const displayValue = previewUrl || (isDirectPreviewValue(value) ? value : '');

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (uploading) {
              return;
            }
            inputRef.current?.click();
          }}
          disabled={uploading}
          data-resume-guest-block="true"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-dashed border-[#D1D5DB] bg-white px-3 text-sm text-slate-600 transition hover:border-brand hover:bg-brand/10 hover:text-brand"
        >
          {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span>{uploading ? '上传中...' : value ? '重新上传' : emptyLabel}</span>
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange({ objectKey: '', previewUrl: '' })}
            disabled={uploading}
            data-resume-guest-block="true"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E6EB] bg-white text-slate-500 transition hover:border-[#FF734A] hover:text-[#FF734A]"
            aria-label="移除图片"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {cropConfig ? <p className="text-xs leading-5 text-slate-500">{cropConfig.helperText}</p> : null}
      <div
        className="flex items-center justify-center overflow-hidden rounded-2xl border border-[#E5E6EB] bg-[#F9FAFB] shadow-sm"
        style={{
          width: '80px',
          aspectRatio: cropConfig?.previewAspectRatio ?? '1 / 1',
        }}
      >
        {displayValue ? (<>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayValue} alt="上传预览" className="h-full w-full object-cover" style={{ objectPosition: cropConfig?.previewObjectPosition ?? 'center' }} />
        </>) : <ImageIcon className="h-6 w-6 text-slate-400" aria-hidden="true" />}
      </div>
      {cropState ? (
        <ImageCropModal
          cropState={cropState}
          uploading={uploading}
          onChange={setCropState}
          onCancel={closeCropModal}
          onConfirm={() => void handleCropConfirm()}
        />
      ) : null}
    </div>
  );
}

function ImageCropModal({
  cropState,
  uploading,
  onChange,
  onCancel,
  onConfirm,
}: {
  cropState: AvatarCropState;
  uploading: boolean;
  onChange: Dispatch<SetStateAction<AvatarCropState | null>>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<AvatarCropInteraction | null>(null);
  const previewSize = getImageCropPreviewSize(cropState);
  const cropRect = getImageCropRect(cropState);
  const previewScale = previewSize.width / cropState.imageWidth;

  const updateCropState = useCallback(
    (updater: (current: AvatarCropState) => AvatarCropState) => {
      onChange((current) => (current ? clampImageCropState(updater(current)) : current));
    },
    [onChange],
  );

  const startInteraction = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, handle: AvatarCropHandle) => {
      event.preventDefault();
      event.stopPropagation();
      stageRef.current?.setPointerCapture(event.pointerId);
      interactionRef.current = {
        pointerId: event.pointerId,
        handle,
        startClientX: event.clientX,
        startClientY: event.clientY,
        cropRect,
      };
    },
    [cropRect],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = (event.clientX - interaction.startClientX) / previewScale;
      const deltaY = (event.clientY - interaction.startClientY) / previewScale;

      updateCropState((current) => {
        if (interaction.handle === 'move') {
          return {
            ...current,
            cropX: interaction.cropRect.x + deltaX,
            cropY: interaction.cropRect.y + deltaY,
          };
        }

        return resizeImageCropFromHandle(current, interaction, deltaX, deltaY);
      });
    },
    [previewScale, updateCropState],
  );

  const stopDragging = useCallback((event?: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction) {
      return;
    }
    if (event && interaction.pointerId !== event.pointerId) {
      return;
    }
    if (stageRef.current?.hasPointerCapture(interaction.pointerId)) {
      stageRef.current.releasePointerCapture(interaction.pointerId);
    }
    interactionRef.current = null;
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">{cropState.cropConfig.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{cropState.cropConfig.description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E6EB] text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="关闭裁剪弹窗"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex flex-1 justify-center">
            <div className="flex min-h-[420px] w-full items-center justify-center rounded-[24px] bg-[#0F172A] p-4">
              <div
                ref={stageRef}
                className="relative select-none overflow-hidden rounded-[20px]"
                style={{
                  width: `${previewSize.width}px`,
                  height: `${previewSize.height}px`,
                  touchAction: 'none',
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDragging}
                onPointerCancel={stopDragging}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cropState.sourceUrl}
                  alt="图片裁剪预览"
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
                />
                <div
                  role="presentation"
                  className="absolute rounded-[20px] border-2 border-white/90"
                  style={{
                    left: `${cropRect.x * previewScale}px`,
                    top: `${cropRect.y * previewScale}px`,
                    width: `${cropRect.width * previewScale}px`,
                    height: `${cropRect.height * previewScale}px`,
                    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.48)',
                  }}
                >
                  <div className="absolute inset-[10px] cursor-move" onPointerDown={(event) => startInteraction(event, 'move')} />
                  <div className="absolute -left-2 -top-2 h-4 w-4 cursor-nwse-resize" onPointerDown={(event) => startInteraction(event, 'top-left')} />
                  <div className="absolute -right-2 -top-2 h-4 w-4 cursor-nesw-resize" onPointerDown={(event) => startInteraction(event, 'top-right')} />
                  <div className="absolute -bottom-2 -left-2 h-4 w-4 cursor-nesw-resize" onPointerDown={(event) => startInteraction(event, 'bottom-left')} />
                  <div className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize" onPointerDown={(event) => startInteraction(event, 'bottom-right')} />
                  <div className="absolute inset-x-3 -top-2 h-4 cursor-ns-resize" onPointerDown={(event) => startInteraction(event, 'top')} />
                  <div className="absolute inset-x-3 -bottom-2 h-4 cursor-ns-resize" onPointerDown={(event) => startInteraction(event, 'bottom')} />
                  <div className="absolute inset-y-3 -left-2 w-4 cursor-ew-resize" onPointerDown={(event) => startInteraction(event, 'left')} />
                  <div className="absolute inset-y-3 -right-2 w-4 cursor-ew-resize" onPointerDown={(event) => startInteraction(event, 'right')} />
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/35" />
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/35" />
                  <div className="pointer-events-none absolute left-1/2 top-0 h-3 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-white/85" />
                  <div className="pointer-events-none absolute bottom-0 left-1/2 h-3 w-8 -translate-x-1/2 translate-y-1/2 rounded-full border border-white/90 bg-white/85" />
                  <div className="pointer-events-none absolute left-0 top-1/2 h-8 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-white/85" />
                  <div className="pointer-events-none absolute right-0 top-1/2 h-8 w-3 translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-white/85" />
                  <div className="pointer-events-none absolute left-0 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-white" />
                  <div className="pointer-events-none absolute right-0 top-0 h-3 w-3 translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-white" />
                  <div className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full border border-white/90 bg-white" />
                  <div className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 translate-x-1/2 translate-y-1/2 rounded-full border border-white/90 bg-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[280px]">
            <div className="rounded-2xl bg-[#F8FAFC] p-4">
              <p className="text-sm font-medium text-slate-900">交互说明</p>
              <p className="mt-3 text-xs leading-6 text-slate-500">
                裁剪框比例固定不变。
                <br />
                拖动中间区域可移动位置。
                <br />
                鼠标移到边缘或角点后按住拖动，可同比例放大或缩小裁剪框。
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={uploading}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#D8DEE8] px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={uploading}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? '上传中...' : '确认并上传'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function clampImageCropState(state: AvatarCropState) {
  const cropScale = clampNumber(state.cropScale, state.cropConfig.minScale, state.cropConfig.maxScale);
  const { width, height } = getImageCropRectSize(state.cropConfig, state.imageWidth, state.imageHeight, cropScale);
  return {
    ...state,
    cropScale,
    cropX: clampNumber(state.cropX, 0, Math.max(state.imageWidth - width, 0)),
    cropY: clampNumber(state.cropY, 0, Math.max(state.imageHeight - height, 0)),
  };
}

function getImageCropPreviewSize(state: AvatarCropState) {
  const scale = Math.min(AVATAR_CROP_STAGE_MAX_WIDTH / state.imageWidth, AVATAR_CROP_STAGE_MAX_HEIGHT / state.imageHeight);
  return {
    width: state.imageWidth * scale,
    height: state.imageHeight * scale,
  };
}

function getImageCropRectSize(cropConfig: ImageCropConfig, imageWidth: number, imageHeight: number, cropScale: number) {
  const normalizedScale = clampNumber(cropScale, cropConfig.minScale, cropConfig.maxScale);
  const targetRatio = cropConfig.targetRatio;

  if (imageWidth / imageHeight >= targetRatio) {
    const maxHeight = imageHeight;
    return {
      width: maxHeight * targetRatio * normalizedScale,
      height: maxHeight * normalizedScale,
    };
  }

  const maxWidth = imageWidth;
  return {
    width: maxWidth * normalizedScale,
    height: (maxWidth / targetRatio) * normalizedScale,
  };
}

function getImageCropRect(state: AvatarCropState) {
  const normalizedState = clampImageCropState(state);
  const { width, height } = getImageCropRectSize(
    normalizedState.cropConfig,
    normalizedState.imageWidth,
    normalizedState.imageHeight,
    normalizedState.cropScale,
  );
  return {
    x: normalizedState.cropX,
    y: normalizedState.cropY,
    width,
    height,
  };
}

function resizeImageCropFromHandle(
  state: AvatarCropState,
  interaction: AvatarCropInteraction,
  deltaX: number,
  deltaY: number,
) {
  const { cropRect, handle } = interaction;
  const maxSize = getImageCropRectSize(state.cropConfig, state.imageWidth, state.imageHeight, state.cropConfig.maxScale);
  const centerX = cropRect.x + cropRect.width / 2;
  const centerY = cropRect.y + cropRect.height / 2;

  switch (handle) {
    case 'left': {
      const nextScale = clampNumber((cropRect.width - deltaX) / maxSize.width, state.cropConfig.minScale, state.cropConfig.maxScale);
      const nextSize = getImageCropRectSize(state.cropConfig, state.imageWidth, state.imageHeight, nextScale);
      return clampImageCropState({
        ...state,
        cropScale: nextScale,
        cropX: cropRect.x + cropRect.width - nextSize.width,
        cropY: centerY - nextSize.height / 2,
      });
    }
    case 'right': {
      const nextScale = clampNumber((cropRect.width + deltaX) / maxSize.width, state.cropConfig.minScale, state.cropConfig.maxScale);
      const nextSize = getImageCropRectSize(state.cropConfig, state.imageWidth, state.imageHeight, nextScale);
      return clampImageCropState({
        ...state,
        cropScale: nextScale,
        cropX: cropRect.x,
        cropY: centerY - nextSize.height / 2,
      });
    }
    case 'top': {
      const nextScale = clampNumber((cropRect.height - deltaY) / maxSize.height, state.cropConfig.minScale, state.cropConfig.maxScale);
      const nextSize = getImageCropRectSize(state.cropConfig, state.imageWidth, state.imageHeight, nextScale);
      return clampImageCropState({
        ...state,
        cropScale: nextScale,
        cropX: centerX - nextSize.width / 2,
        cropY: cropRect.y + cropRect.height - nextSize.height,
      });
    }
    case 'bottom': {
      const nextScale = clampNumber((cropRect.height + deltaY) / maxSize.height, state.cropConfig.minScale, state.cropConfig.maxScale);
      const nextSize = getImageCropRectSize(state.cropConfig, state.imageWidth, state.imageHeight, nextScale);
      return clampImageCropState({
        ...state,
        cropScale: nextScale,
        cropX: centerX - nextSize.width / 2,
        cropY: cropRect.y,
      });
    }
    case 'top-left': {
      const nextScale = getImageCropScaleFromCandidates(state, cropRect.width - deltaX, cropRect.height - deltaY);
      const nextSize = getImageCropRectSize(state.cropConfig, state.imageWidth, state.imageHeight, nextScale);
      return clampImageCropState({
        ...state,
        cropScale: nextScale,
        cropX: cropRect.x + cropRect.width - nextSize.width,
        cropY: cropRect.y + cropRect.height - nextSize.height,
      });
    }
    case 'top-right': {
      const nextScale = getImageCropScaleFromCandidates(state, cropRect.width + deltaX, cropRect.height - deltaY);
      const nextSize = getImageCropRectSize(state.cropConfig, state.imageWidth, state.imageHeight, nextScale);
      return clampImageCropState({
        ...state,
        cropScale: nextScale,
        cropX: cropRect.x,
        cropY: cropRect.y + cropRect.height - nextSize.height,
      });
    }
    case 'bottom-left': {
      const nextScale = getImageCropScaleFromCandidates(state, cropRect.width - deltaX, cropRect.height + deltaY);
      const nextSize = getImageCropRectSize(state.cropConfig, state.imageWidth, state.imageHeight, nextScale);
      return clampImageCropState({
        ...state,
        cropScale: nextScale,
        cropX: cropRect.x + cropRect.width - nextSize.width,
        cropY: cropRect.y,
      });
    }
    case 'bottom-right': {
      const nextScale = getImageCropScaleFromCandidates(state, cropRect.width + deltaX, cropRect.height + deltaY);
      return clampImageCropState({
        ...state,
        cropScale: nextScale,
        cropX: cropRect.x,
        cropY: cropRect.y,
      });
    }
    default:
      return state;
  }
}

function getImageCropScaleFromCandidates(state: AvatarCropState, nextWidth: number, nextHeight: number) {
  const maxSize = getImageCropRectSize(state.cropConfig, state.imageWidth, state.imageHeight, state.cropConfig.maxScale);
  return clampNumber(
    Math.max(nextWidth / maxSize.width, nextHeight / maxSize.height),
    state.cropConfig.minScale,
    state.cropConfig.maxScale,
  );
}

function createInitialImageCropState(
  file: File,
  sourceUrl: string,
  imageWidth: number,
  imageHeight: number,
  cropConfig: ImageCropConfig,
): AvatarCropState {
  const initialSize = getImageCropRectSize(cropConfig, imageWidth, imageHeight, cropConfig.defaultScale);
  return clampImageCropState({
    file,
    sourceUrl,
    imageWidth,
    imageHeight,
    cropConfig,
    cropScale: cropConfig.defaultScale,
    cropX: (imageWidth - initialSize.width) / 2,
    cropY: (imageHeight - initialSize.height) / 2,
  });
}

async function buildCroppedImageFile(state: AvatarCropState) {
  const image = await loadImageElement(state.sourceUrl);
  const cropRect = getImageCropRect(state);
  const canvas = document.createElement('canvas');
  canvas.width = state.cropConfig.outputWidth;
  canvas.height = state.cropConfig.outputHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('浏览器暂不支持图片裁剪，请更换浏览器后重试');
  }

  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('图片裁剪失败，请重新调整后再试'));
        return;
      }
      resolve(result);
    }, 'image/jpeg', 0.92);
  });

  const fileBaseName = state.file.name.replace(/\.[^.]+$/, '') || 'resume-avatar';
  return new File([blob], `${fileBaseName}-cropped.jpg`, { type: 'image/jpeg' });
}

async function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法读取图片内容，请更换图片后重试'));
    image.src = src;
  });
}

async function readImageDimensions(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('无法读取图片尺寸，请更换图片后重试'));
      image.src = objectUrl;
    });
    return dimensions;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function DateRangeFields({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 md:col-span-2">
      <FieldBlock label="开始时间">
        <Input type="month" value={startDate} onChange={(event) => onStartChange(event.target.value)} className={fieldClassName} />
      </FieldBlock>
      <FieldBlock label="结束时间">
        <Input type="month" value={endDate} onChange={(event) => onEndChange(event.target.value)} className={fieldClassName} />
      </FieldBlock>
    </div>
  );
}

function getSectionDataSummary(sectionId: ResumeSectionId, content: ResumeContent) {
  switch (sectionId) {
    case 'personal':
      return getSectionFilledCount('personal', content) ? '基础信息已建立' : '待完善';
    case 'education': {
      const count = getSectionFilledCount('education', content);
      return count ? `${count} 段内容` : '待完善';
    }
    case 'internships': {
      const count = getSectionFilledCount('internships', content);
      return count ? `${count} 段内容` : '待完善';
    }
    case 'projects': {
      const count = getSectionFilledCount('projects', content);
      return count ? `${count} 段内容` : '待完善';
    }
    case 'skills': {
      const count = getSectionFilledCount('skills', content);
      return count ? `${count} 条技能` : '待完善';
    }
    case 'awards': {
      const count = getSectionFilledCount('awards', content);
      return count ? `${count} 条奖项` : '待完善';
    }
    case 'selfEvaluation': {
      const plainText = getRichTextPlainText(content.selfEvaluation);
      return plainText ? `${plainText.length} 字` : '待完善';
    }
    default:
      return '待完善';
  }
}

function getModuleManagerLabel(sectionId: ResumeSectionId, sectionLabels?: ResumeContent['sectionLabels']) {
  if (sectionId !== 'personal') {
    return getSectionLabel(sectionId, sectionLabels);
  }
  return SECTION_COPY[sectionId as SupportedSectionId]?.drawerTitle ?? getSectionLabelFallback(sectionId);
}

function getSectionLabelFallback(sectionId: ResumeSectionId) {
  const labels: Record<ResumeSectionId, string> = {
    personal: '基本信息',
    education: '教育经历',
    internships: '实习经历',
    projects: '项目经历',
    skills: '专业技能',
    awards: '荣誉奖项',
    languages: '语言能力',
    campusRoles: '校园经历',
    selfEvaluation: '个人评价',
    links: '作品集',
  };
  return labels[sectionId];
}

function getHeaderVariantDisplayName(value: ResumeHeaderVariant) {
  const labels: Record<ResumeHeaderVariant, string> = {
    business: '商务',
    highlight: '突出',
    clear: '清晰',
    basic: '基础',
    formal: '正式',
    work: '工作',
  };
  return labels[value];
}

function getBasicInfoDisplayName(value: ResumeBasicInfoVariant) {
  const labels: Record<ResumeBasicInfoVariant, string> = {
    'text-line': '文字竖线',
    'icon-line': '图标竖线',
    'text-dot': '文字圆点',
    'icon-dot': '图标圆点',
  };
  return labels[value];
}

function getSectionTitleDisplayName(value: ResumeSectionTitleVariant) {
  const labels: Record<ResumeSectionTitleVariant, string> = {
    classic: '经典底线',
    'left-bar': '商务竖条',
    'pill-line': '胶囊拉线',
    'bg-block': '通栏色块',
  };
  return labels[value];
}

function getSkillDisplayName(value: ResumeSkillVariant) {
  const labels: Record<ResumeSkillVariant, string> = {
    list: '文字列表',
    'icon-grid': '图标宫格',
    'tag-list': '标签技能',
  };
  return labels[value];
}

function buildPaperPreviewBackground(value: ResumeStyleConfig['paperBackgroundVariant']) {
  switch (value) {
    case 'diamond-grid':
      return 'linear-gradient(45deg, rgba(120,130,150,0.18) 1px, transparent 1px), linear-gradient(-45deg, rgba(120,130,150,0.18) 1px, transparent 1px)';
    case 'arc-lines':
      return 'repeating-radial-gradient(circle at 86% 12%, transparent 0 8px, rgba(120,130,150,0.2) 9px 10px)';
    case 'wave-lines':
      return 'repeating-radial-gradient(ellipse at 88% 16%, transparent 0 9px, rgba(120,130,150,0.2) 10px 11px)';
    case 'vertical-wave':
      return 'repeating-radial-gradient(ellipse at 42% 0%, transparent 0 8px, rgba(120,130,150,0.18) 9px 10px)';
    case 'petal':
      return 'radial-gradient(ellipse at 20% 20%, transparent 0 22px, rgba(120,130,150,0.18) 23px 24px, transparent 25px), radial-gradient(ellipse at 78% 42%, transparent 0 22px, rgba(120,130,150,0.18) 23px 24px, transparent 25px)';
    case 'chevron':
      return 'linear-gradient(135deg, transparent 47%, rgba(120,130,150,0.18) 48% 50%, transparent 51%), linear-gradient(45deg, transparent 47%, rgba(120,130,150,0.18) 48% 50%, transparent 51%)';
    case 'geo-frame':
      return 'linear-gradient(30deg, transparent 44%, rgba(120,130,150,0.18) 45% 47%, transparent 48%), linear-gradient(150deg, transparent 44%, rgba(120,130,150,0.18) 45% 47%, transparent 48%)';
    case 'angle-grid':
      return 'linear-gradient(60deg, transparent 48%, rgba(120,130,150,0.18) 49% 50%, transparent 51%), linear-gradient(120deg, transparent 48%, rgba(120,130,150,0.18) 49% 50%, transparent 51%)';
    case 'none':
    default:
      return 'none';
  }
}

function buildResumeSnapshot(title: string, content: ResumeContent, styleConfig: ResumeStyleConfig, layout: ResumeLayoutItem[]) {
  return JSON.stringify({ title, content, styleConfig, layout });
}

function sortResumeContentByStartDate(content: ResumeContent): ResumeContent {
  return {
    ...content,
    education: sortEntriesByDateDesc(content.education),
    internships: sortEntriesByDateDesc(content.internships),
    projects: sortEntriesByDateDesc(content.projects),
  };
}

function updateItemField<T extends { id: string }, K extends keyof T>(list: T[], id: string, key: K, value: T[K]) {
  return list.map((item) => (item.id === id ? { ...item, [key]: value } : item));
}

function updateNumericStyle(
  setStyleConfig: Dispatch<SetStateAction<ResumeStyleConfig>>,
  key: keyof ResumeStyleConfig,
  value: string,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return;
  }
  const nextValue = clamp(parsed, min, max);
  setStyleConfig((prev) => sanitizeStyleConfig({ ...prev, [key]: nextValue }));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sanitizeStyleConfig(styleConfig: ResumeStyleConfig): ResumeStyleConfig {
  const normalized = normalizeResumeStyle({
    ...styleConfig,
    themeColor: normalizeThemeColor(styleConfig.themeColor),
  });
  return {
    ...normalized,
    themeColor: normalizeThemeColor(normalized.themeColor),
  };
}

function sanitizeLayoutItems(layout: ResumeLayoutItem[]) {
  const ordered: ResumeLayoutItem[] = [];
  const seen = new Set<ResumeSectionId>();

  layout.forEach((item) => {
    if (!SUPPORTED_SECTION_SET.has(item.id) || seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    ordered.push({
      id: item.id,
      visible: typeof item.visible === 'boolean' ? item.visible : true,
      deleted: Boolean(item.deleted),
    });
  });

  REFERENCE_LAYOUT_ORDER.forEach((id) => {
    if (!SUPPORTED_SECTION_SET.has(id) || seen.has(id)) {
      return;
    }
    seen.add(id);
    ordered.push({ id, visible: true, deleted: false });
  });

  const normalized = ordered.map((item) => {
    if (REQUIRED_SECTION_SET.has(item.id)) {
      return { ...item, visible: true, deleted: false };
    }
    return {
      ...item,
      visible: item.deleted ? false : item.visible !== false,
      deleted: item.deleted === true,
    };
  });

  const personalItem = normalized.find((item) => item.id === 'personal');
  if (!personalItem) {
    return normalized;
  }
  return [personalItem, ...normalized.filter((item) => item.id !== 'personal')];
}

function normalizeThemeColor(color: string) {
  const normalized = color?.trim();
  if (!normalized || !/^#([0-9a-fA-F]{6})$/.test(normalized)) {
    return BRAND_THEME;
  }
  return normalized;
}

function shrinkStyle(styleConfig: ResumeStyleConfig): ResumeStyleConfig {
  if (styleConfig.spacingScale > AUTO_FIT_LIMITS.spacingScale) {
    return sanitizeStyleConfig({
      ...styleConfig,
      spacingScale: Math.max(AUTO_FIT_LIMITS.spacingScale, Number((styleConfig.spacingScale - 0.05).toFixed(2))),
    });
  }
  if (styleConfig.fontSize > AUTO_FIT_LIMITS.fontSize) {
    return sanitizeStyleConfig({ ...styleConfig, fontSize: Math.max(AUTO_FIT_LIMITS.fontSize, styleConfig.fontSize - 0.5) });
  }
  if (styleConfig.pageMargin > AUTO_FIT_LIMITS.pageMargin) {
    return sanitizeStyleConfig({ ...styleConfig, pageMargin: styleConfig.pageMargin - 1 });
  }
  return styleConfig;
}

function isSameStyle(left: ResumeStyleConfig, right: ResumeStyleConfig) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function waitForDomPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function getDrawerKey(sectionId: ResumeSectionId, itemId = 'single') {
  return `${sectionId}:${itemId}`;
}

function getSuggestionDrawerKey(sectionId: ResumeSuggestionTargetSectionId, entryId = 'section') {
  if (sectionId === 'personalSummary') {
    return 'personalSummary:section';
  }
  return getDrawerKey(sectionId as ResumeSectionId, entryId);
}

function getSuggestionTargetFromDrawerKey(drawerKey: string): { sectionId: ResumeSuggestionTargetSectionId; entryId?: string } | null {
  const [sectionId, entryId] = drawerKey.split(':');
  if (!sectionId) {
    return null;
  }
  if (sectionId === 'personal') {
    return { sectionId: 'personalSummary' };
  }
  if (sectionId === 'selfEvaluation') {
    return { sectionId: 'selfEvaluation' };
  }
  if (
    sectionId === 'education'
    || sectionId === 'internships'
    || sectionId === 'projects'
    || sectionId === 'campusRoles'
    || sectionId === 'awards'
    || sectionId === 'languages'
    || sectionId === 'skills'
  ) {
    return entryId && entryId !== 'single'
      ? { sectionId: sectionId as ResumeAiOptimizeEntrySectionId, entryId }
      : null;
  }
  return null;
}

function mergeSuggestionLoadingState(
  previous: Record<string, ResumeEntrySuggestionState>,
  nextSuggestions: Record<string, ResumeEntrySuggestionState>,
) {
  const next = { ...nextSuggestions };
  Object.entries(previous).forEach(([key, value]) => {
    if (!next[key] && value.loading) {
      next[key] = { suggestions: [], loading: true };
    }
  });
  return next;
}

function clearSuggestionLoadingState(previous: Record<string, ResumeEntrySuggestionState>) {
  return Object.fromEntries(
    Object.entries(previous).map(([key, value]) => [key, { ...value, loading: false }]),
  ) as Record<string, ResumeEntrySuggestionState>;
}

function resetItemValues<T extends { id: string }>(item: T): T {
  const next = Object.fromEntries(
    Object.entries(item).map(([key, value]) => [key, key === 'id' ? value : typeof value === 'string' ? '' : value]),
  );
  return next as T;
}

async function requestOssUploadSession({
  token,
  scene,
  file,
  bizId,
  imageMeta,
}: {
  token: string;
  scene: (typeof OSS_IMAGE_UPLOAD_SCENES)[keyof typeof OSS_IMAGE_UPLOAD_SCENES];
  file: File;
  bizId?: string;
  imageMeta?: { width: number; height: number };
}) {
  return clientFetch<OssUploadSessionPayload>(
    '/me/storage/oss-upload-sessions',
    {
      method: 'POST',
      body: JSON.stringify({
        scene,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        bizId,
        imageWidth: imageMeta?.width,
        imageHeight: imageMeta?.height,
      }),
    },
    token,
  );
}

function isDirectPreviewValue(value: string) {
  const normalized = value.trim();
  return /^https?:\/\//i.test(normalized) || normalized.startsWith('data:');
}

const fieldClassName =
  'h-10 rounded-md border-[#E5E6EB] bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:ring-brand/15';
