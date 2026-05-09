import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  jobTitleAliasRound1SeedItems,
  jobTitleTermRound1SeedItems,
  majorAliasRound1SeedItems,
  majorTermRound1SeedItems,
  type SeedNormalizationAliasItem,
  type SeedNormalizationTermItem,
} from '../apps/api/src/modules/jobs/jobs-normalization.seed-data';

type Domain = 'JOB_TITLE' | 'MAJOR';

type MappingRow = {
  domain: Domain;
  oldName: string;
  newCanonical: string;
  matchMode: 'exact' | 'contains';
  note: string;
};

const docsDir = path.resolve(process.cwd(), 'docs');

const trackLabelMap: Record<string, string> = {
  tech: '技术研发',
  'data-analysis': '数据分析',
  data: '数据工程',
  'tech-ops': '技术运维',
  'tech-hardware': '硬件嵌入式',
  product: '产品',
  operations: '运营',
  design: '设计',
  functional: '职能',
  market: '市场营销',
  engineering: '工程制造',
  campus: '校招专项',
  'it-support': '企业 IT 支持',
  fallback: '人工兜底',
  technology: '信息技术',
  medical: '医学健康',
  science: '理学',
  business: '经管商科',
  engineering: '工程',
  'social-science': '人文社科',
};

const jobTitleBoundaryNotes: Record<string, string> = {
  开发: '面向通用软件开发与应用开发，不覆盖已明确前后端、算法、客户端方向。',
  研发: '保留技术研究与研发类岗位独立语义，与“开发”并列存在，不做合并。',
  后端: '统一服务端、Java 后端等岗位写法，优先匹配后端实现方向。',
  前端: '统一 Web 前端与前端开发类岗位写法。',
  客户端: '统一 iOS、Android、移动端、客户端开发类岗位。',
  算法: '覆盖算法工程师、推荐算法、搜索算法等算法建模岗位。',
  大数据: '覆盖数据开发、大数据平台、数据工程类岗位，不替代数据分析。',
  人工智能: '覆盖 AI、AIGC、智能体方向，强调模型应用与智能技术。',
  安全: '覆盖网络安全、信息安全、安全工程类岗位。',
  测试: '覆盖 QA、测开、测试开发与质量测试方向。',
  运维: '覆盖 DevOps、SRE、运维开发与系统运维类岗位。',
  硬件: '覆盖嵌入式、硬件工程、嵌入式软件等硬件相关岗位。',
  产品: '产品与产品经理口径统一收口到产品，保持与运营独立。',
  运营: '覆盖内容、用户、电商、短视频、增长等运营岗位，保持与产品独立。',
  数据分析: '仅覆盖分析、报表、BI、分析师类岗位，不吸收数据开发与算法岗位。',
  UI: '聚焦 UI、界面、视觉界面类设计岗位，不泛化到所有设计岗位。',
  设计: '承接平面、空间、创意等通用设计岗位，不覆盖 UI 专项。',
  人力: '聚焦 HR、人力资源、招聘类岗位。',
  '人事 / 行政': '承接行政、人事行政、综合行政等事务支持岗位。',
  财务: '覆盖会计、出纳、财务管理等财务职能岗位。',
  市场: '承接市场拓展、市场专员、市场方向类岗位。',
  营销: '承接市场营销、品牌营销、营销策划类岗位，与市场并列。',
  工程师: '作为工程制造通用类 canonical，承接机械、电气、技术工程师等非软件工程岗位。',
  管培生: '承接管理培训生、营销管培生等管培体系岗位。',
  培训生: '承接培训岗位、见习培训生等培训体系岗位。',
  实习生: '承接寒暑期实习与通用实习岗位。',
  校园大使: '承接校园推广大使、校园合伙人等校园推广角色。',
  IT技术: '承接企业 IT、信息技术岗、内部系统支持岗，不并入研发。',
  其他职位: '仅作为尾部 fallback canonical，用于暂无法可靠归并的综合培养或储备类岗位，需人工复核。',
};

