export type SeedNormalizationDomain = 'LOCATION' | 'JOB_TITLE' | 'MAJOR' | 'DEGREE' | 'COMPANY';

export type SeedNormalizationTermItem = {
  domain: SeedNormalizationDomain;
  canonicalName: string;
  canonicalCode?: string;
  level?: string | null;
  sortOrder?: number;
  metadata?: Record<string, unknown> | null;
};

export type SeedNormalizationAliasItem = {
  domain: SeedNormalizationDomain;
  canonicalName: string;
  aliasName: string;
  matchMode?: 'exact' | 'contains';
  status?: 'active' | 'inactive';
  source?: string;
  sortOrder?: number;
};

export type SeedLocationHierarchyItem = {
  provinceCanonicalName: string;
  cityCanonicalName: string;
  status?: 'active' | 'inactive';
};

const LOCATION_TERM_ROUND1 = 'location-terms-r1-20260428';
const MAIN_TERM_ROUND1 = 'main-terms-r2-20260429';
const MAIN_ALIAS_ROUND1 = 'main-aliases-r2-20260429';
const LOCATION_HIERARCHY_ROUND1 = 'location-hierarchy-r1-20260428';

function createLocationProvinceTerm(
  canonicalName: string,
  canonicalCode: string,
  sortOrder: number,
  region: string,
): SeedNormalizationTermItem {
  return {
    domain: 'LOCATION',
    canonicalName,
    canonicalCode,
    level: 'province',
    sortOrder,
    metadata: {
      source: 'seed',
      seedRound: LOCATION_TERM_ROUND1,
      seedLayer: 'terms',
      locationLevel: 'province',
      region,
      coverage: 'mainland-round1',
    },
  };
}

function createLocationCityTerm(
  canonicalName: string,
  canonicalCode: string,
  intendedProvince: string,
  sortOrder: number,
  region: string,
): SeedNormalizationTermItem {
  return {
    domain: 'LOCATION',
    canonicalName,
    canonicalCode,
    level: 'city',
    sortOrder,
    metadata: {
      source: 'seed',
      seedRound: LOCATION_TERM_ROUND1,
      seedLayer: 'terms',
      locationLevel: 'city',
      intendedProvince,
      region,
      coverage: 'mainland-round1',
    },
  };
}

function createMainTerm(
  domain: Exclude<SeedNormalizationDomain, 'LOCATION'>,
  canonicalName: string,
  canonicalCode: string,
  sortOrder: number,
  metadata: Record<string, unknown>,
): SeedNormalizationTermItem {
  return {
    domain,
    canonicalName,
    canonicalCode,
    sortOrder,
    metadata: {
      source: 'seed',
      seedRound: MAIN_TERM_ROUND1,
      seedLayer: 'terms',
      ...metadata,
    },
  };
}

function createAlias(
  domain: SeedNormalizationDomain,
  canonicalName: string,
  aliasName: string,
  sortOrder: number,
  matchMode: 'exact' | 'contains' = 'exact',
): SeedNormalizationAliasItem {
  return {
    domain,
    canonicalName,
    aliasName,
    matchMode,
    status: 'active',
    source: 'seed',
    sortOrder,
  };
}

function createContainsAlias(
  domain: SeedNormalizationDomain,
  canonicalName: string,
  aliasName: string,
  sortOrder: number,
): SeedNormalizationAliasItem {
  return createAlias(domain, canonicalName, aliasName, sortOrder, 'contains');
}

