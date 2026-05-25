import { Injectable } from '@nestjs/common';
import type { ResumeAiEntrySectionId } from './dto/optimize-resume-entry.dto';
import type { ResumeAiSectionId } from './dto/optimize-resume-section.dto';
import type { ResumeAiTranslateDirection } from './dto/translate-resume.dto';

const DEFAULT_RESUME_STANDARD_LINES = [
  '你是资深中文简历优化顾问、求职导师和专业 HR。',
  '所有任务都必须先按高分简历标准思考，再执行优化或评估，不能把“语句更通顺”当成完成。',
  '高分简历统一标准一：先判断目标岗位、经历类型、核心能力和竞争点，再决定表达顺序与重点。',
  '高分简历统一标准二：经历类内容优先整理为 3 到 4 条核心要点，每条要点以前置的 4 到 6 字精炼小标题开头，提升层次与可读性。',
  '高分简历统一标准三：优先量化真实的过程数据，如负责范围、任务数量、协作对象、项目周期、覆盖模块、交付节点、频次、处理量；不要强行索要或编造成果型数据。',
  '高分简历统一标准四：每条内容都要体现职责、动作、方法、能力或业务价值，禁止流水账、空话、口语化和假大空表达。',
  '高分简历统一标准五：必须突出与目标岗位直接相关的能力、经验和匹配度，让内容更有求职竞争力。',
  '禁止编造未提供的事实、业绩、数据、奖项、技能、公司、学校、时间。',
];

const DEFAULT_JSON_OUTPUT_LINES = [
  '输出必须是合法 JSON，不要输出 Markdown，不要输出解释文字。',
  '富文本只允许使用 p、ul、ol、li、strong、br 标签。',
];

const DEFAULT_ENTRY_SYSTEM_PROMPT = [
  ...DEFAULT_RESUME_STANDARD_LINES,
  '你只能优化当前条目的唯一富文本字段（description 或 content），不能改标题、单位、时间、城市、ID。',
  ...DEFAULT_JSON_OUTPUT_LINES,
].join('\n');

const DEFAULT_SECTION_SYSTEM_PROMPT = [
  ...DEFAULT_RESUME_STANDARD_LINES,
  '你只能优化用户指定的单个文本字段，不允许修改其它字段。',
  ...DEFAULT_JSON_OUTPUT_LINES,
].join('\n');

const DEFAULT_GLOBAL_SYSTEM_PROMPT = [
  ...DEFAULT_RESUME_STANDARD_LINES,
  '你只能优化 payload 明确允许更新的文本字段，不能改姓名、手机号、邮箱、网址、头像、logo、时间、城市、标题类事实字段。',
  ...DEFAULT_JSON_OUTPUT_LINES,
].join('\n');

const DEFAULT_TRANSLATE_SYSTEM_PROMPT = [
  '你是资深中英双语简历翻译专家。',
  '你的任务是忠实翻译简历内容，不得编造、删减、拔高、弱化任何事实信息。',
  '只允许翻译 payload 明确允许更新的字段，不能改 ID、链接、手机号、邮箱、日期、头像、logo 等非翻译目标字段。',
  '输出必须是合法 JSON，不要输出 Markdown，不要输出解释文字。',
  '富文本只允许使用 p、ul、ol、li、strong、br 标签。',
].join('\n');

const DEFAULT_PROFESSIONAL_SYSTEM_PROMPT = [
  ...DEFAULT_RESUME_STANDARD_LINES,
  '你还要额外承担行业术语优化职责，基于目标岗位与已有经历，做更专业、更贴合招聘语境的表达升级。',
  '工作经历和项目经历优先强化专业术语、职责深度、推进动作、方法路径与业务价值；校园经历、个人总结只允许适度润色，不能强行夸大。',
  ...DEFAULT_JSON_OUTPUT_LINES,
].join('\n');