const majorBoundaryNotes: Record<string, string> = {
  计算机: '收口计算机、软件工程、数据科学、网络工程、信息安全、物联网等信息技术主流专业。',
  人工智能: '收口 AI、智能科学与技术、机器人工程等 AI 专项专业。',
  电子信息: '收口电子信息工程、微电子、集成电路、光电信息类专业。',
  通信: '收口通信工程、信息与通信工程类专业。',
  自动化: '收口自动化、控制工程、控制科学与工程类专业。',
  电气: '收口电气工程及其自动化、电机与电器、电力系统类专业。',
  机械: '收口机械工程、机械设计制造及其自动化、机电一体化类专业。',
  材料化工: '收口材料、化工、应用化学等材料与化工相关专业。',
  能源动力: '收口能源、热能、核工程、动力工程类专业。',
  土木建筑: '收口土木、建筑、城乡规划、工程管理类专业。',
  数学统计: '收口数学、统计学、应用统计、数理统计类专业。',
  生物: '收口生物工程、生物科学、生物技术类专业。',
  医学: '收口临床医学、护理、药学、公共卫生等医学健康专业。',
  农学: '收口农业、林业、动物科学等农学相关专业。',
  财务: '收口财务管理、会计学、审计学、税务等财会专业。',
  金融: '收口金融学、金融工程、金融科技、保险精算类专业。',
  经管: '收口经济学、工商管理、管理学、国贸、行政管理类专业。',
  市场营销: '收口市场营销、营销、品牌传播、商务策划类专业。',
  人力资源: '收口人力资源管理、人资管理、劳动关系类专业。',
  法学: '收口法律、法学专业、知识产权类专业。',
  新闻传播: '收口新闻学、传播学、广告学、广播电视类专业。',
  语言: '收口汉语言、英语、翻译、商务英语、小语种类专业。',
  教育: '收口教育学、学科教学、课程与教学论、心理学类专业。',
  物流供应链: '收口物流管理、供应链管理、工业工程类专业。',
};