export const locationTermRound1SeedItems: SeedNormalizationTermItem[] = [
  createLocationProvinceTerm('北京', 'CN-BJ', 100, '华北'),
  createLocationProvinceTerm('天津', 'CN-TJ', 110, '华北'),
  createLocationProvinceTerm('河北', 'CN-HEB', 120, '华北'),
  createLocationProvinceTerm('山西', 'CN-SX', 130, '华北'),
  createLocationProvinceTerm('内蒙古', 'CN-NMG', 140, '华北'),

  createLocationProvinceTerm('辽宁', 'CN-LN', 200, '东北'),
  createLocationProvinceTerm('吉林', 'CN-JL', 210, '东北'),
  createLocationProvinceTerm('黑龙江', 'CN-HLJ', 220, '东北'),

  createLocationProvinceTerm('上海', 'CN-SH', 300, '华东'),
  createLocationProvinceTerm('江苏', 'CN-JS', 310, '华东'),
  createLocationProvinceTerm('浙江', 'CN-ZJ', 320, '华东'),
  createLocationProvinceTerm('安徽', 'CN-AH', 330, '华东'),
  createLocationProvinceTerm('福建', 'CN-FJ', 340, '华东'),
  createLocationProvinceTerm('江西', 'CN-JX', 350, '华东'),
  createLocationProvinceTerm('山东', 'CN-SD', 360, '华东'),

  createLocationProvinceTerm('河南', 'CN-HEN', 400, '华中'),
  createLocationProvinceTerm('湖北', 'CN-HUB', 410, '华中'),
  createLocationProvinceTerm('湖南', 'CN-HUN', 420, '华中'),

  createLocationProvinceTerm('广东', 'CN-GD', 500, '华南'),
  createLocationProvinceTerm('广西', 'CN-GX', 510, '华南'),
  createLocationProvinceTerm('海南', 'CN-HI', 520, '华南'),

  createLocationProvinceTerm('重庆', 'CN-CQ', 600, '西南'),
  createLocationProvinceTerm('四川', 'CN-SC', 610, '西南'),
  createLocationProvinceTerm('贵州', 'CN-GZ', 620, '西南'),
  createLocationProvinceTerm('云南', 'CN-YN', 630, '西南'),
  createLocationProvinceTerm('西藏', 'CN-XZ', 640, '西南'),

  createLocationProvinceTerm('陕西', 'CN-SN', 700, '西北'),
  createLocationProvinceTerm('甘肃', 'CN-GS', 710, '西北'),
  createLocationProvinceTerm('青海', 'CN-QH', 720, '西北'),
  createLocationProvinceTerm('宁夏', 'CN-NX', 730, '西北'),
  createLocationProvinceTerm('新疆', 'CN-XJ', 740, '西北'),

  createLocationCityTerm('石家庄', 'CN-HEB-SJZ', '河北', 1210, '华北'),
  createLocationCityTerm('唐山', 'CN-HEB-TS', '河北', 1220, '华北'),
  createLocationCityTerm('秦皇岛', 'CN-HEB-QHD', '河北', 1230, '华北'),
  createLocationCityTerm('太原', 'CN-SX-TY', '山西', 1310, '华北'),
  createLocationCityTerm('呼和浩特', 'CN-NMG-HHHT', '内蒙古', 1410, '华北'),
  createLocationCityTerm('包头', 'CN-NMG-BT', '内蒙古', 1420, '华北'),

  createLocationCityTerm('沈阳', 'CN-LN-SY', '辽宁', 2010, '东北'),
  createLocationCityTerm('大连', 'CN-LN-DL', '辽宁', 2020, '东北'),
  createLocationCityTerm('长春', 'CN-JL-CC', '吉林', 2110, '东北'),
  createLocationCityTerm('吉林市', 'CN-JL-JLS', '吉林', 2120, '东北'),
  createLocationCityTerm('哈尔滨', 'CN-HLJ-HEB', '黑龙江', 2210, '东北'),

  createLocationCityTerm('南京', 'CN-JS-NJ', '江苏', 3110, '华东'),
  createLocationCityTerm('苏州', 'CN-JS-SZ', '江苏', 3120, '华东'),
  createLocationCityTerm('无锡', 'CN-JS-WX', '江苏', 3130, '华东'),
  createLocationCityTerm('常州', 'CN-JS-CZ', '江苏', 3140, '华东'),
  createLocationCityTerm('徐州', 'CN-JS-XZ', '江苏', 3150, '华东'),
  createLocationCityTerm('南通', 'CN-JS-NT', '江苏', 3160, '华东'),
  createLocationCityTerm('杭州', 'CN-ZJ-HZ', '浙江', 3210, '华东'),
  createLocationCityTerm('宁波', 'CN-ZJ-NB', '浙江', 3220, '华东'),
  createLocationCityTerm('温州', 'CN-ZJ-WZ', '浙江', 3230, '华东'),
  createLocationCityTerm('嘉兴', 'CN-ZJ-JX', '浙江', 3240, '华东'),
  createLocationCityTerm('绍兴', 'CN-ZJ-SX', '浙江', 3250, '华东'),
  createLocationCityTerm('合肥', 'CN-AH-HF', '安徽', 3310, '华东'),
  createLocationCityTerm('芜湖', 'CN-AH-WH', '安徽', 3320, '华东'),
  createLocationCityTerm('福州', 'CN-FJ-FZ', '福建', 3410, '华东'),
  createLocationCityTerm('厦门', 'CN-FJ-XM', '福建', 3420, '华东'),
  createLocationCityTerm('泉州', 'CN-FJ-QZ', '福建', 3430, '华东'),
  createLocationCityTerm('南昌', 'CN-JX-NC', '江西', 3510, '华东'),
  createLocationCityTerm('济南', 'CN-SD-JN', '山东', 3610, '华东'),
  createLocationCityTerm('青岛', 'CN-SD-QD', '山东', 3620, '华东'),
  createLocationCityTerm('烟台', 'CN-SD-YT', '山东', 3630, '华东'),

  createLocationCityTerm('郑州', 'CN-HEN-ZZ', '河南', 4010, '华中'),
  createLocationCityTerm('洛阳', 'CN-HEN-LY', '河南', 4020, '华中'),
  createLocationCityTerm('武汉', 'CN-HUB-WH', '湖北', 4110, '华中'),
  createLocationCityTerm('宜昌', 'CN-HUB-YC', '湖北', 4120, '华中'),
  createLocationCityTerm('长沙', 'CN-HUN-CS', '湖南', 4210, '华中'),
  createLocationCityTerm('株洲', 'CN-HUN-ZZ', '湖南', 4220, '华中'),

  createLocationCityTerm('广州', 'CN-GD-GZ', '广东', 5010, '华南'),
  createLocationCityTerm('深圳', 'CN-GD-SZ', '广东', 5020, '华南'),
  createLocationCityTerm('佛山', 'CN-GD-FS', '广东', 5030, '华南'),
  createLocationCityTerm('东莞', 'CN-GD-DG', '广东', 5040, '华南'),
  createLocationCityTerm('珠海', 'CN-GD-ZH', '广东', 5050, '华南'),
  createLocationCityTerm('南宁', 'CN-GX-NN', '广西', 5110, '华南'),
  createLocationCityTerm('柳州', 'CN-GX-LZ', '广西', 5120, '华南'),
  createLocationCityTerm('海口', 'CN-HI-HK', '海南', 5210, '华南'),
  createLocationCityTerm('三亚', 'CN-HI-SY', '海南', 5220, '华南'),

  createLocationCityTerm('成都', 'CN-SC-CD', '四川', 6110, '西南'),
  createLocationCityTerm('绵阳', 'CN-SC-MY', '四川', 6120, '西南'),
  createLocationCityTerm('贵阳', 'CN-GZ-GY', '贵州', 6210, '西南'),
  createLocationCityTerm('昆明', 'CN-YN-KM', '云南', 6310, '西南'),
  createLocationCityTerm('拉萨', 'CN-XZ-LS', '西藏', 6410, '西南'),

  createLocationCityTerm('西安', 'CN-SN-XA', '陕西', 7010, '西北'),
  createLocationCityTerm('宝鸡', 'CN-SN-BJ', '陕西', 7020, '西北'),
  createLocationCityTerm('兰州', 'CN-GS-LZ', '甘肃', 7110, '西北'),
  createLocationCityTerm('西宁', 'CN-QH-XN', '青海', 7210, '西北'),
  createLocationCityTerm('银川', 'CN-NX-YC', '宁夏', 7310, '西北'),
  createLocationCityTerm('乌鲁木齐', 'CN-XJ-WLMQ', '新疆', 7410, '西北'),
];