const DEFAULT_ASSESSMENT_SYSTEM_PROMPT = [
  ...DEFAULT_RESUME_STANDARD_LINES,
  '你的任务不是直接改写内容，而是诊断当前内容距离高分简历标准还差什么，并输出可执行的优化建议。',
  '建议必须优先围绕结构化、小标题化、过程量化、岗位匹配度、职责价值表达来判断。',
  '禁止建议用户补充不存在的结果数据，禁止输出空泛建议。',
  ...DEFAULT_JSON_OUTPUT_LINES,
].join('\n');

const SECTION_LABEL_MAP: Record<ResumeAiEntrySectionId, string> = {
  education: '教育经历',
  internships: '工作经历',
  projects: '项目经历',
  campusRoles: '校内职务',
  awards: '荣誉奖项',
  languages: '语言能力',
  skills: '专业技能',
};

const SINGLE_FIELD_SECTION_LABEL_MAP: Record<ResumeAiSectionId, string> = {
  selfEvaluation: '个人总结',
  personalSummary: '个人简介',
};

const TRANSLATE_DIRECTION_LABEL_MAP: Record<ResumeAiTranslateDirection, string> = {
  'zh-to-en': '中译英',
  'en-to-zh': '英译中',
};

type ResumeAiOptimizationFocusPayload = {
  primaryJobTarget?: string;
  targetSource?: string;
  roleSignals?: string[];
  focusSummary?: string;
};

export interface ResumeAiAssessmentPromptParams {
  sectionId: ResumeAiEntrySectionId;
  title: string;
  entryPayload: Record<string, unknown>;
  jobTarget?: string;
  optimizationFocus?: ResumeAiOptimizationFocusPayload;
  systemPromptTemplate?: string | null;
  assessmentPromptTemplate?: string | null;
}

export interface ResumeAiSectionAssessmentPromptParams {
  sectionId: ResumeAiSectionId;
  sectionLabel: string;
  content: string;
  jobTarget?: string;
  optimizationFocus?: ResumeAiOptimizationFocusPayload;
  systemPromptTemplate?: string | null;
  assessmentPromptTemplate?: string | null;
}

@Injectable()
export class ResumeAiPromptBuilder {
  buildEntryOptimizePrompt(params: {
    sectionId: ResumeAiEntrySectionId;
    entryPayload: Record<string, unknown>;
    entryId: string;
    title: string;
    fieldKey: 'description' | 'content';
    tone?: string;
    jobTarget?: string;
    selectedSuggestion?: string;
    optimizationFocus?: ResumeAiOptimizationFocusPayload;
    systemPromptTemplate?: string | null;
    entryPromptTemplate?: string | null;
  }) {
    const taskPayload = {
      task: 'resume_entry_optimize',
      sectionId: params.sectionId,
      sectionLabel: SECTION_LABEL_MAP[params.sectionId],
      entryId: params.entryId,
      title: params.title,
      tone: params.tone?.trim() || 'professional',
      jobTarget: params.jobTarget?.trim() || '',
      selectedSuggestion: params.selectedSuggestion?.trim() || '',
      optimizationFocus: params.optimizationFocus,
      rules: {
        keepFacts: true,
        onlyOptimizeCurrentEntry: true,
        onlyUpdateFields: [params.fieldKey],
        allowedHtmlTags: ['p', 'ul', 'ol', 'li', 'strong', 'br'],
        outputFormat: 'json',
      },
      entry: params.entryPayload,
      expectedResponse: {
        success: true,
        sectionId: params.sectionId,
        entryId: params.entryId,
        updatedFields: {
          [params.fieldKey]: '<ul><li>...</li></ul>',
        },
      },
    };
    const taskPayloadJson = JSON.stringify(taskPayload, null, 2);

    return {
      systemPrompt: params.systemPromptTemplate?.trim() || DEFAULT_ENTRY_SYSTEM_PROMPT,
      userPayloadText: this.renderEntryPrompt(params.entryPromptTemplate, {
        sectionId: params.sectionId,
        sectionLabel: SECTION_LABEL_MAP[params.sectionId],
        title: params.title,
        fieldKey: params.fieldKey,
        tone: params.tone?.trim() || 'professional',
        jobTarget: params.jobTarget?.trim() || '',
        selectedSuggestion: params.selectedSuggestion?.trim() || '',
        primaryJobTarget: params.optimizationFocus?.primaryJobTarget?.trim() || '',
        focusSummary: params.optimizationFocus?.focusSummary?.trim() || '',
        taskPayloadJson,
      }),
    };
  }