const mappingRows: MappingRow[] = [
  { domain: 'JOB_TITLE', oldName: '软件开发', newCanonical: '开发', matchMode: 'contains', note: '历史长写法回收为通用开发主词。' },
  { domain: 'JOB_TITLE', oldName: '软件开发工程师', newCanonical: '开发', matchMode: 'contains', note: '长 canonical 下沉为 alias。' },
  { domain: 'JOB_TITLE', oldName: '开发工程师', newCanonical: '开发', matchMode: 'contains', note: '保留通用开发召回。' },
  { domain: 'JOB_TITLE', oldName: '研发工程师', newCanonical: '研发', matchMode: 'contains', note: '研发与开发明确分开。' },
  { domain: 'JOB_TITLE', oldName: '研究开发', newCanonical: '研发', matchMode: 'contains', note: '研发类旧长词统一收口。' },
  { domain: 'JOB_TITLE', oldName: '后端开发工程师', newCanonical: '后端', matchMode: 'contains', note: '后端方向独立。' },
  { domain: 'JOB_TITLE', oldName: 'Java后端开发', newCanonical: '后端', matchMode: 'contains', note: 'Java 后端细写法下沉为 alias。' },
  { domain: 'JOB_TITLE', oldName: '前端开发工程师', newCanonical: '前端', matchMode: 'contains', note: '前端方向独立。' },
  { domain: 'JOB_TITLE', oldName: '移动端开发', newCanonical: '客户端', matchMode: 'contains', note: '移动端并入客户端。' },
  { domain: 'JOB_TITLE', oldName: '算法工程师', newCanonical: '算法', matchMode: 'contains', note: '算法岗位统一收口。' },
  { domain: 'JOB_TITLE', oldName: '数据开发', newCanonical: '大数据', matchMode: 'contains', note: '数据工程类统一到大数据。' },
  { domain: 'JOB_TITLE', oldName: 'AI工程师', newCanonical: '人工智能', matchMode: 'contains', note: 'AI 专项统一到人工智能。' },
  { domain: 'JOB_TITLE', oldName: '信息安全', newCanonical: '安全', matchMode: 'contains', note: '安全类统一收口。' },
  { domain: 'JOB_TITLE', oldName: '测试开发', newCanonical: '测试', matchMode: 'contains', note: '测开统一进入测试 canonical。' },
  { domain: 'JOB_TITLE', oldName: 'DevOps', newCanonical: '运维', matchMode: 'exact', note: '英文缩写按 exact 归一。' },
  { domain: 'JOB_TITLE', oldName: '嵌入式开发', newCanonical: '硬件', matchMode: 'contains', note: '嵌入式相关统一并入硬件。' },
  { domain: 'JOB_TITLE', oldName: '产品经理', newCanonical: '产品', matchMode: 'contains', note: '旧细分产品主词下沉为 alias。' },
  { domain: 'JOB_TITLE', oldName: '运营管理', newCanonical: '运营', matchMode: 'contains', note: '旧长 canonical 改为 alias。' },
  { domain: 'JOB_TITLE', oldName: '数据分析师', newCanonical: '数据分析', matchMode: 'contains', note: '分析类独立，不并入大数据。' },
  { domain: 'JOB_TITLE', oldName: 'UI设计师', newCanonical: 'UI', matchMode: 'contains', note: 'UI 专项保留独立主词。' },
  { domain: 'JOB_TITLE', oldName: '人力资源', newCanonical: '人力', matchMode: 'contains', note: 'HR 类统一收口。' },
  { domain: 'JOB_TITLE', oldName: '行政', newCanonical: '人事 / 行政', matchMode: 'exact', note: '高歧义短词仅归一，不放开裸词扩召回。' },
  { domain: 'JOB_TITLE', oldName: '财务管理', newCanonical: '财务', matchMode: 'contains', note: '财务岗位类旧写法统一收口。' },
  { domain: 'JOB_TITLE', oldName: '市场营销', newCanonical: '营销', matchMode: 'contains', note: '营销与市场分开治理。' },
  { domain: 'JOB_TITLE', oldName: '机械工程师', newCanonical: '工程师', matchMode: 'contains', note: '制造工程类统一收口。' },
  { domain: 'JOB_TITLE', oldName: '管理培训生', newCanonical: '管培生', matchMode: 'contains', note: '校招专项岗位统一收口。' },
  { domain: 'JOB_TITLE', oldName: '运营培训生', newCanonical: '培训生', matchMode: 'contains', note: '培训体系单独收口。' },
  { domain: 'JOB_TITLE', oldName: '暑期实习生', newCanonical: '实习生', matchMode: 'contains', note: '实习类统一收口。' },
  { domain: 'JOB_TITLE', oldName: '信息技术岗', newCanonical: 'IT技术', matchMode: 'contains', note: '企业 IT 支持类统一收口。' },
  { domain: 'JOB_TITLE', oldName: '储备干部', newCanonical: '其他职位', matchMode: 'contains', note: '暂无法可靠归类时进入 fallback。' },
  { domain: 'MAJOR', oldName: '计算机科学与技术', newCanonical: '计算机', matchMode: 'contains', note: '细分全称下沉为 alias。' },
  { domain: 'MAJOR', oldName: '软件工程', newCanonical: '计算机', matchMode: 'contains', note: '软件工程收口到计算机大类。' },
  { domain: 'MAJOR', oldName: '数据科学与大数据技术', newCanonical: '计算机', matchMode: 'contains', note: '数据技术类收口到计算机大类。' },
  { domain: 'MAJOR', oldName: '网络工程', newCanonical: '计算机', matchMode: 'contains', note: '网络工程统一到计算机大类。' },
  { domain: 'MAJOR', oldName: '智能科学与技术', newCanonical: '人工智能', matchMode: 'contains', note: 'AI 专项单独收口。' },
  { domain: 'MAJOR', oldName: '电子信息工程', newCanonical: '电子信息', matchMode: 'contains', note: '工程全称下沉为 alias。' },
  { domain: 'MAJOR', oldName: '通信工程', newCanonical: '通信', matchMode: 'contains', note: '通信工程统一收口。' },
  { domain: 'MAJOR', oldName: '电气工程及其自动化', newCanonical: '电气', matchMode: 'contains', note: '典型长全称下沉为 alias。' },
  { domain: 'MAJOR', oldName: '机械设计制造及其自动化', newCanonical: '机械', matchMode: 'contains', note: '机械细分长全称统一收口。' },
  { domain: 'MAJOR', oldName: '材料科学与工程', newCanonical: '材料化工', matchMode: 'contains', note: '材料/化工合并为大类 canonical。' },
  { domain: 'MAJOR', oldName: '化学工程与工艺', newCanonical: '材料化工', matchMode: 'contains', note: '化工类统一收口。' },
  { domain: 'MAJOR', oldName: '土木工程', newCanonical: '土木建筑', matchMode: 'contains', note: '土木与建筑统一为大类。' },
  { domain: 'MAJOR', oldName: '建筑学', newCanonical: '土木建筑', matchMode: 'contains', note: '建筑类统一收口。' },
  { domain: 'MAJOR', oldName: '统计学', newCanonical: '数学统计', matchMode: 'contains', note: '数学与统计统一为大类。' },
  { domain: 'MAJOR', oldName: '临床医学', newCanonical: '医学', matchMode: 'contains', note: '医学相关统一收口。' },
  { domain: 'MAJOR', oldName: '护理', newCanonical: '医学', matchMode: 'exact', note: '高频短词可直接归一。' },
  { domain: 'MAJOR', oldName: '财务管理', newCanonical: '财务', matchMode: 'contains', note: '财会专业统一收口。' },
  { domain: 'MAJOR', oldName: '会计学', newCanonical: '财务', matchMode: 'contains', note: '财会全称下沉为 alias。' },
  { domain: 'MAJOR', oldName: '金融学', newCanonical: '金融', matchMode: 'contains', note: '金融类统一收口。' },
  { domain: 'MAJOR', oldName: '工商管理', newCanonical: '经管', matchMode: 'contains', note: '经管相关统一收口。' },
  { domain: 'MAJOR', oldName: '市场营销专业', newCanonical: '市场营销', matchMode: 'contains', note: '营销专业独立保留。' },
  { domain: 'MAJOR', oldName: '人力资源管理', newCanonical: '人力资源', matchMode: 'contains', note: '人资专业独立保留。' },
  { domain: 'MAJOR', oldName: '法学专业', newCanonical: '法学', matchMode: 'contains', note: '法学统一收口。' },
  { domain: 'MAJOR', oldName: '新闻学', newCanonical: '新闻传播', matchMode: 'contains', note: '传播相关统一收口。' },
  { domain: 'MAJOR', oldName: '英语', newCanonical: '语言', matchMode: 'contains', note: '语言类统一收口。' },
  { domain: 'MAJOR', oldName: '教育学', newCanonical: '教育', matchMode: 'contains', note: '教育类统一收口。' },
  { domain: 'MAJOR', oldName: '供应链管理', newCanonical: '物流供应链', matchMode: 'contains', note: '物流与供应链并为单一大类。' },
];

