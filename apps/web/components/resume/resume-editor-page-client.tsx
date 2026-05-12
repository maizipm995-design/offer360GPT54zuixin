'use client';

import {
  type ChangeEvent,
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
import { useRouter } from 'next/navigation';
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
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { showToast } from '@/store/toast-store';
import { MemberAccessDialog } from '@/components/membership/member-access-dialog';
import { ResumeDocument } from './resume-document';
import { getRichTextPlainText } from './resume-rich-text';
import { ResumeRichTextEditor } from './resume-rich-text-editor';
import {
  type ResumeBasicInfoVariant,
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

const REDIRECT_PATH = '/resume-optimizer';
const PREVIEW_BASE_WIDTH = 794;
const PREVIEW_BASE_HEIGHT = 1123;
const FLOATING_PANEL_OFFSET = 12;
const AVATAR_CROP_VIEWPORT_WIDTH = 288;
const AVATAR_CROP_VIEWPORT_HEIGHT = 384;
const AVATAR_CROP_OUTPUT_WIDTH = 900;
const AVATAR_CROP_OUTPUT_HEIGHT = 1200;
const AVATAR_CROP_MIN_ZOOM = 1;
const AVATAR_CROP_MAX_ZOOM = 3;
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
  zoom: number;
  offsetX: number;
  offsetY: number;
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
    sidebarLabel: '工作经历模块',
    drawerTitle: '工作经历',
    addLabel: '+ 再增加一段工作经历',
    summaryHint: '梳理岗位、职责、城市与成果',
  },
  projects: {
    sidebarLabel: '项目经历模块',
    drawerTitle: '项目经历',
    addLabel: '+ 再增加一段项目经历',
    summaryHint: '突出项目背景、角色与结果',
  },
  selfEvaluation: {
    sidebarLabel: '个人总结模块',
    drawerTitle: '个人总结',
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
      projectName: '简历优化平台',
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
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [draggingSectionId, setDraggingSectionId] = useState<ResumeSectionId | null>(null);
  const [previewMetrics, setPreviewMetrics] = useState<ResumePreviewMetrics | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewFrameHeight, setPreviewFrameHeight] = useState(PREVIEW_BASE_HEIGHT);
  const [activeSectionPage, setActiveSectionPage] = useState(1);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [openDrawers, setOpenDrawers] = useState<Record<string, boolean>>({});
  const [createLimitPromptOpen, setCreateLimitPromptOpen] = useState(false);
  const [memberAccessMessage, setMemberAccessMessage] = useState('');

  const templateConfigMap = useMemo(
    () => new Map(templateConfigs.map((item) => [item.templateCode, item])),
    [templateConfigs],
  );

  const editorPanelRef = useRef<HTMLDivElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const previewMetricsRef = useRef<ResumePreviewMetrics | null>(null);
  const lastSavedSnapshotRef = useRef('');
  const loginGateTriggeredRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || token || loginGateTriggeredRef.current) {
      return;
    }
    loginGateTriggeredRef.current = true;
    showToast('简历优化功能需要先登录后使用');
    router.replace(`/login?redirect=${encodeURIComponent(REDIRECT_PATH)}`);
  }, [mounted, token, router]);

  const applyDraftToEditor = useCallback((draft: ResumeDraftRecord) => {
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
    setActiveSectionId('personal');
    setHighlightedSections([]);
    setOpenDrawers({});
    setActiveToolbarPanel(null);
    setActiveStyleTab('header');
    setSmartOnePageActive(false);
    setSmartOnePageSnapshot(null);
    lastSavedSnapshotRef.current = buildResumeSnapshot(nextTitle, nextContent, nextStyle, nextLayout);
  }, []);

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
      const [, listResponse] = await Promise.all([fetchTemplateConfigs(), fetchDraftList()]);
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
        router.replace(`/login?redirect=${encodeURIComponent(REDIRECT_PATH)}`);
        return;
      }
      setInitError(msg);
      showToast(msg);
    } finally {
      setLoading(false);
    }
  }, [fetchDraftList, fetchTemplateConfigs, loadDraftDetail, token, logout, router]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    void bootstrapDraft();
  }, [bootstrapDraft, mounted]);

  const currentSnapshot = useMemo(
    () => buildResumeSnapshot(draftTitle.trim() || '我的简历', content, styleConfig, layout),
    [content, draftTitle, layout, styleConfig],
  );
  const hasUnsavedChanges = currentSnapshot !== lastSavedSnapshotRef.current;

  const persistCurrentDraft = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token || !draftId) {
        if (!options?.silent) {
          showToast('请先登录以保存简历');
          router.push(`/login?redirect=${encodeURIComponent(REDIRECT_PATH)}`);
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
          showToast('简历已保存', 'success');
        }
        return true;
      } catch (error) {
        showToast(error instanceof Error ? error.message : '简历保存失败');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [content, draftId, draftTitle, layout, styleConfig, token, router],
  );

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
    () => SUPPORTED_SECTION_IDS.map((id) => layout.find((item) => item.id === id)).filter(Boolean) as ResumeLayoutItem[],
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
      }
    },
    [persistCurrentDraft],
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
      const activeIds = prev.filter((item) => item.visible && !item.deleted).map((item) => item.id);
      const currentIndex = activeIds.findIndex((id) => id === sectionId);
      const targetId = activeIds[currentIndex + direction];
      if (currentIndex < 0 || !targetId) {
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

  const reorderLayoutItem = useCallback((fromId: ResumeSectionId, toId: ResumeSectionId) => {
    if (fromId === toId) {
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
      next.splice(toIndex, 0, moved);
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
      setActiveDraftManagerOpen(false);
      showToast('已新建简历草稿', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '新建简历失败');
    } finally {
      setCreatingDraft(false);
    }
  }, [creatingDraft, draftList.length, draftListMeta.limit, draftListMeta.memberRoleCode, fetchDraftList, loadDraftDetail, router, token]);

  const switchDraft = useCallback(
    async (id: string) => {
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
    [draftId, loadDraftDetail, persistCurrentDraft],
  );

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
    showToast('已完成智能排序');
  }, [content.education, content.internships, content.projects, jumpToSection]);

  const handleSmartLayout = useCallback(async () => {
    if (smartOnePageActive && smartOnePageSnapshot) {
      setStyleConfig(smartOnePageSnapshot);
      setSmartOnePageActive(false);
      setSmartOnePageSnapshot(null);
      showToast('已撤回智能一页优化');
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
      showToast('已为你适配单页简历');
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
    showToast('已为你适配单页简历');
  }, [measurePreview, smartOnePageActive, smartOnePageSnapshot, styleConfig]);

  const handleExportPdf = useCallback(async () => {
    if (exportingPdf) {
      return;
    }

    if (!token || !draftId) {
      showToast('请先登录后下载 PDF 简历');
      router.push(`/login?redirect=${encodeURIComponent(REDIRECT_PATH)}`);
      return;
    }

    setExportingPdf(true);
    showToast('正在生成 PDF，请稍候...');

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
      showToast('PDF 简历已开始下载', 'success');
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

  if (!token) {
    return (
      <main className="flex h-[calc(100vh-56px)] items-center justify-center bg-[#EEEEEE] px-4 py-6">
        <div className="flex min-h-[240px] w-full max-w-[680px] flex-col items-center justify-center gap-3 rounded-[16px] border border-[#E5E6EB] bg-white text-center shadow-sm">
          <LoaderCircle className="h-6 w-6 animate-spin text-brand" />
          <div>
            <p className="text-base font-semibold text-slate-900">正在跳转到登录页...</p>
            <p className="mt-2 text-sm text-slate-500">简历优化功能仅对登录用户开放。</p>
          </div>
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
    <main className="h-[calc(100vh-56px)] overflow-hidden bg-[#EEF1F5] text-slate-900">
      <section className="relative flex h-full flex-col overflow-hidden bg-[#EEF1F5]">
        <header className="relative z-30 h-[58px] shrink-0 border-b border-[#D8DEE8] bg-white px-4 shadow-[0_6px_20px_rgba(15,23,42,0.05)]">
          <div className="flex h-full min-w-0 items-center gap-3">
            <button
              type="button"
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
            <div className="hidden shrink-0 items-center gap-1.5 text-xs text-slate-500 lg:inline-flex">
              <Save className={cn('h-3.5 w-3.5', saving && 'animate-pulse text-[#FF734A]', hasUnsavedChanges && !saving && 'text-[#FF734A]')} />
              <span>{saving ? '保存中' : hasUnsavedChanges ? '待同步' : lastSavedAt ? `已保存 ${formatDate(lastSavedAt)}` : '未保存'}</span>
            </div>

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
                      <DarkToolbarButton label="模板样式" active={activeToolbarPanel === 'templateStyle'} badge="NEW" onClick={() => toggleToolbarPanel('templateStyle')} light />
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
                onClick={() => setActiveDraftManagerOpen((prev) => !prev)}
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
                        onClick={() => void switchDraft(draft.id)}
                        className={cn(
                          'w-full rounded-xl px-2.5 py-2 text-left text-[11px] transition',
                          draft.id === draftId
                            ? 'bg-brand/10 text-brand ring-1 ring-brand/30'
                            : 'text-slate-600 hover:bg-[#F5F7FA] hover:text-slate-900',
                        )}
                      >
                        <span className="block truncate font-medium">{draft.title || '未命名简历'}</span>
                        <span className="mt-1 block text-[10px] text-slate-400">{formatDate(draft.updatedAt)}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void createNewDraft()}
                    disabled={creatingDraft}
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
                    className={cn(
                      'flex h-[70px] w-full flex-col items-center justify-center gap-1 rounded-xl border text-[11px] transition',
                      active
                        ? 'border-brand bg-brand/10 text-brand shadow-[0_8px_24px_rgba(255,128,2,0.16)]'
                        : 'border-transparent bg-white text-slate-600 hover:border-brand/40 hover:text-slate-900',
                      highlighted && !active && 'text-amber-500',
                    )}
                  >
                    <Layers className="h-4 w-4" />
                    <span className="line-clamp-2 text-center leading-4">{SECTION_COPY[section.id as SupportedSectionId].drawerTitle}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section ref={editorPanelRef} className="w-[480px] shrink-0 overflow-y-auto border-r border-[#D8DEE8] bg-white px-7 py-7">
            <div className="mb-5 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{SECTION_COPY[activeSectionId].drawerTitle}</h2>
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
              updatePersonalField,
              setHighlightedSections,
              isDrawerOpen,
              toggleDrawer,
              openOnlyDrawer,
              onSaveDrawer: handleSaveDrawer,
            })}
          </section>

          <aside className="min-w-0 flex-1 bg-[#EEF1F5] p-6">
            <div className="flex h-full items-start justify-center overflow-hidden rounded-[20px] border border-[#D8DEE8] bg-[#EEF1F5] p-4">
              <div ref={previewViewportRef} className="flex h-full w-full items-start justify-center overflow-auto">
                <div className="mx-auto flex justify-center" style={{ minHeight: `${Math.max(previewFrameHeight, 220)}px` }}>
                  <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top center' }}>
                    <div ref={previewHostRef}>
                      <ResumeDocument
                        content={content}
                        styleConfig={styleConfig}
                        layout={layout}
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
      <MemberAccessDialog
        open={Boolean(memberAccessMessage)}
        message={memberAccessMessage}
        onClose={() => setMemberAccessMessage('')}
        onConfirm={() => {
          setMemberAccessMessage('');
          router.push('/membership');
        }}
      />
    </main>
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
  onReorderLayoutItem: (fromId: ResumeSectionId, toId: ResumeSectionId) => void;
  draggingSectionId: ResumeSectionId | null;
  setDraggingSectionId: Dispatch<SetStateAction<ResumeSectionId | null>>;
  onRestoreLayoutItem: (sectionId: ResumeSectionId) => void;
  onUpdateLayoutItem: (sectionId: ResumeSectionId, updates: Partial<ResumeLayoutItem>) => void;
  onApplyTemplate: (templateCode: ResumeTemplateCode | string) => void;
  onExportPdf: () => void;
  setMemberAccessMessage: Dispatch<SetStateAction<string>>;
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
            activeSectionId={activeSectionId}
            onJumpToSection={onJumpToSection}
            onMoveLayoutItem={onMoveLayoutItem}
            onReorderLayoutItem={onReorderLayoutItem}
            draggingSectionId={draggingSectionId}
            setDraggingSectionId={setDraggingSectionId}
            onRestoreLayoutItem={onRestoreLayoutItem}
            onUpdateLayoutItem={onUpdateLayoutItem}
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
      <FloatingPanel anchorRef={anchorRef} align="right" className="w-[300px] max-w-[calc(100vw-32px)]" onClose={onClose}>
        <DarkPanelSection title="翻译">
          <DarkOptionButton label="中译英" description="生成英文简历草稿" onClick={() => showToast('翻译能力即将接入 AI 服务')} />
          <DarkOptionButton label="英译中" description="还原中文求职表达" onClick={() => showToast('翻译能力即将接入 AI 服务')} />
          <DarkOptionButton label={`专业术语优化 ${PREMIUM_BADGE}`} description="会员功能" onClick={() => setMemberAccessMessage('该功能需要开通会员')} />
        </DarkPanelSection>
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
  activeSectionId,
  onJumpToSection,
  onMoveLayoutItem,
  onReorderLayoutItem,
  draggingSectionId,
  setDraggingSectionId,
  onRestoreLayoutItem,
  onUpdateLayoutItem,
}: {
  layout: ResumeLayoutItem[];
  moduleSections: ResumeLayoutItem[];
  activeSectionId: SupportedSectionId;
  onJumpToSection: (sectionId: ResumeSectionId) => void;
  onMoveLayoutItem: (sectionId: ResumeSectionId, direction: -1 | 1) => void;
  onReorderLayoutItem: (fromId: ResumeSectionId, toId: ResumeSectionId) => void;
  draggingSectionId: ResumeSectionId | null;
  setDraggingSectionId: Dispatch<SetStateAction<ResumeSectionId | null>>;
  onRestoreLayoutItem: (sectionId: ResumeSectionId) => void;
  onUpdateLayoutItem: (sectionId: ResumeSectionId, updates: Partial<ResumeLayoutItem>) => void;
}) {
  const activeModules = moduleSections.filter((item) => item.visible && !item.deleted);
  const optionalModules = RESUME_SECTION_DEFINITIONS.filter((item) => item.deletable);
  const restorableModules = optionalModules.filter((definition) => {
    const current = layout.find((item) => item.id === definition.id);
    return !current || current.deleted || !current.visible;
  });

  return (
    <div className="space-y-7 p-6">
      <div>
        <DarkPanelTitle>已有模块</DarkPanelTitle>
        <p className="mt-2 text-sm text-slate-500">拖拽可调整模块顺序，左侧编辑区和右侧简历预览会实时同步。</p>
      </div>
      <div className="space-y-3">
        {activeModules.map((item, index) => {
          const active = activeSectionId === item.id;
          return (
            <div
              key={item.id}
              draggable
              onDragStart={() => setDraggingSectionId(item.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingSectionId) {
                  onReorderLayoutItem(draggingSectionId, item.id);
                }
                setDraggingSectionId(null);
              }}
              onDragEnd={() => setDraggingSectionId(null)}
              className={cn(
                'flex min-h-[52px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm transition',
                active
                  ? 'border-brand/30 bg-brand/10 text-brand shadow-[0_8px_24px_rgba(255,128,2,0.16)]'
                  : 'border-[#E5EAF1] bg-white text-slate-700 hover:border-brand/40 hover:bg-brand/10',
                draggingSectionId === item.id && 'opacity-60',
              )}
            >
              <button type="button" className="cursor-grab text-slate-400 hover:text-brand active:cursor-grabbing" aria-label="拖拽排序">
                <GripVertical className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onJumpToSection(item.id)} className="min-w-0 flex-1 truncate text-left font-medium">
                {getModuleManagerLabel(item.id)}
              </button>
              <button
                type="button"
                className="text-slate-400 transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-35"
                onClick={() => onMoveLayoutItem(item.id, -1)}
                disabled={index === 0}
                aria-label="上移模块"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="text-slate-400 transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-35"
                onClick={() => onMoveLayoutItem(item.id, 1)}
                disabled={index === activeModules.length - 1}
                aria-label="下移模块"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onJumpToSection(item.id)} className="text-slate-400 transition hover:text-brand" aria-label="编辑模块">
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateLayoutItem(item.id, { visible: false, deleted: false })}
                className="text-slate-400 transition hover:text-slate-700"
                aria-label="隐藏模块"
              >
                <EyeOff className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateLayoutItem(item.id, { visible: false, deleted: true })}
                className="text-slate-400 transition hover:text-red-500"
                aria-label="删除模块"
              >
                <Trash2 className="h-4 w-4" />
              </button>
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
          <button key={item.value} type="button" onClick={() => onPick(item.value)} className="group text-left">
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

function DarkOptionButton({ label, description, onClick }: { label: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-[#E5EAF1] bg-[#F8FAFC] px-4 py-3 text-left transition hover:border-brand/40 hover:bg-brand/10"
    >
      <span className="block text-sm font-semibold text-slate-900">{label}</span>
      <span className="mt-1 block text-xs text-slate-500">{description}</span>
    </button>
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
  updatePersonalField,
  setHighlightedSections,
  isDrawerOpen,
  toggleDrawer,
  openOnlyDrawer,
  onSaveDrawer,
}: {
  sectionId: SupportedSectionId;
  content: ResumeContent;
  setContent: Dispatch<SetStateAction<ResumeContent>>;
  draftId: string;
  token: string | null;
  updatePersonalField: (field: keyof ResumeContent['personal'], value: string) => void;
  setHighlightedSections: Dispatch<SetStateAction<ResumeSectionId[]>>;
  isDrawerOpen: (drawerKey: string) => boolean;
  toggleDrawer: (drawerKey: string) => void;
  openOnlyDrawer: (sectionId: ResumeSectionId, drawerKey: string) => void;
  onSaveDrawer: (drawerKey: string) => Promise<void>;
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
            <FieldBlock label="个人总结" className="md:col-span-2">
              <ResumeRichTextEditor
                value={content.personal.summary}
                onChange={(value) => updatePersonalField('summary', value)}
                placeholder="支持加粗、项目符号、数字排序，用于概括核心优势与亮点"
                preset="paragraph"
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
          title="工作经历"
          itemLabel="工作经历"
          items={content.internships}
          addLabel={SECTION_COPY.internships.addLabel ?? '+ 再增加一段工作经历'}
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
          primaryFieldLabel="项目名称"
        />
      );
    case 'selfEvaluation': {
      const drawerKey = getDrawerKey('selfEvaluation');
      return (
        <DrawerCard
          title="个人总结"
          open={isDrawerOpen(drawerKey)}
          onToggle={() => toggleDrawer(drawerKey)}
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
}) {
  const primaryKey = (sectionId === 'projects' ? 'projectName' : sectionId === 'campusRoles' ? 'organization' : 'companyName') as keyof T;

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const drawerKey = getDrawerKey(sectionId, item.id);
        return (
          <DrawerCard
            key={item.id}
            title={`${title} ${index + 1}`}
            open={isDrawerOpen(drawerKey)}
            onToggle={() => toggleDrawer(drawerKey)}
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
  onDelete,
  onSave,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[#E5E6EB] bg-white">
      <div className="flex items-center justify-between gap-3 bg-[#F7F8FA] px-4 py-3">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <div className="flex items-center gap-1.5">
          {onDelete ? (
            <IconButton label={`清空 ${title}`} onClick={onDelete}>
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
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSave}
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
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
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
  const [avatarCropState, setAvatarCropState] = useState<AvatarCropState | null>(null);
  const isAvatarScene = scene === OSS_IMAGE_UPLOAD_SCENES.avatar;

  const closeAvatarCropModal = useCallback(() => {
    setAvatarCropState((current) => {
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

    if (!isAvatarScene && file.size > 2 * 1024 * 1024) {
      showToast('图片大小请控制在 2MB 以内');
      return;
    }

    try {
      if (isAvatarScene) {
        const { width, height } = await readImageDimensions(file);
        setAvatarCropState({
          file,
          sourceUrl: URL.createObjectURL(file),
          imageWidth: width,
          imageHeight: height,
          zoom: AVATAR_CROP_MIN_ZOOM,
          offsetX: 0,
          offsetY: 0,
        });
        return;
      }

      if (!token) {
        showToast('请先登录后再上传图片');
        return;
      }

      setUploading(true);
      const session = await requestOssUploadSession({ token, scene, file, bizId, imageMeta });
      const { signedUrl: uploadedPreviewUrl } = await sharedUploadFileToOss(session, file);
      onChange({
        objectKey: session.objectKey,
        previewUrl: uploadedPreviewUrl,
      });
      showToast('图片上传成功', 'success');
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

  const handleAvatarCropConfirm = useCallback(async () => {
    if (!avatarCropState) {
      return;
    }
    if (!token) {
      showToast('请先登录后再上传图片');
      return;
    }

    setUploading(true);
    try {
      const croppedFile = await buildCroppedAvatarFile(avatarCropState);
      const imageMeta = {
        width: AVATAR_CROP_OUTPUT_WIDTH,
        height: AVATAR_CROP_OUTPUT_HEIGHT,
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
      closeAvatarCropModal();
      showToast('头像上传成功', 'success');
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
  }, [avatarCropState, bizId, closeAvatarCropModal, onChange, scene, token]);

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
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E6EB] bg-white text-slate-500 transition hover:border-[#FF734A] hover:text-[#FF734A]"
            aria-label="移除图片"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {isAvatarScene ? (
        <p className="text-xs leading-5 text-slate-500">支持任意尺寸和比例原图，确认裁剪后将按 3:4 标准头像上传。</p>
      ) : null}
      <div
        className="flex items-center justify-center overflow-hidden rounded-2xl border border-[#E5E6EB] bg-[#F9FAFB] shadow-sm"
        style={{
          width: '80px',
          aspectRatio: isAvatarScene ? '295 / 413' : '1 / 1',
        }}
      >
        {displayValue ? (<>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayValue} alt="上传预览" className="h-full w-full object-cover" style={{ objectPosition: isAvatarScene ? 'center top' : 'center' }} />
        </>) : <ImageIcon className="h-6 w-6 text-slate-400" aria-hidden="true" />}
      </div>
      {isAvatarScene && avatarCropState ? (
        <AvatarCropModal
          cropState={avatarCropState}
          uploading={uploading}
          onChange={setAvatarCropState}
          onCancel={closeAvatarCropModal}
          onConfirm={() => void handleAvatarCropConfirm()}
        />
      ) : null}
    </div>
  );
}

function AvatarCropModal({
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
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const cropBounds = getAvatarCropBounds(cropState);

  const updateCropState = useCallback(
    (updater: (current: AvatarCropState) => AvatarCropState) => {
      onChange((current) => (current ? clampAvatarCropState(updater(current)) : current));
    },
    [onChange],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: cropState.offsetX,
      offsetY: cropState.offsetY,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) {
      return;
    }
    const nextOffsetX = dragStartRef.current.offsetX + event.clientX - dragStartRef.current.x;
    const nextOffsetY = dragStartRef.current.offsetY + event.clientY - dragStartRef.current.y;
    updateCropState((current) => ({
      ...current,
      offsetX: nextOffsetX,
      offsetY: nextOffsetY,
    }));
  };

  const stopDragging = () => {
    dragStartRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">裁剪头像</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">请将头像调整到 3:4 裁剪框内，确认后仅上传裁剪成品。</p>
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
            <div
              className="relative overflow-hidden rounded-[24px] bg-[#0F172A]"
              style={{
                width: `${AVATAR_CROP_VIEWPORT_WIDTH}px`,
                height: `${AVATAR_CROP_VIEWPORT_HEIGHT}px`,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDragging}
              onPointerLeave={stopDragging}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cropState.sourceUrl}
                alt="头像裁剪预览"
                draggable={false}
                className="pointer-events-none absolute select-none"
                style={{
                  width: `${cropBounds.width}px`,
                  height: `${cropBounds.height}px`,
                  left: `${cropBounds.left}px`,
                  top: `${cropBounds.top}px`,
                }}
              />
              <div className="pointer-events-none absolute inset-0 border border-white/80 shadow-[inset_0_0_0_9999px_rgba(15,23,42,0.24)]" />
            </div>
          </div>

          <div className="w-full lg:w-[280px]">
            <div className="rounded-2xl bg-[#F8FAFC] p-4">
              <p className="text-sm font-medium text-slate-900">缩放图片</p>
              <input
                type="range"
                min={AVATAR_CROP_MIN_ZOOM}
                max={AVATAR_CROP_MAX_ZOOM}
                step="0.01"
                value={cropState.zoom}
                onChange={(event) =>
                  updateCropState((current) => ({
                    ...current,
                    zoom: Number(event.target.value),
                  }))
                }
                className="mt-4 w-full accent-brand"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>缩小</span>
                <span>{Math.round(cropState.zoom * 100)}%</span>
                <span>放大</span>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">拖动图片调整位置，系统会输出统一 3:4 的标准头像成品。</p>
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

function clampAvatarCropState(state: AvatarCropState) {
  const bounds = getAvatarCropBounds(state);
  const maxOffsetX = Math.max((bounds.width - AVATAR_CROP_VIEWPORT_WIDTH) / 2, 0);
  const maxOffsetY = Math.max((bounds.height - AVATAR_CROP_VIEWPORT_HEIGHT) / 2, 0);
  return {
    ...state,
    zoom: Math.min(Math.max(state.zoom, AVATAR_CROP_MIN_ZOOM), AVATAR_CROP_MAX_ZOOM),
    offsetX: Math.min(Math.max(state.offsetX, -maxOffsetX), maxOffsetX),
    offsetY: Math.min(Math.max(state.offsetY, -maxOffsetY), maxOffsetY),
  };
}

function getAvatarCropBounds(state: AvatarCropState) {
  const baseScale = Math.max(
    AVATAR_CROP_VIEWPORT_WIDTH / state.imageWidth,
    AVATAR_CROP_VIEWPORT_HEIGHT / state.imageHeight,
  );
  const scale = baseScale * state.zoom;
  const width = state.imageWidth * scale;
  const height = state.imageHeight * scale;
  const left = (AVATAR_CROP_VIEWPORT_WIDTH - width) / 2 + state.offsetX;
  const top = (AVATAR_CROP_VIEWPORT_HEIGHT - height) / 2 + state.offsetY;
  return { width, height, left, top };
}

async function buildCroppedAvatarFile(state: AvatarCropState) {
  const image = await loadImageElement(state.sourceUrl);
  const bounds = getAvatarCropBounds(state);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_CROP_OUTPUT_WIDTH;
  canvas.height = AVATAR_CROP_OUTPUT_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('浏览器暂不支持头像裁剪，请更换浏览器后重试');
  }

  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const scaleX = canvas.width / AVATAR_CROP_VIEWPORT_WIDTH;
  const scaleY = canvas.height / AVATAR_CROP_VIEWPORT_HEIGHT;
  context.drawImage(
    image,
    bounds.left * scaleX,
    bounds.top * scaleY,
    bounds.width * scaleX,
    bounds.height * scaleY,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('头像裁剪失败，请重新调整后再试'));
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

function getModuleManagerLabel(sectionId: ResumeSectionId) {
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
    selfEvaluation: '其他',
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

  return ordered.map((item) => {
    if (REQUIRED_SECTION_SET.has(item.id)) {
      return { ...item, visible: true, deleted: false };
    }
    return {
      ...item,
      visible: item.deleted ? false : item.visible !== false,
      deleted: item.deleted === true,
    };
  });
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