  buildSectionOptimizePrompt(params: {
    sectionId: ResumeAiSectionId;
    fieldValue: string;
    tone?: string;
    jobTarget?: string;
    selectedSuggestion?: string;
    optimizationFocus?: ResumeAiOptimizationFocusPayload;
    resumeContextPayload?: Record<string, unknown>;
    systemPromptTemplate?: string | null;
    entryPromptTemplate?: string | null;
  }) {
    const taskPayload = {
      task: 'resume_section_optimize',
      sectionId: params.sectionId,
      sectionLabel: SINGLE_FIELD_SECTION_LABEL_MAP[params.sectionId],
      tone: params.tone?.trim() || 'professional',
      jobTarget: params.jobTarget?.trim() || '',
      selectedSuggestion: params.selectedSuggestion?.trim() || '',
      optimizationFocus: params.optimizationFocus,
      rules: {
        keepFacts: true,
        onlyOptimizeCurrentSection: true,
        onlyUpdateFields: ['content'],
        allowedHtmlTags: ['p', 'ul', 'ol', 'li', 'strong', 'br'],
        outputFormat: 'json',
      },
      section: {
        content: params.fieldValue,
      },
      resumeContext: params.resumeContextPayload,
      expectedResponse: {
        success: true,
        sectionId: params.sectionId,
        updatedFields: {
          content: '<p>...</p>',
        },
      },
    };
    const taskPayloadJson = JSON.stringify(taskPayload, null, 2);

    return {
      systemPrompt: params.systemPromptTemplate?.trim() || DEFAULT_SECTION_SYSTEM_PROMPT,
      userPayloadText: this.renderTemplate(
        params.entryPromptTemplate,
        [
          `请仅优化当前${SINGLE_FIELD_SECTION_LABEL_MAP[params.sectionId]}文本内容。`,
          '先判断目标岗位最关注的能力标签，再压缩冗余表述，突出岗位匹配度、核心优势和职业气质。',
          '这是单模块精细化优化，不要按全局统一重写其它模块。',
          '如果内容适合分点，控制为 2 到 3 点；不要强行套用经历类 3 到 4 条小标题结构。',
          params.selectedSuggestion?.trim()
            ? `请优先围绕“${params.selectedSuggestion.trim()}”这个方向做精细化升级。`
            : null,
          '不得修改任何事实信息。',
          '请直接返回 JSON 字符串。',
        ].filter(Boolean) as string[],
        {
          sectionId: params.sectionId,
          sectionLabel: SINGLE_FIELD_SECTION_LABEL_MAP[params.sectionId],
          tone: params.tone?.trim() || 'professional',
          jobTarget: params.jobTarget?.trim() || '',
          selectedSuggestion: params.selectedSuggestion?.trim() || '',
          primaryJobTarget: params.optimizationFocus?.primaryJobTarget?.trim() || '',
          focusSummary: params.optimizationFocus?.focusSummary?.trim() || '',
          taskPayloadJson,
        },
      ),
    };
  }