function assertBoundaryNotes(terms: SeedNormalizationTermItem[], notes: Record<string, string>, label: string) {
  const missing = terms.map((item) => item.canonicalName).filter((name) => !notes[name]);
  if (missing.length) {
    throw new Error(`${label} 缺少边界说明：${missing.join('、')}`);
  }
}

function escapeMarkdown(value: string | null | undefined) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br />');
}

function groupAliasesByCanonical(aliases: SeedNormalizationAliasItem[]) {
  const map = new Map<string, SeedNormalizationAliasItem[]>();
  for (const alias of aliases) {
    const list = map.get(alias.canonicalName) ?? [];
    list.push(alias);
    map.set(alias.canonicalName, list.sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)));
  }
  return map;
}

function buildFinalizeTable(
  title: string,
  domain: Domain,
  terms: SeedNormalizationTermItem[],
  aliases: SeedNormalizationAliasItem[],
  boundaryNotes: Record<string, string>,
) {
  const aliasMap = groupAliasesByCanonical(aliases);
  const rows = terms.map((term) => {
    const aliasPreview = (aliasMap.get(term.canonicalName) ?? []).slice(0, 6).map((item) => item.aliasName).join('、');
    return `| ${escapeMarkdown(term.canonicalName)} | ${escapeMarkdown(term.canonicalCode)} | ${escapeMarkdown(trackLabelMap[String(term.metadata?.track ?? '')] ?? String(term.metadata?.track ?? '未分类'))} | ${(aliasMap.get(term.canonicalName) ?? []).length} | ${escapeMarkdown(aliasPreview || '—')} | ${escapeMarkdown(boundaryNotes[term.canonicalName])} |`;
  });

  const principleBlock = domain === 'JOB_TITLE'
    ? `- **短 canonical 优先**：主词仅保留平台长期稳定使用的短词 / 大类词。\n- **长词下沉 alias**：岗位细写法、历史长 canonical 统一下沉为 alias。\n- **方向显式分开**：\`开发\` 与 \`研发\` 保持分离，\`产品\` 与 \`运营\` 保持分离。\n- **尾部兜底可追踪**：\`其他职位\` 仅作为人工复核 fallback 使用，不再标记为 legacy bucket。`
    : `- **短 canonical 优先**：主词仅保留平台稳定使用的大类专业词。\n- **长全称下沉 alias**：学院全称、专业全称、旧长 canonical 统一下沉为 alias。\n- **专业大类收口**：如 \`计算机 / 财务 / 机械\` 等大类作为主词，不再把细分全称提升为 canonical。\n- **组合类可治理**：\`材料化工\`、\`土木建筑\`、\`物流供应链\` 等组合 canonical 继续保留，便于运营维护与回填。`;

  return `# ${title}\n\n## 文档定位\n\n- **适用范围**：仅覆盖本轮标准化改造纳入范围的 \`${domain}\` 域。\n- **源码基线**：\`apps/api/src/modules/jobs/jobs-normalization.seed-data.ts\`。\n- **版本口径**：2026-04-29 正式定稿口径；后续若 seed 变更，应重新生成本表并同步评审。\n\n## 定稿原则\n\n${principleBlock}\n\n## 定稿清单\n\n| canonical | 编码 | 分类 | alias 数量 | 典型 alias | 边界说明 |\n| --- | --- | --- | ---: | --- | --- |\n${rows.join('\n')}\n\n## 补充说明\n\n- 本表只列正式 canonical；完整 alias 归属见 \`docs/alias归属说明表.md\`。\n- 旧长 canonical / 旧写法回填关系见 \`docs/旧canonical到新canonical映射表.md\`。\n`;
}