export const jobTitleTermRound1SeedItems: SeedNormalizationTermItem[] = [
  createMainTerm('JOB_TITLE', '开发', 'JOB-DEVELOPMENT', 10, {
    domain: 'JOB_TITLE',
    track: 'tech',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '研发', 'JOB-RESEARCH', 20, {
    domain: 'JOB_TITLE',
    track: 'tech',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '后端', 'JOB-BACKEND', 30, {
    domain: 'JOB_TITLE',
    track: 'tech',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '前端', 'JOB-FRONTEND', 40, {
    domain: 'JOB_TITLE',
    track: 'tech',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '客户端', 'JOB-CLIENT', 50, {
    domain: 'JOB_TITLE',
    track: 'tech',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '算法', 'JOB-ALGORITHM', 60, {
    domain: 'JOB_TITLE',
    track: 'tech',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '大数据', 'JOB-BIGDATA', 70, {
    domain: 'JOB_TITLE',
    track: 'data',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '人工智能', 'JOB-AI', 80, {
    domain: 'JOB_TITLE',
    track: 'tech',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '安全', 'JOB-SECURITY', 90, {
    domain: 'JOB_TITLE',
    track: 'tech',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '测试', 'JOB-TEST', 100, {
    domain: 'JOB_TITLE',
    track: 'tech',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '运维', 'JOB-OPERATIONS-TECH', 110, {
    domain: 'JOB_TITLE',
    track: 'tech-ops',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '硬件', 'JOB-HARDWARE', 120, {
    domain: 'JOB_TITLE',
    track: 'tech-hardware',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '产品', 'JOB-PRODUCT', 130, {
    domain: 'JOB_TITLE',
    track: 'product',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '运营', 'JOB-OPERATIONS', 140, {
    domain: 'JOB_TITLE',
    track: 'operations',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '数据分析', 'JOB-DATA-ANALYSIS', 150, {
    domain: 'JOB_TITLE',
    track: 'data-analysis',
    coverage: 'core-round2',
    note: 'analytics-reporting-and-bi',
  }),
  createMainTerm('JOB_TITLE', 'UI', 'JOB-UI', 160, {
    domain: 'JOB_TITLE',
    track: 'design',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '设计', 'JOB-DESIGN', 170, {
    domain: 'JOB_TITLE',
    track: 'design',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '人力', 'JOB-HR', 180, {
    domain: 'JOB_TITLE',
    track: 'functional',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '人事 / 行政', 'JOB-HR-ADMIN', 190, {
    domain: 'JOB_TITLE',
    track: 'functional',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '财务', 'JOB-FINANCE', 200, {
    domain: 'JOB_TITLE',
    track: 'functional',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '市场', 'JOB-MARKET', 210, {
    domain: 'JOB_TITLE',
    track: 'market',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '营销', 'JOB-MARKETING', 220, {
    domain: 'JOB_TITLE',
    track: 'market',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '工程师', 'JOB-ENGINEER', 230, {
    domain: 'JOB_TITLE',
    track: 'engineering',
    coverage: 'core-round2',
    note: 'manufacturing-and-general-engineering-track',
  }),
  createMainTerm('JOB_TITLE', '管培生', 'JOB-MT', 240, {
    domain: 'JOB_TITLE',
    track: 'campus',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '培训生', 'JOB-TRAINEE', 250, {
    domain: 'JOB_TITLE',
    track: 'campus',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '实习生', 'JOB-INTERN', 260, {
    domain: 'JOB_TITLE',
    track: 'campus',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', '校园大使', 'JOB-CAMPUS-AMBASSADOR', 270, {
    domain: 'JOB_TITLE',
    track: 'campus',
    coverage: 'core-round2',
  }),
  createMainTerm('JOB_TITLE', 'IT技术', 'JOB-IT', 280, {
    domain: 'JOB_TITLE',
    track: 'it-support',
    coverage: 'core-round2',
    note: 'enterprise-it-support-and-internal-systems',
  }),
  createMainTerm('JOB_TITLE', '其他职位', 'JOB-OTHER', 290, {
    domain: 'JOB_TITLE',
    track: 'fallback',
    coverage: 'fallback-round2',
    note: 'manual-review-required-fallback',
  }),
];

export const companyTermRound1SeedItems: SeedNormalizationTermItem[] = [
  createMainTerm('COMPANY', '中国烟草', 'COMP-CHINATOBACCO', 10, {
    domain: 'COMPANY',
    track: 'central-state',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '国家电网', 'COMP-SGCC', 20, {
    domain: 'COMPANY',
    track: 'central-state',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '腾讯', 'COMP-TENCENT', 30, {
    domain: 'COMPANY',
    track: 'internet',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '华为', 'COMP-HUAWEI', 40, {
    domain: 'COMPANY',
    track: 'ict',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '中国电信', 'COMP-CHINATELECOM', 50, {
    domain: 'COMPANY',
    track: 'operator',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '招商银行', 'COMP-CMB', 60, {
    domain: 'COMPANY',
    track: 'bank',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '阿里', 'COMP-ALIBABA', 70, {
    domain: 'COMPANY',
    track: 'internet',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '字节跳动', 'COMP-BYTEDANCE', 80, {
    domain: 'COMPANY',
    track: 'internet',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '美团', 'COMP-MEITUAN', 90, {
    domain: 'COMPANY',
    track: 'internet',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '京东', 'COMP-JD', 100, {
    domain: 'COMPANY',
    track: 'internet',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '百度', 'COMP-BAIDU', 110, {
    domain: 'COMPANY',
    track: 'internet',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '中国移动', 'COMP-CHINAMOBILE', 120, {
    domain: 'COMPANY',
    track: 'operator',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '中国联通', 'COMP-CHINAUNICOM', 130, {
    domain: 'COMPANY',
    track: 'operator',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '中国银行', 'COMP-BOC', 140, {
    domain: 'COMPANY',
    track: 'bank',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '工商银行', 'COMP-ICBC', 150, {
    domain: 'COMPANY',
    track: 'bank',
    coverage: 'core-round1',
  }),
  createMainTerm('COMPANY', '建设银行', 'COMP-CCB', 160, {
    domain: 'COMPANY',
    track: 'bank',
    coverage: 'core-round1',
  }),
];

export const degreeTermRound1SeedItems: SeedNormalizationTermItem[] = [
  createMainTerm('DEGREE', '中专', 'DEGREE-SECONDARY', 10, {
    domain: 'DEGREE',
    rank: 1,
    coverage: 'core-round1',
  }),
  createMainTerm('DEGREE', '专科', 'DEGREE-JUNIOR', 20, {
    domain: 'DEGREE',
    rank: 2,
    coverage: 'core-round1',
  }),
  createMainTerm('DEGREE', '本科', 'DEGREE-BACHELOR', 30, {
    domain: 'DEGREE',
    rank: 3,
    coverage: 'core-round1',
  }),
  createMainTerm('DEGREE', '硕士', 'DEGREE-MASTER', 40, {
    domain: 'DEGREE',
    rank: 4,
    coverage: 'core-round1',
  }),
  createMainTerm('DEGREE', '博士', 'DEGREE-DOCTOR', 50, {
    domain: 'DEGREE',
    rank: 5,
    coverage: 'core-round1',
  }),
];

export const majorTermRound1SeedItems: SeedNormalizationTermItem[] = [
  createMainTerm('MAJOR', '计算机', 'MAJOR-COMPUTER', 10, {
    domain: 'MAJOR',
    track: 'technology',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '人工智能', 'MAJOR-AI', 20, {
    domain: 'MAJOR',
    track: 'technology',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '电子信息', 'MAJOR-ELECTRONICS', 30, {
    domain: 'MAJOR',
    track: 'engineering',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '通信', 'MAJOR-TELECOM', 40, {
    domain: 'MAJOR',
    track: 'engineering',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '自动化', 'MAJOR-AUTOMATION', 50, {
    domain: 'MAJOR',
    track: 'engineering',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '电气', 'MAJOR-ELECTRICAL', 60, {
    domain: 'MAJOR',
    track: 'engineering',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '机械', 'MAJOR-MECHANICAL', 70, {
    domain: 'MAJOR',
    track: 'engineering',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '材料化工', 'MAJOR-MATERIAL-CHEM', 80, {
    domain: 'MAJOR',
    track: 'engineering',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '能源动力', 'MAJOR-ENERGY', 90, {
    domain: 'MAJOR',
    track: 'engineering',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '土木建筑', 'MAJOR-CIVIL-ARCH', 100, {
    domain: 'MAJOR',
    track: 'engineering',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '数学统计', 'MAJOR-MATH-STAT', 110, {
    domain: 'MAJOR',
    track: 'science',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '生物', 'MAJOR-BIOLOGY', 120, {
    domain: 'MAJOR',
    track: 'science',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '医学', 'MAJOR-MEDICAL', 130, {
    domain: 'MAJOR',
    track: 'medical',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '农学', 'MAJOR-AGRICULTURE', 140, {
    domain: 'MAJOR',
    track: 'science',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '财务', 'MAJOR-FINANCE-ACCOUNTING', 150, {
    domain: 'MAJOR',
    track: 'business',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '金融', 'MAJOR-FINANCE', 160, {
    domain: 'MAJOR',
    track: 'business',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '经管', 'MAJOR-BUSINESS', 170, {
    domain: 'MAJOR',
    track: 'business',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '市场营销', 'MAJOR-MARKETING', 180, {
    domain: 'MAJOR',
    track: 'business',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '人力资源', 'MAJOR-HR', 190, {
    domain: 'MAJOR',
    track: 'business',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '法学', 'MAJOR-LAW', 200, {
    domain: 'MAJOR',
    track: 'social-science',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '新闻传播', 'MAJOR-MEDIA', 210, {
    domain: 'MAJOR',
    track: 'social-science',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '语言', 'MAJOR-LANGUAGE', 220, {
    domain: 'MAJOR',
    track: 'social-science',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '教育', 'MAJOR-EDUCATION', 230, {
    domain: 'MAJOR',
    track: 'social-science',
    coverage: 'core-round2',
  }),
  createMainTerm('MAJOR', '物流供应链', 'MAJOR-LOGISTICS-SC', 240, {
    domain: 'MAJOR',
    track: 'business',
    coverage: 'core-round2',
  }),
];

export const normalizationTermSeedItems: SeedNormalizationTermItem[] = [
  ...locationTermRound1SeedItems,
  ...jobTitleTermRound1SeedItems,
  ...companyTermRound1SeedItems,
  ...degreeTermRound1SeedItems,
  ...majorTermRound1SeedItems,
];

export const locationAliasSeedItems: SeedNormalizationAliasItem[] = [
  createAlias('LOCATION', '山东', '山东省', 10),
  createAlias('LOCATION', '山东', '鲁', 20),
  createAlias('LOCATION', '江苏', '江苏省', 10),
  createAlias('LOCATION', '江苏', '苏', 20),
  createAlias('LOCATION', '广东', '广东省', 10),
  createAlias('LOCATION', '广东', '粤', 20),
  createAlias('LOCATION', '浙江', '浙江省', 10),
  createAlias('LOCATION', '浙江', '浙', 20),
  createAlias('LOCATION', '上海', '上海市', 10),
  createAlias('LOCATION', '上海', '沪', 20),
  createAlias('LOCATION', '济南', '济南市', 10),
  createAlias('LOCATION', '青岛', '青岛市', 10),
  createAlias('LOCATION', '烟台', '烟台市', 10),
  createAlias('LOCATION', '南京', '南京市', 10),
  createAlias('LOCATION', '无锡', '无锡市', 10),
  createAlias('LOCATION', '苏州', '苏州市', 10),
  createAlias('LOCATION', '徐州', '徐州市', 10),
  createAlias('LOCATION', '常州', '常州市', 10),
  createAlias('LOCATION', '深圳', '深圳市', 10),
  createAlias('LOCATION', '深圳', '深', 20),
  createAlias('LOCATION', '广州', '广州市', 10),
  createAlias('LOCATION', '广州', '穗', 20),
  createAlias('LOCATION', '杭州', '杭州市', 10),
  createAlias('LOCATION', '杭州', '杭', 20),
];

export const jobTitleAliasRound1SeedItems: SeedNormalizationAliasItem[] = [
  createContainsAlias('JOB_TITLE', '开发', '软件开发', 10),
  createContainsAlias('JOB_TITLE', '开发', '软件开发工程师', 20),
  createContainsAlias('JOB_TITLE', '开发', '开发工程师', 30),
  createContainsAlias('JOB_TITLE', '开发', '应用开发', 40),
  createContainsAlias('JOB_TITLE', '开发', 'Web开发', 50),

  createContainsAlias('JOB_TITLE', '研发', '研发工程师', 10),
  createContainsAlias('JOB_TITLE', '研发', '技术研发', 20),
  createContainsAlias('JOB_TITLE', '研发', '研究开发', 30),
  createContainsAlias('JOB_TITLE', '研发', '研发类', 40),

  createContainsAlias('JOB_TITLE', '后端', '后端开发', 10),
  createContainsAlias('JOB_TITLE', '后端', '后端工程师', 20),
  createContainsAlias('JOB_TITLE', '后端', '后端开发工程师', 30),
  createContainsAlias('JOB_TITLE', '后端', 'Java开发', 40),
  createContainsAlias('JOB_TITLE', '后端', 'Java后端', 50),
  createContainsAlias('JOB_TITLE', '后端', 'Java工程师', 60),
  createContainsAlias('JOB_TITLE', '后端', 'Java开发工程师', 70),
  createContainsAlias('JOB_TITLE', '后端', 'Java后端工程师', 80),
  createContainsAlias('JOB_TITLE', '后端', 'Java后端开发', 90),
  createContainsAlias('JOB_TITLE', '后端', '服务端开发', 100),
  createContainsAlias('JOB_TITLE', '后端', '服务端工程师', 110),

  createContainsAlias('JOB_TITLE', '前端', '前端开发', 10),
  createContainsAlias('JOB_TITLE', '前端', '前端工程师', 20),
  createContainsAlias('JOB_TITLE', '前端', '前端开发工程师', 30),
  createContainsAlias('JOB_TITLE', '前端', 'Web前端', 40),
  createContainsAlias('JOB_TITLE', '前端', 'Web前端开发', 50),

  createContainsAlias('JOB_TITLE', '客户端', 'iOS开发', 10),
  createContainsAlias('JOB_TITLE', '客户端', 'Android开发', 20),
  createContainsAlias('JOB_TITLE', '客户端', '客户端开发', 30),
  createContainsAlias('JOB_TITLE', '客户端', '移动端开发', 40),
  createContainsAlias('JOB_TITLE', '客户端', '移动端工程师', 50),

  createAlias('JOB_TITLE', '算法', '算法岗', 10),
  createContainsAlias('JOB_TITLE', '算法', '算法工程师', 20),
  createContainsAlias('JOB_TITLE', '算法', '算法开发工程师', 30),
  createContainsAlias('JOB_TITLE', '算法', '算法研究员', 40),
  createContainsAlias('JOB_TITLE', '算法', '推荐算法', 50),
  createContainsAlias('JOB_TITLE', '算法', '搜索算法', 60),

  createContainsAlias('JOB_TITLE', '大数据', '数据开发', 10),
  createContainsAlias('JOB_TITLE', '大数据', '大数据开发', 20),
  createContainsAlias('JOB_TITLE', '大数据', '大数据工程师', 30),
  createContainsAlias('JOB_TITLE', '大数据', '数据平台', 40),

  createAlias('JOB_TITLE', '人工智能', 'AI', 10),
  createContainsAlias('JOB_TITLE', '人工智能', 'AI工程师', 20),
  createContainsAlias('JOB_TITLE', '人工智能', 'AIGC工程师', 30),
  createContainsAlias('JOB_TITLE', '人工智能', '智能体工程师', 40),

  createContainsAlias('JOB_TITLE', '安全', '信息安全', 10),
  createContainsAlias('JOB_TITLE', '安全', '网络安全', 20),
  createContainsAlias('JOB_TITLE', '安全', '安全工程师', 30),

  createAlias('JOB_TITLE', '测试', '测开', 10),
  createAlias('JOB_TITLE', '测试', 'QA', 20),
  createContainsAlias('JOB_TITLE', '测试', '测试开发', 30),
  createContainsAlias('JOB_TITLE', '测试', '测试工程师', 40),
  createContainsAlias('JOB_TITLE', '测试', '测试开发工程师', 50),
  createContainsAlias('JOB_TITLE', '测试', '质量测试', 60),

  createAlias('JOB_TITLE', '运维', 'DevOps', 10),
  createAlias('JOB_TITLE', '运维', 'SRE', 20),
  createContainsAlias('JOB_TITLE', '运维', '运维开发', 30),
  createContainsAlias('JOB_TITLE', '运维', '运维工程师', 40),
  createContainsAlias('JOB_TITLE', '运维', '运维开发工程师', 50),

  createAlias('JOB_TITLE', '硬件', '嵌入式', 10),
  createContainsAlias('JOB_TITLE', '硬件', '嵌入式开发', 20),
  createContainsAlias('JOB_TITLE', '硬件', '硬件工程师', 30),
  createContainsAlias('JOB_TITLE', '硬件', '嵌入式工程师', 40),
  createContainsAlias('JOB_TITLE', '硬件', '嵌入式开发工程师', 50),
  createContainsAlias('JOB_TITLE', '硬件', '嵌入式软件工程师', 60),

  createAlias('JOB_TITLE', '产品', 'PM', 10),
  createContainsAlias('JOB_TITLE', '产品', '产品经理', 20),
  createContainsAlias('JOB_TITLE', '产品', '产品策划', 30),
  createContainsAlias('JOB_TITLE', '产品', '产品策划经理', 40),
  createContainsAlias('JOB_TITLE', '产品', '产品岗', 50),

  createContainsAlias('JOB_TITLE', '运营', '运营管理', 10),
  createContainsAlias('JOB_TITLE', '运营', '运营岗', 20),
  createContainsAlias('JOB_TITLE', '运营', '产品运营', 30),
  createContainsAlias('JOB_TITLE', '运营', '用户运营', 40),
  createContainsAlias('JOB_TITLE', '运营', '内容运营', 50),
  createContainsAlias('JOB_TITLE', '运营', '电商运营', 60),
  createContainsAlias('JOB_TITLE', '运营', '短视频运营', 70),
  createContainsAlias('JOB_TITLE', '运营', '视频运营', 80),
  createContainsAlias('JOB_TITLE', '运营', '社群运营', 90),
  createContainsAlias('JOB_TITLE', '运营', '用户增长运营', 100),
  createContainsAlias('JOB_TITLE', '运营', '短视频内容运营', 110),
  createContainsAlias('JOB_TITLE', '运营', '运营管理培训生', 120),

  createAlias('JOB_TITLE', '数据分析', '数据', 10),
  createContainsAlias('JOB_TITLE', '数据分析', '数据分析师', 20),
  createContainsAlias('JOB_TITLE', '数据分析', '数据分析工程师', 30),

  createAlias('JOB_TITLE', 'UI', 'UI', 10),
  createContainsAlias('JOB_TITLE', 'UI', 'UI设计', 20),
  createContainsAlias('JOB_TITLE', 'UI', 'UI设计师', 30),
  createContainsAlias('JOB_TITLE', 'UI', 'UI视觉设计', 40),
  createContainsAlias('JOB_TITLE', 'UI', '界面设计', 50),

  createContainsAlias('JOB_TITLE', '设计', '平面设计', 10),
  createContainsAlias('JOB_TITLE', '设计', '平面设计师', 20),
  createContainsAlias('JOB_TITLE', '设计', '室内设计', 30),
  createContainsAlias('JOB_TITLE', '设计', '室内设计师', 40),
  createContainsAlias('JOB_TITLE', '设计', '空间设计', 50),
  createContainsAlias('JOB_TITLE', '设计', '视觉传达设计', 60),
  createContainsAlias('JOB_TITLE', '设计', '创意设计', 70),

  createAlias('JOB_TITLE', '人力', 'HR', 10),
  createContainsAlias('JOB_TITLE', '人力', '人力资源', 20),
  createContainsAlias('JOB_TITLE', '人力', '人力资源管理', 30),
  createContainsAlias('JOB_TITLE', '人力', '招聘专员', 40),

  createAlias('JOB_TITLE', '人事 / 行政', '人事', 10),
  createAlias('JOB_TITLE', '人事 / 行政', '行政', 20),
  createContainsAlias('JOB_TITLE', '人事 / 行政', '行政岗', 30),
  createContainsAlias('JOB_TITLE', '人事 / 行政', '行政文员', 40),
  createContainsAlias('JOB_TITLE', '人事 / 行政', '行政助理', 50),
  createContainsAlias('JOB_TITLE', '人事 / 行政', '行政专员', 60),
  createContainsAlias('JOB_TITLE', '人事 / 行政', '人事行政', 70),
  createContainsAlias('JOB_TITLE', '人事 / 行政', '综合行政', 80),

  createAlias('JOB_TITLE', '财务', '会计', 10),
  createAlias('JOB_TITLE', '财务', '出纳', 20),
  createContainsAlias('JOB_TITLE', '财务', '财务会计', 30),
  createContainsAlias('JOB_TITLE', '财务', '会计专员', 40),
  createContainsAlias('JOB_TITLE', '财务', '财务专员', 50),
  createContainsAlias('JOB_TITLE', '财务', '财务管理', 60),

  createContainsAlias('JOB_TITLE', '市场', '市场岗', 10),
  createContainsAlias('JOB_TITLE', '市场', '市场专员', 20),
  createContainsAlias('JOB_TITLE', '市场', '市场拓展', 30),
  createContainsAlias('JOB_TITLE', '市场', '市场方向', 40),

  createContainsAlias('JOB_TITLE', '营销', '市场营销', 10),
  createContainsAlias('JOB_TITLE', '营销', '营销专员', 20),
  createContainsAlias('JOB_TITLE', '营销', '营销策划', 30),
  createContainsAlias('JOB_TITLE', '营销', '品牌营销', 40),

  createContainsAlias('JOB_TITLE', '工程师', '机械工程师', 10),
  createContainsAlias('JOB_TITLE', '工程师', '电气工程师', 20),
  createContainsAlias('JOB_TITLE', '工程师', '技术工程师', 30),

  createAlias('JOB_TITLE', '管培生', 'MT', 10),
  createContainsAlias('JOB_TITLE', '管培生', '管培生', 20),
  createContainsAlias('JOB_TITLE', '管培生', '管理培训生', 30),
  createContainsAlias('JOB_TITLE', '管培生', '管理培训岗', 40),
  createContainsAlias('JOB_TITLE', '管培生', '营销管培生', 50),

  createContainsAlias('JOB_TITLE', '培训生', '培训见习生', 10),
  createContainsAlias('JOB_TITLE', '培训生', '培训岗位', 20),
  createContainsAlias('JOB_TITLE', '培训生', '运营培训生', 30),

  createContainsAlias('JOB_TITLE', '实习生', '寒假实习生', 10),
  createContainsAlias('JOB_TITLE', '实习生', '暑期实习生', 20),
  createContainsAlias('JOB_TITLE', '实习生', '实习岗位', 30),

  createContainsAlias('JOB_TITLE', '校园大使', '校园推广大使', 10),
  createContainsAlias('JOB_TITLE', '校园大使', '校园合伙人', 20),

  createContainsAlias('JOB_TITLE', 'IT技术', 'IT技术岗', 10),
  createContainsAlias('JOB_TITLE', 'IT技术', '信息技术岗', 20),

  createContainsAlias('JOB_TITLE', '其他职位', '其他岗位', 10),
  createContainsAlias('JOB_TITLE', '其他职位', '综合培养岗', 20),
  createContainsAlias('JOB_TITLE', '其他职位', '储备干部', 30),
  createContainsAlias('JOB_TITLE', '其他职位', '业务储备生', 40),
];

export const companyAliasRound1SeedItems: SeedNormalizationAliasItem[] = [
  createAlias('COMPANY', '中国烟草', '烟草', 10),
  createContainsAlias('COMPANY', '中国烟草', '中烟', 20),
  createAlias('COMPANY', '中国烟草', '烟草公司', 30),
  createContainsAlias('COMPANY', '中国烟草', '中国烟草总公司', 40),
  createContainsAlias('COMPANY', '中国烟草', '江苏中烟', 50),
  createContainsAlias('COMPANY', '中国烟草', '上海烟草集团', 60),
  createContainsAlias('COMPANY', '中国烟草', '山东中烟', 70),

  createContainsAlias('COMPANY', '国家电网', '国网', 10),
  createAlias('COMPANY', '国家电网', '电网', 20),
  createContainsAlias('COMPANY', '国家电网', '国家电网公司', 30),
  createContainsAlias('COMPANY', '国家电网', '国家电网江苏公司', 40),

  createContainsAlias('COMPANY', '腾讯', '腾讯控股', 10),
  createContainsAlias('COMPANY', '腾讯', '腾讯科技', 20),
  createContainsAlias('COMPANY', '腾讯', '腾讯公司', 30),

  createContainsAlias('COMPANY', '华为', '华为技术', 10),
  createContainsAlias('COMPANY', '华为', '华为技术有限公司', 20),
  createContainsAlias('COMPANY', '华为', '华为公司', 30),

  createAlias('COMPANY', '中国电信', '电信', 10),
  createContainsAlias('COMPANY', '中国电信', '中国电信江苏公司', 20),
  createContainsAlias('COMPANY', '中国电信', '中国电信股份有限公司', 30),

  createAlias('COMPANY', '招商银行', '招行', 10),
  createContainsAlias('COMPANY', '招商银行', '招商银行总行', 20),
  createContainsAlias('COMPANY', '招商银行', '招商银行股份有限公司', 30),

  createContainsAlias('COMPANY', '阿里', '阿里巴巴', 10),
  createContainsAlias('COMPANY', '阿里', '阿里巴巴集团', 20),
  createContainsAlias('COMPANY', '阿里', '阿里集团', 30),

  createContainsAlias('COMPANY', '字节跳动', '字节', 10),
  createContainsAlias('COMPANY', '字节跳动', 'ByteDance', 20),
  createContainsAlias('COMPANY', '字节跳动', '字节公司', 30),

  createContainsAlias('COMPANY', '美团', '美团点评', 10),
  createContainsAlias('COMPANY', '美团', '美团公司', 20),

  createAlias('COMPANY', '京东', 'JD', 10),
  createContainsAlias('COMPANY', '京东', '京东集团', 20),
  createContainsAlias('COMPANY', '京东', '京东商城', 30),

  createContainsAlias('COMPANY', '百度', '百度公司', 10),
  createContainsAlias('COMPANY', '百度', '百度在线', 20),
  createContainsAlias('COMPANY', '百度', 'Baidu', 30),

  createAlias('COMPANY', '中国移动', '移动', 10),
  createContainsAlias('COMPANY', '中国移动', '中国移动通信', 20),
  createContainsAlias('COMPANY', '中国移动', '中国移动有限公司', 30),

  createAlias('COMPANY', '中国联通', '联通', 10),
  createContainsAlias('COMPANY', '中国联通', '中国联合网络通信', 20),
  createContainsAlias('COMPANY', '中国联通', '中国联通公司', 30),

  createAlias('COMPANY', '中国银行', '中行', 10),
  createContainsAlias('COMPANY', '中国银行', '中国银行总行', 20),
  createContainsAlias('COMPANY', '中国银行', '中国银行股份有限公司', 30),

  createAlias('COMPANY', '工商银行', '工行', 10),
  createContainsAlias('COMPANY', '工商银行', '中国工商银行', 20),
  createContainsAlias('COMPANY', '工商银行', '工商银行总行', 30),

  createAlias('COMPANY', '建设银行', '建行', 10),
  createContainsAlias('COMPANY', '建设银行', '中国建设银行', 20),
  createContainsAlias('COMPANY', '建设银行', '建设银行总行', 30),
];

export const degreeAliasRound1SeedItems: SeedNormalizationAliasItem[] = [
  createAlias('DEGREE', '中专', '中职', 10),
  createContainsAlias('DEGREE', '中专', '中等专业学校', 20),

  createAlias('DEGREE', '专科', '大专', 10),
  createContainsAlias('DEGREE', '专科', '大专学历', 20),

  createContainsAlias('DEGREE', '本科', '全日制本科', 10),
  createAlias('DEGREE', '本科', '学士', 20),
  createContainsAlias('DEGREE', '本科', '大学本科', 30),
  createContainsAlias('DEGREE', '本科', '本科生', 40),

  createAlias('DEGREE', '硕士', '研究生', 10),
  createContainsAlias('DEGREE', '硕士', '硕士研究生', 20),
  createContainsAlias('DEGREE', '硕士', '硕士生', 30),

  createContainsAlias('DEGREE', '博士', '博士研究生', 10),
  createContainsAlias('DEGREE', '博士', '博士生', 20),
];

export const majorAliasRound1SeedItems: SeedNormalizationAliasItem[] = [
  createContainsAlias('MAJOR', '计算机', '计算机科学与技术', 10),
  createContainsAlias('MAJOR', '计算机', '计算机科学', 20),
  createContainsAlias('MAJOR', '计算机', '计算机工程', 30),
  createAlias('MAJOR', '计算机', '计科', 40),
  createContainsAlias('MAJOR', '计算机', '计算机科学与技术专业', 50),
  createContainsAlias('MAJOR', '计算机', '软件工程', 60),
  createContainsAlias('MAJOR', '计算机', '软件工程专业', 70),
  createAlias('MAJOR', '计算机', '软件开发', 80),
  createContainsAlias('MAJOR', '计算机', '数据科学与大数据技术', 90),
  createContainsAlias('MAJOR', '计算机', '数据科学', 100),
  createAlias('MAJOR', '计算机', '大数据', 110),
  createContainsAlias('MAJOR', '计算机', '大数据技术', 120),
  createContainsAlias('MAJOR', '计算机', '数据科学与大数据', 130),
  createContainsAlias('MAJOR', '计算机', '信息安全', 140),
  createContainsAlias('MAJOR', '计算机', '信息安全专业', 150),
  createAlias('MAJOR', '计算机', '网安', 160),
  createContainsAlias('MAJOR', '计算机', '网络工程', 170),
  createContainsAlias('MAJOR', '计算机', '计算机网络', 180),
  createContainsAlias('MAJOR', '计算机', '网络工程专业', 190),
  createContainsAlias('MAJOR', '计算机', '物联网工程', 200),

  createAlias('MAJOR', '人工智能', 'AI', 10),
  createContainsAlias('MAJOR', '人工智能', '人工智能专业', 20),
  createContainsAlias('MAJOR', '人工智能', '智能科学与技术', 30),
  createContainsAlias('MAJOR', '人工智能', '机器人工程', 40),

  createContainsAlias('MAJOR', '电子信息', '电子信息工程', 10),
  createContainsAlias('MAJOR', '电子信息', '电子信息专业', 20),
  createContainsAlias('MAJOR', '电子信息', '微电子', 30),
  createContainsAlias('MAJOR', '电子信息', '集成电路', 40),
  createContainsAlias('MAJOR', '电子信息', '光电信息', 50),

  createContainsAlias('MAJOR', '通信', '通信工程', 10),
  createContainsAlias('MAJOR', '通信', '通信工程专业', 20),
  createContainsAlias('MAJOR', '通信', '信息与通信工程', 30),

  createContainsAlias('MAJOR', '自动化', '自动化专业', 10),
  createContainsAlias('MAJOR', '自动化', '控制工程', 20),
  createContainsAlias('MAJOR', '自动化', '控制科学与工程', 30),

  createContainsAlias('MAJOR', '电气', '电气工程及其自动化', 10),
  createContainsAlias('MAJOR', '电气', '电气工程', 20),
  createContainsAlias('MAJOR', '电气', '电气自动化', 30),
  createContainsAlias('MAJOR', '电气', '电机与电器', 40),
  createContainsAlias('MAJOR', '电气', '电力系统', 50),

  createContainsAlias('MAJOR', '机械', '机械工程', 10),
  createContainsAlias('MAJOR', '机械', '机械工程专业', 20),
  createContainsAlias('MAJOR', '机械', '机械设计制造及其自动化', 30),
  createContainsAlias('MAJOR', '机械', '机电一体化', 40),

  createContainsAlias('MAJOR', '材料化工', '材料科学与工程', 10),
  createContainsAlias('MAJOR', '材料化工', '高分子材料', 20),
  createAlias('MAJOR', '材料化工', '化工', 30),
  createContainsAlias('MAJOR', '材料化工', '化学工程与工艺', 40),
  createContainsAlias('MAJOR', '材料化工', '应用化学', 50),

  createContainsAlias('MAJOR', '能源动力', '能源动力', 10),
  createContainsAlias('MAJOR', '能源动力', '热能', 20),
  createContainsAlias('MAJOR', '能源动力', '核工程', 30),
  createContainsAlias('MAJOR', '能源动力', '动力工程', 40),

  createAlias('MAJOR', '土木建筑', '土木', 10),
  createContainsAlias('MAJOR', '土木建筑', '土木工程', 20),
  createContainsAlias('MAJOR', '土木建筑', '土木工程专业', 30),
  createContainsAlias('MAJOR', '土木建筑', '建筑学', 40),
  createContainsAlias('MAJOR', '土木建筑', '城乡规划', 50),
  createContainsAlias('MAJOR', '土木建筑', '工程管理', 60),

  createAlias('MAJOR', '数学统计', '数学', 10),
  createContainsAlias('MAJOR', '数学统计', '统计学', 20),
  createContainsAlias('MAJOR', '数学统计', '应用统计', 30),
  createContainsAlias('MAJOR', '数学统计', '数理统计', 40),

  createContainsAlias('MAJOR', '生物', '生物工程', 10),
  createContainsAlias('MAJOR', '生物', '生物科学', 20),
  createContainsAlias('MAJOR', '生物', '生物技术', 30),

  createContainsAlias('MAJOR', '医学', '临床医学', 10),
  createAlias('MAJOR', '医学', '护理', 20),
  createContainsAlias('MAJOR', '医学', '护理学', 30),
  createContainsAlias('MAJOR', '医学', '护理专业', 40),
  createContainsAlias('MAJOR', '医学', '口腔医学', 50),
  createContainsAlias('MAJOR', '医学', '药学', 60),
  createContainsAlias('MAJOR', '医学', '公共卫生', 70),

  createContainsAlias('MAJOR', '农学', '农学', 10),
  createContainsAlias('MAJOR', '农学', '农业工程', 20),
  createContainsAlias('MAJOR', '农学', '林业工程', 30),
  createContainsAlias('MAJOR', '农学', '动物科学', 40),

  createAlias('MAJOR', '财务', '财管', 10),
  createAlias('MAJOR', '财务', '会计', 20),
  createAlias('MAJOR', '财务', '审计', 30),
  createAlias('MAJOR', '财务', '税务', 40),
  createContainsAlias('MAJOR', '财务', '财务管理', 50),
  createContainsAlias('MAJOR', '财务', '财务管理专业', 60),
  createContainsAlias('MAJOR', '财务', '会计学', 70),
  createContainsAlias('MAJOR', '财务', '会计专业', 80),
  createContainsAlias('MAJOR', '财务', '审计学', 90),

  createAlias('MAJOR', '金融', '金融', 10),
  createContainsAlias('MAJOR', '金融', '金融学', 20),
  createContainsAlias('MAJOR', '金融', '金融学专业', 30),
  createContainsAlias('MAJOR', '金融', '金融工程', 40),
  createContainsAlias('MAJOR', '金融', '金融科技', 50),
  createContainsAlias('MAJOR', '金融', '保险精算', 60),

  createContainsAlias('MAJOR', '经管', '经济学', 10),
  createContainsAlias('MAJOR', '经管', '工商管理', 20),
  createContainsAlias('MAJOR', '经管', '管理学', 30),
  createContainsAlias('MAJOR', '经管', '国际经济与贸易', 40),
  createContainsAlias('MAJOR', '经管', '行政管理', 50),

  createAlias('MAJOR', '市场营销', '营销', 10),
  createContainsAlias('MAJOR', '市场营销', '市场营销专业', 20),
  createContainsAlias('MAJOR', '市场营销', '商务策划', 30),
  createContainsAlias('MAJOR', '市场营销', '品牌传播', 40),

  createContainsAlias('MAJOR', '人力资源', '人力资源管理', 10),
  createContainsAlias('MAJOR', '人力资源', '人力资源管理专业', 20),
  createAlias('MAJOR', '人力资源', '人资管理', 30),
  createContainsAlias('MAJOR', '人力资源', '劳动关系', 40),

  createAlias('MAJOR', '法学', '法律', 10),
  createContainsAlias('MAJOR', '法学', '法学专业', 20),
  createContainsAlias('MAJOR', '法学', '知识产权', 30),

  createContainsAlias('MAJOR', '新闻传播', '新闻学', 10),
  createContainsAlias('MAJOR', '新闻传播', '传播学', 20),
  createContainsAlias('MAJOR', '新闻传播', '广告学', 30),
  createContainsAlias('MAJOR', '新闻传播', '广播电视', 40),

  createContainsAlias('MAJOR', '语言', '汉语言', 10),
  createContainsAlias('MAJOR', '语言', '英语', 20),
  createContainsAlias('MAJOR', '语言', '翻译', 30),
  createContainsAlias('MAJOR', '语言', '商务英语', 40),
  createContainsAlias('MAJOR', '语言', '小语种', 50),

  createContainsAlias('MAJOR', '教育', '教育学', 10),
  createContainsAlias('MAJOR', '教育', '学科教学', 20),
  createContainsAlias('MAJOR', '教育', '课程与教学论', 30),
  createContainsAlias('MAJOR', '教育', '心理学', 40),

  createContainsAlias('MAJOR', '物流供应链', '物流管理', 10),
  createContainsAlias('MAJOR', '物流供应链', '供应链管理', 20),
  createContainsAlias('MAJOR', '物流供应链', '工业工程', 30),
];

// 按“先主表、后别名、再地点关系”推进：当前已进入 alias 首轮补数，优先扩充四个非 LOCATION 域高频 alias；LOCATION alias 仍沿用最小兼容集合。
export const normalizationAliasSeedItems: SeedNormalizationAliasItem[] = [
  ...locationAliasSeedItems,
  ...jobTitleAliasRound1SeedItems,
  ...companyAliasRound1SeedItems,
  ...degreeAliasRound1SeedItems,
  ...majorAliasRound1SeedItems,
];

// LOCATION 城市父级关系已按主表城市 metadata.intendedProvince 全量补齐，保证每个城市都有唯一父省。
export const locationHierarchySeedItems: SeedLocationHierarchyItem[] = locationTermRound1SeedItems.reduce<SeedLocationHierarchyItem[]>((items, item) => {
  if (item.domain !== 'LOCATION' || item.level !== 'city') {
    return items;
  }

  const intendedProvince = typeof item.metadata?.intendedProvince === 'string' ? item.metadata.intendedProvince : null;
  if (!intendedProvince) {
    return items;
  }

  items.push({
    provinceCanonicalName: intendedProvince,
    cityCanonicalName: item.canonicalName,
    status: 'active',
  });

  return items;
}, []);

export const normalizationSeedMetadata = {
  mainAliasRound: MAIN_ALIAS_ROUND1,
  locationHierarchyRound: LOCATION_HIERARCHY_ROUND1,
} as const;