  buildSectionAssessmentPrompt(params: ResumeAiSectionAssessmentPromptParams) {
    const taskPayload = {
      task: 'resume_section_assessment',
      sectionId: params.sectionId,
      sectionLabel: params.sectionLabel,
      jobTarget: params.jobTarget?.trim() || '',
      optimizationFocus: params.optimizationFocus,
      rules: {
        evaluateOnly: true,
        outputFormat: 'json',
        suggestionCount: { min: 2, max: 3 },
        maxSuggestionLength: 40,
        suggestionRequirements: [
          '建议必须清晰、具体、可直接作为二次优化方向',
          '建议之间要有差异，不要重复表达',
          '只输出优化方向，不输出分析过程或解释',
          '优先指出结构化、小标题化、过程量化、岗位匹配度、职责价值表达中的关键差距',
          '禁止编造事实，不要要求新增用户未提供的硬数据',
        ],
      },
      section: { content: params.content },
      expectedResponse: {
        success: true,
        suggestions: ['突出岗位关键词', '压缩冗余表述', '补强核心能力与价值点'],
      },
    };
    const taskPayloadJson = JSON.stringify(taskPayload, null, 2);

    return {
      systemPrompt: params.systemPromptTemplate?.trim() || DEFAULT_ASSESSMENT_SYSTEM_PROMPT,
      userPayloadText: this.renderTemplate(
        params.assessmentPromptTemplate,
        [
          `请从专业 HR 和求职导师视角，评估当前${params.sectionLabel}内容距离高分简历标准还有哪些关键差距。`,
          '建议优先围绕结构化表达、岗位匹配度、核心能力提炼、过程量化和信息密度提出。',
          '你只需要返回 2 到 3 条可执行的二次优化方向建议。',
          '每条建议限制在 40 个字符以内，适合直接展示给用户点击。',
          '请直接返回 JSON 字符串。',
        ],
        {
          sectionId: params.sectionId,
          sectionLabel: params.sectionLabel,
          jobTarget: params.jobTarget?.trim() || '',
          primaryJobTarget: params.optimizationFocus?.primaryJobTarget?.trim() || '',
          focusSummary: params.optimizationFocus?.focusSummary?.trim() || '',
          taskPayloadJson,
        },
      ),
    };
  }

  buildGlobalOptimizePrompt(params: {
    resumePayload: Record<string, unknown>;
    tone?: string;
    jobTarget?: string;
    optimizationFocus?: ResumeAiOptimizationFocusPayload;
    systemPromptTemplate?: string | null;
    globalPromptTemplate?: string | null;
  }) {
    const taskPayload = {
      task: 'resume_global_optimize',
      language: 'zh-CN',
      tone: params.tone?.trim() || 'professional',
      jobTarget: params.jobTarget?.trim() || '',
      optimizationFocus: params.optimizationFocus,
      rules: {
        keepFacts: true,
        outputFormat: 'json',
        doNotModifyFields: [
          'name',
          'phone',
          'email',
          'website',
          'avatarUrl',
          'logoUrl',
          'startDate',
          'endDate',
          'city',
          'schoolName',
          'companyName',
          'projectName',
          'organization',
          'roleName',
          'degree',
          'major',
          'label',
          'url',
          'language',
          'score',
          'level',
          'awardDate',
          'category',
        ],
        updatableTextFields: [
          'personalSummary',
          'selfEvaluation',
          'education[].description',
          'internships[].description',
          'projects[].description',
          'campusRoles[].description',
          'awards[].description',
          'languages[].description',
          'skills[].content',
        ],
        allowedHtmlTags: ['p', 'ul', 'ol', 'li', 'strong', 'br'],
      },
      resume: params.resumePayload,
      expectedResponse: {
        success: true,
        updates: {
          personalSummary: '<p>...</p>',
          selfEvaluation: '<p>...</p>',
          education: [{ entryId: 'edu-1', description: '<ul><li>...</li></ul>' }],
          internships: [{ entryId: 'intern-1', description: '<ul><li>...</li></ul>' }],
          projects: [{ entryId: 'project-1', description: '<ul><li>...</li></ul>' }],
          campusRoles: [{ entryId: 'campus-1', description: '<ul><li>...</li></ul>' }],
          awards: [{ entryId: 'award-1', description: '<p>...</p>' }],
          languages: [{ entryId: 'language-1', description: '<p>...</p>' }],
          skills: [{ entryId: 'skill-1', content: '<ul><li>...</li></ul>' }],
        },
      },
    };
    const taskPayloadJson = JSON.stringify(taskPayload, null, 2);

    return {
      systemPrompt: params.systemPromptTemplate?.trim() || DEFAULT_GLOBAL_SYSTEM_PROMPT,
      userPayloadText: this.renderTemplate(
        params.globalPromptTemplate,
        [
          '请站在专业 HR 和求职导师视角，对整份简历做高分简历标准下的整体优化。',
          '先统一建立专业标准，再逐模块梳理结构、提炼能力、补强岗位匹配度和求职竞争力。',
          '经历类内容优先整理为 3 到 4 条核心要点，并为每条补上 4 到 6 字精炼小标题。',
          '优先量化真实的过程数据，不强行虚构结果数据。',
          '只允许更新任务数据中允许更新的文本字段。',
          '请直接返回 JSON 字符串。',
        ],
        {
          tone: params.tone?.trim() || 'professional',
          jobTarget: params.jobTarget?.trim() || '',
          primaryJobTarget: params.optimizationFocus?.primaryJobTarget?.trim() || '',
          focusSummary: params.optimizationFocus?.focusSummary?.trim() || '',
          taskPayloadJson,
        },
      ),
    };
  }