function buildAliasOwnershipDoc() {
  const sections = [
    {
      title: 'JOB_TITLE',
      terms: jobTitleTermRound1SeedItems,
      aliases: jobTitleAliasRound1SeedItems,
      notes: jobTitleBoundaryNotes,
    },
    {
      title: 'MAJOR',
      terms: majorTermRound1SeedItems,
      aliases: majorAliasRound1SeedItems,
      notes: majorBoundaryNotes,
    },
  ].map((section) => {
    const aliasMap = groupAliasesByCanonical(section.aliases);
    const rows = section.terms.map((term) => {
      const items = aliasMap.get(term.canonicalName) ?? [];
      const exactAliases = items.filter((item) => item.matchMode === 'exact').map((item) => item.aliasName).join('、') || '—';
      const containsAliases = items.filter((item) => item.matchMode === 'contains').map((item) => item.aliasName).join('、') || '—';
      const strategy = exactAliases !== '—' && containsAliases !== '—'
        ? '短词/高歧义词走 exact，稳定长词走 contains'
        : exactAliases !== '—'
          ? '仅 exact，避免误召回'
          : '仅 contains，用于搜索与推荐扩召回';
      return `| ${escapeMarkdown(term.canonicalName)} | ${escapeMarkdown(exactAliases)} | ${escapeMarkdown(containsAliases)} | ${escapeMarkdown(strategy)} | ${escapeMarkdown(section.notes[term.canonicalName])} |`;
    });

    return `## ${section.title}\n\n| canonical | exact alias | contains alias | 匹配策略 | 归属说明 |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}`;
  });

  return `# alias归属说明表\n\n## 文档定位\n\n- **适用范围**：本轮标准化改造重点域 \`JOB_TITLE\` 与 \`MAJOR\`。\n- **目的**：为后台词典维护、导入导出审核、搜索/推荐回归提供统一 alias 归属说明。\n- **源码基线**：\`apps/api/src/modules/jobs/jobs-normalization.seed-data.ts\`。\n\n## 维护规则\n\n- **exact**：仅用于查词归一，不进入搜索与推荐的文本扩召回。\n- **contains**：除归一外，还会进入搜索与推荐文本召回，仅用于稳定长词。\n- **新增 alias 前**：必须先确认是否已有 canonical 可挂载；禁止把长全称再提升回 canonical。\n\n${sections.join('\n\n')}\n`;
}

function buildMappingDoc() {
  const grouped = new Map<Domain, MappingRow[]>();
  for (const row of mappingRows) {
    const list = grouped.get(row.domain) ?? [];
    list.push(row);
    grouped.set(row.domain, list);
  }

  const sections = (['JOB_TITLE', 'MAJOR'] as const).map((domain) => {
    const rows = (grouped.get(domain) ?? []).map((row) => `| ${escapeMarkdown(row.oldName)} | ${escapeMarkdown(row.newCanonical)} | ${escapeMarkdown(row.matchMode)} | ${escapeMarkdown(row.note)} |`);
    return `## ${domain}\n\n| 旧 canonical / 旧写法 | 新 canonical | 匹配方式 | 说明 |\n| --- | --- | --- | --- |\n${rows.join('\n')}`;
  });

  return `# 旧canonical到新canonical映射表\n\n## 文档定位\n\n- **用途**：为用户画像回填、运营导入审核、历史规则对账提供“旧写法 → 新短 canonical”映射依据。\n- **口径说明**：历史旧 canonical 快照未单独归档，本表以**当前 seed 中已下沉为 alias 的旧长 canonical / 高频旧写法**作为正式映射依据。\n- **全量 alias 归属**：见 \`docs/alias归属说明表.md\`。
\n\n${sections.join('\n\n')}\n`;
}

async function main() {
  assertBoundaryNotes(jobTitleTermRound1SeedItems, jobTitleBoundaryNotes, 'JOB_TITLE');
  assertBoundaryNotes(majorTermRound1SeedItems, majorBoundaryNotes, 'MAJOR');

  await mkdir(docsDir, { recursive: true });

  const files = [
    {
      fileName: 'JOB_TITLE canonical 定稿表.md',
      content: buildFinalizeTable('JOB_TITLE canonical 定稿表', 'JOB_TITLE', jobTitleTermRound1SeedItems, jobTitleAliasRound1SeedItems, jobTitleBoundaryNotes),
    },
    {
      fileName: 'MAJOR canonical 定稿表.md',
      content: buildFinalizeTable('MAJOR canonical 定稿表', 'MAJOR', majorTermRound1SeedItems, majorAliasRound1SeedItems, majorBoundaryNotes),
    },
    {
      fileName: '旧canonical到新canonical映射表.md',
      content: buildMappingDoc(),
    },
    {
      fileName: 'alias归属说明表.md',
      content: buildAliasOwnershipDoc(),
    },
  ];

  await Promise.all(files.map((file) => writeFile(path.join(docsDir, file.fileName), file.content, 'utf8')));

  console.log(`Generated ${files.length} normalization deliverables.`);
  files.forEach((file) => console.log(`- docs/${file.fileName}`));
}

void main();