  buildTranslatePrompt(params: {
    direction: ResumeAiTranslateDirection;
    resumePayload: Record<string, unknown>;
    jobTarget?: string;
    systemPromptTemplate?: string | null;
    globalPromptTemplate?: string | null;
  }) {
    const targetLanguage = params.direction === 'zh-to-en' ? 'en-US' : 'zh-CN';
    const taskPayload = {
      task: 'resume_translate',
      direction: params.direction,
      directionLabel: TRANSLATE_DIRECTION_LABEL_MAP[params.direction],
      targetLanguage,
      jobTarget: params.jobTarget?.trim() || '',
      rules: {
        translateFaithfully: true,
        preserveFacts: true,
        outputFormat: 'json',
        doNotModifyFields: [
          'id',
          'phone',
          'email',
          'website',
          'avatarUrl',
          'logoUrl',
          'startDate',
          'endDate',
          'awardDate',
          'url',
        ],
        updatableTextFields: [
          'title',
          'sectionLabels.education',
          'sectionLabels.internships',
          'sectionLabels.projects',
          'sectionLabels.skills',
          'sectionLabels.awards',
          'sectionLabels.languages',
          'sectionLabels.campusRoles',
          'sectionLabels.selfEvaluation',
          'sectionLabels.links',
          'personal.name',
          'personal.expectedRole',
          'personal.expectedCity',
          'personal.availability',
          'personal.summary',
          'selfEvaluation',
          'education[].schoolName',
          'education[].degree',
          'education[].major',
          'education[].description',
          'internships[].companyName',
          'internships[].roleName',
          'internships[].city',
          'internships[].description',
          'projects[].projectName',
          'projects[].roleName',
          'projects[].city',
          'projects[].description',
          'campusRoles[].organization',
          'campusRoles[].roleName',
          'campusRoles[].description',
          'awards[].title',
          'awards[].level',
          'awards[].description',
          'languages[].language',
          'languages[].score',
          'languages[].description',
          'skills[].category',
          'skills[].content',
          'links[].label',
        ],
        allowedHtmlTags: ['p', 'ul', 'ol', 'li', 'strong', 'br'],
      },
      resume: params.resumePayload,
      expectedResponse: {
        success: true,
        translatedResume: {
          title: 'Resume',
          sectionLabels: {
            education: 'Education',
            internships: 'Work Experience',
            projects: 'Projects',
          },
          personal: {
            name: 'Your Name',
            expectedRole: 'Product Manager',
            expectedCity: 'Shanghai',
            availability: 'Available immediately',
            summary: '<p>...</p>',
          },
          selfEvaluation: '<p>...</p>',
          education: [{ entryId: 'edu-1', schoolName: 'University', degree: 'Bachelor', major: 'Computer Science', description: '<ul><li>...</li></ul>' }],
        },
      },
    };
    const taskPayloadJson = JSON.stringify(taskPayload, null, 2);

    return {
      systemPrompt: params.systemPromptTemplate?.trim() || DEFAULT_TRANSLATE_SYSTEM_PROMPT,
      userPayloadText: this.renderTemplate(
        params.globalPromptTemplate,
        [
          `请执行${TRANSLATE_DIRECTION_LABEL_MAP[params.direction]}，返回可直接回填当前简历结构的 JSON。`,
          '必须忠实翻译，不得增删事实。',
          '请直接返回 JSON 字符串。',
        ],
        {
          direction: params.direction,
          directionLabel: TRANSLATE_DIRECTION_LABEL_MAP[params.direction],
          jobTarget: params.jobTarget?.trim() || '',
          taskPayloadJson,
        },
      ),
    };
  }

  buildProfessionalOptimizePrompt(params: {
    resumePayload: Record<string, unknown>;
    tone?: string;
    jobTarget?: string;
    optimizationFocus?: ResumeAiOptimizationFocusPayload;
    systemPromptTemplate?: string | null;
    professionalPromptTemplate?: string | null;
  }) {
    const taskPayload = {
      task: 'resume_professional_optimize',
      language: 'zh-CN',
      tone: params.tone?.trim() || 'professional',
      jobTarget: params.jobTarget?.trim() || '',
      optimizationFocus: params.optimizationFocus,
      rules: {
        keepFacts: true,
        outputFormat: 'json',
        prioritizeProfessionalTerminology: true,
        experienceSectionsFocus: ['internships', 'projects'],
        moderatePolishOnlySections: ['campusRoles', 'personalSummary', 'selfEvaluation'],
        doNotModifyFields: [
          'name',
          'phone',
          'email',
          'website',
          'avatarUrl',
          'logoUrl',
          'startDate',
          'endDate',
          'city',
          'schoolName',
          'companyName',
          'projectName',
          'organization',
          'roleName',
          'degree',
          'major',
          'label',
          'url',
          'language',
          'score',
          'level',
          'awardDate',
          'category',
        ],
        updatableTextFields: [
          'personalSummary',
          'selfEvaluation',
          'education[].description',
          'internships[].description',
          'projects[].description',
          'campusRoles[].description',
          'awards[].description',
          'languages[].description',
          'skills[].content',
        ],
        allowedHtmlTags: ['p', 'ul', 'ol', 'li', 'strong', 'br'],
      },
      resume: params.resumePayload,
      expectedResponse: {
        success: true,
        updates: {
          personalSummary: '<p>...</p>',
          selfEvaluation: '<p>...</p>',
          internships: [{ entryId: 'intern-1', description: '<ul><li>...</li></ul>' }],
          projects: [{ entryId: 'project-1', description: '<ul><li>...</li></ul>' }],
          campusRoles: [{ entryId: 'campus-1', description: '<p>...</p>' }],
        },
      },
    };
    const taskPayloadJson = JSON.stringify(taskPayload, null, 2);

    return {
      systemPrompt: params.systemPromptTemplate?.trim() || DEFAULT_PROFESSIONAL_SYSTEM_PROMPT,
      userPayloadText: this.renderTemplate(
        params.professionalPromptTemplate,
        [
          '请基于目标岗位和招聘语境，对整份简历做专业化表达升级。',
          '工作经历与项目经历优先强化专业术语、职责深度、推进动作、方法路径和业务价值表达。',
          '校园经历、个人总结和自我评价只允许适度润色，不能改写真实经历。',
          '仍然必须遵守高分简历的结构化、小标题化、过程量化原则。',
          '请直接返回 JSON 字符串。',
        ],
        {
          tone: params.tone?.trim() || 'professional',
          jobTarget: params.jobTarget?.trim() || '',
          primaryJobTarget: params.optimizationFocus?.primaryJobTarget?.trim() || '',
          focusSummary: params.optimizationFocus?.focusSummary?.trim() || '',
          taskPayloadJson,
        },
      ),
    };
  }

  buildEntryAssessmentPrompt(params: ResumeAiAssessmentPromptParams) {
    const taskPayload = {
      task: 'resume_entry_assessment',
      sectionId: params.sectionId,
      sectionLabel: SECTION_LABEL_MAP[params.sectionId],
      title: params.title,
      jobTarget: params.jobTarget?.trim() || '',
      optimizationFocus: params.optimizationFocus,
      rules: {
        evaluateOnly: true,
        outputFormat: 'json',
        suggestionCount: {
          min: 2,
          max: 3,
        },
        maxSuggestionLength: 40,
        suggestionRequirements: [
          '建议必须清晰、具体、可直接作为二次优化方向',
          '建议之间要有差异，不要重复表达',
          '只输出优化方向，不输出分析过程或解释',
          '优先指出结构化、小标题化、过程量化、岗位匹配度、职责价值表达中的关键差距',
          '禁止编造事实，不要要求新增用户未提供的硬数据',
        ],
      },
      entry: params.entryPayload,
      expectedResponse: {
        success: true,
        suggestions: ['突出岗位核心职责', '补强项目结果表达', '强化协作与推进过程'],
      },
    };
    const taskPayloadJson = JSON.stringify(taskPayload, null, 2);

    return {
      systemPrompt: params.systemPromptTemplate?.trim() || DEFAULT_ASSESSMENT_SYSTEM_PROMPT,
      userPayloadText: this.renderTemplate(
        params.assessmentPromptTemplate,
        [
          `请从专业 HR 和求职导师视角，评估当前${SECTION_LABEL_MAP[params.sectionId]}条目距离高分简历标准还有哪些关键差距。`,
          '请先判断该经历对应的岗位角色、核心能力与招聘关注点，再给出二次优化建议。',
          '建议优先围绕结构化表达、小标题设置、过程量化、职责价值提炼和岗位匹配度提出。',
          '你只需要返回 2 到 3 条可执行的二次优化方向建议。',
          '每条建议限制在 40 个字符以内，适合直接展示给用户点击。',
          '请直接返回 JSON 字符串。',
        ],
        {
          sectionId: params.sectionId,
          sectionLabel: SECTION_LABEL_MAP[params.sectionId],
          title: params.title,
          jobTarget: params.jobTarget?.trim() || '',
          primaryJobTarget: params.optimizationFocus?.primaryJobTarget?.trim() || '',
          focusSummary: params.optimizationFocus?.focusSummary?.trim() || '',
          taskPayloadJson,
        },
      ),
    };
  }

  private renderEntryPrompt(
    template: string | null | undefined,
    context: Record<string, string>,
  ) {
    if (!template?.trim()) {
      return [
        `请仅优化当前${context.sectionLabel}条目的 ${context.fieldKey} 字段。`,
        '请先判断该经历对应的岗位角色、核心能力和求职竞争点，再决定信息主次与表达顺序。',
        '经历类内容优先整理为 3 到 4 条核心要点，每条以前置的 4 到 6 字精炼小标题开头。',
        '优先量化真实的过程数据，如负责范围、任务数量、协作对象、项目周期、覆盖模块、交付节点与处理量；没有结果数据时不要强行虚构。',
        '每条内容都要体现职责、动作、方法、能力或业务价值，避免流水账和空泛表述。',
        context.selectedSuggestion ? `请优先围绕“${context.selectedSuggestion}”这个方向做精细化升级。` : null,
        '不得修改任何事实信息。',
        '请直接返回 JSON 字符串。',
        '',
        context.taskPayloadJson,
      ].filter(Boolean).join('\n');
    }

    return this.renderTemplate(template, [], context);
  }

  private renderTemplate(
    template: string | null | undefined,
    defaultIntroLines: string[],
    context: Record<string, string>,
  ) {
    if (!template?.trim()) {
      return [...defaultIntroLines, '', context.taskPayloadJson].join('\n');
    }

    const rendered = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
      return context[key] ?? '';
    }).trim();
    if (rendered.includes(context.taskPayloadJson)) {
      return rendered;
    }

    return `${rendered}\n\n任务数据：\n${context.taskPayloadJson}`;
  }
}
