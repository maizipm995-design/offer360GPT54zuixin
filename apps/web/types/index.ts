export type MemberLevel = 'standard' | 'super';
export type MemberRoleCode = 'FREE_USER' | 'STANDARD_MEMBER' | 'SUPER_MEMBER';
export type MemberPermissionKey =
  | 'jobs:list:view'
  | 'jobs:search:use'
  | 'jobs:filter:use'
  | 'jobs:detail:view'
  | 'jobs:deliver:use'
  | 'jobs:referral:view'
  | 'jobs:progress:update'
  | 'jobs:recommend:view';

export interface JobStats {
  threeDays: number;
  sevenDays: number;
  thirtyDays: number;
  total: number;
}

export interface JobItem {
  id: string;
  companyFullName: string;
  companyName: string;
  jobName?: string | null;
  positionNames: string;
  jobCategory?: string | null;
  positionCategory?: string | null;
  workLocation?: string | null;
  degreeRequirement?: string | null;
  enterpriseNature?: string | null;
  recruitmentType?: string | null;
  jobType?: string | null;
  deliveryType?: 'email' | 'website' | null;
  majorRequirement?: string | null;
  deadlineAt?: string | null;
  announcementUrl?: string | null;
  deliveryUrl?: string | null;
  recruitmentLink?: string | null;
  announcementTitle?: string | null;
  industry?: string | null;
  graduationSession?: string | null;
  entryDate?: string | null;
  hasReferral: boolean;
  accessClickCount?: number;
  deliveryMarkCount?: number;
  recommendReasons?: string[];
  recommendMeta?: {
    hitDimensions: Array<'company' | 'job' | 'location' | 'degree' | 'major' | 'freshness' | 'heat' | 'fallback'>;
    version: string;
    matchTier?: 0 | 1 | 2 | 3;
    matchType?: 'CITY_JOB_COMPANY' | 'CITY_COMPANY' | 'CITY_JOB' | 'JOB_COMPANY' | 'CITY_ONLY' | 'JOB_ONLY' | 'COMPANY_ONLY' | 'FALLBACK';
  };
  updatedAt: string;
  createdAt: string;
  isLatest: boolean;
  isUrgent: boolean;
  currentProgress: string;
}

export interface JobListResponse {
  list: JobItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  recommendedFeed?: {
    stateCode: 'DEFAULT' | 'PREFERENCE_REQUIRED' | 'NO_MATCHED_RESULT';
    stateMessage?: string;
    summaryText?: string;
    fallbackMode?: 'HOT_JOBS';
    hasPreferences: boolean;
  };
}

export interface JobFilters {
  degreeOptions: string[];
  enterpriseNatureOptions: string[];
  recruitmentTypeOptions: string[];
  jobTypeOptions?: string[];
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  score: number;
  salesCount: number;
  isHot: boolean;
  detailHtml?: string | null;
  orderServiceText?: string | null;
  orderServiceImageUrl?: string | null;
}

export interface MembershipPlanItem extends ServiceItem {
  grantDays: number;
  memberLevel: MemberLevel;
  memberLevelLabel: string;
}

export type WechatPayScene = 'jsapi' | 'h5' | 'native';
export type CheckoutAction = 'oauth_redirect_required' | 'invoke_jsapi' | 'redirect_h5' | 'show_qrcode' | 'already_paid' | 'closed';

export interface WechatJsapiParams {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
  prepayId: string;
}

export interface CheckoutOrder {
  id: string;
  orderNo: string;
  orderType: string;
  title: string;
  amount: number;
  payStatus: string;
  payChannel?: string | null;
  payScene?: WechatPayScene | null;
  memberLevel?: MemberLevel | null;
  memberLevelLabel: string;
  grantDays?: number | null;
  payTime?: string | null;
  expireAt?: string | null;
  closedAt?: string | null;
  refundReason?: string | null;
  refundAt?: string | null;
  createdAt: string;
  updatedAt: string;
  checkoutPath: string;
  serviceEntryUrl: string;
  entryLabel: string;
  canContinuePay: boolean;
  product: {
    id: string;
    name: string;
    productType: string;
  };
  wallet?: {
    availableBalance: number;
    frozenBalance: number;
    totalEarn: number;
    reservedBalance: number;
    deductibleBalance: number;
  } | null;
  pricing: {
    useBalance: boolean;
    originalAmount: number;
    memberDiscountAmount: number;
    discountedAmount: number;
    maxDeductibleAmount: number;
    incentiveDeductRate: number;
    deductibleAmount: number;
    payableAmount: number;
  };
  wechatCodeUrl?: string | null;
  wechatH5Url?: string | null;
  wechatTransactionId?: string | null;
}

export interface CheckoutPrepareResult {
  order: CheckoutOrder;
  scene: WechatPayScene;
  action: CheckoutAction;
  oauthUrl?: string | null;
  codeUrl?: string | null;
  h5Url?: string | null;
  jsapiParams?: WechatJsapiParams | null;
}

export interface PersonalOrderItem {
  id: string;
  orderNo: string;
  orderType: string;
  title: string;
  amount: number;
  payStatus: string;
  payScene?: WechatPayScene | null;
  payTime?: string | null;
  expireAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  productName: string;
  serviceEntryUrl: string;
  entryLabel: string;
  checkoutPath: string;
  canContinuePay: boolean;
  orderServiceText?: string | null;
  orderServiceImageUrl?: string | null;
}

export interface AuthUser {
  id: string;
  phone: string;
  name: string;
  isMember: boolean;
  memberLevel?: MemberLevel | null;
  memberLevelLabel?: string;
  memberRoleCode: MemberRoleCode;
  memberRoleName: string;
  permissionKeys: MemberPermissionKey[];
  inviteCode: string;
  membershipRemainingDays?: number;
}

export interface PersonalProfileSummary {
  name?: string | null;
  graduationYear?: number | null;
  degree?: string | null;
  schoolName?: string | null;
  major?: string | null;
}

export interface PersonalNormalizedProfileSummary {
  degree?: string | null;
  major?: string | null;
}

export interface PersonalPreferenceSummary {
  intentionCity: string[];
  intentionJob: string[];
  intentionCompany: string[];
}

export interface PersonalOverview {
  id: string;
  phone: string;
  inviteCode: string;
  isMember: boolean;
  memberLevel?: MemberLevel | null;
  memberLevelLabel?: string;
  memberRoleCode: MemberRoleCode;
  memberRoleName: string;
  permissionKeys: MemberPermissionKey[];
  membershipRemainingDays: number;
  profile?: PersonalProfileSummary | null;
  normalizedProfile?: PersonalNormalizedProfileSummary | null;
  preference?: PersonalPreferenceSummary | null;
  normalizedPreference?: PersonalPreferenceSummary | null;
  membership?: {
    id: string;
    memberLevel: MemberLevel;
    memberLevelLabel: string;
    memberRoleCode: MemberRoleCode;
    memberRoleName: string;
    startAt: string;
    endAt: string;
    remainingDays: number;
  } | null;
  wallet?: {
    availableBalance: number;
    frozenBalance: number;
    totalEarn: number;
  } | null;
}

export interface MembershipBenefitsContent {
  slug: string;
  title: string;
  htmlContent: string;
  updatedAt: string;
}

export interface CareerJourneyContent {
  id: string;
  slug: string;
  title: string;
  htmlContent: string;
  updatedAt: string;
}

export type HtmlContentLocationCode = 'membership-benefits' | 'career-journey';

export interface AdminPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface AdminListResponse<T> {
  list: T[];
  pagination: AdminPagination;
}

export interface AdminSummaryCard {
  label: string;
  value: number | string;
  helper: string;
}

export interface AdminOverviewData {
  summaryCards: AdminSummaryCard[];
  latestJobs: Array<{
    id: string;
    companyName: string;
    positionNames: string;
    workLocation: string;
    updatedAt: string;
  }>;
  latestOrders: Array<{
    id: string;
    orderNo: string;
    amount: number;
    payStatus: string;
    createdAt: string;
    userPhone: string;
    productName: string;
  }>;
  hotProducts: Array<{
    id: string;
    name: string;
    price: number;
    salesCount: number;
    isHot: boolean;
    status: boolean;
  }>;
}

export interface AdminJobItem {
  id: string;
  companyFullName: string;
  enterpriseNature?: string | null;
  degreeRequirement?: string | null;
  workLocation?: string | null;
  jobName?: string | null;
  jobCategory?: string | null;
  recruitmentType?: string | null;
  deadlineAt?: string | null;
  announcementUrl?: string | null;
  deliveryUrl?: string | null;
  graduationSession?: string | null;
  referralCode?: string | null;
  announcementTitle?: string | null;
  industry?: string | null;
  entryDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserItem {
  id: string;
  phone: string;
  status: string;
  sourceType?: string | null;
  inviteCode: string;
  parentUid?: string | null;
  parentPhone?: string;
  parentInviteCode?: string;
  createdAt: string;
  lastLoginAt?: string | null;
  memberRoleCode: MemberRoleCode;
  memberRoleName: string;
  permissionKeys: MemberPermissionKey[];
  profile?: {
    name?: string | null;
    graduationYear?: number | null;
    degree?: string | null;
    schoolName?: string | null;
    major?: string | null;
  } | null;
  preference: {
    intentionCity: string[];
    intentionJob: string[];
    intentionCompany: string[];
  };
  membership?: {
    id: string;
    memberLevel: MemberLevel;
    memberLevelLabel: string;
    memberRoleCode: MemberRoleCode;
    memberRoleName: string;
    startAt: string;
    endAt: string;
    remainingDays: number;
    isActive: boolean;
  } | null;
  wallet?: {
    availableBalance: number;
    frozenBalance: number;
    totalEarn: number;
  } | null;
}

export interface AdminMembershipItem {
  id: string;
  userId: string;
  userPhone: string;
  inviteCode: string;
  memberLevel: MemberLevel;
  memberLevelLabel: string;
  memberRoleCode: MemberRoleCode;
  memberRoleName: string;
  startAt: string;
  endAt: string;
  remainingDays: number;
  isActive: boolean;
  sourceType?: string | null;
  sourceRemark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMembershipContentItem {
  id: string;
  slug: string;
  title: string;
  htmlContent: string;
  previewHtml?: string;
  assetUrls?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCareerJourneyContentItem {
  id: string;
  slug: string;
  title: string;
  htmlContent: string;
  previewHtml?: string;
  assetUrls?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminHtmlContentPosition {
  code: HtmlContentLocationCode;
  label: string;
  description: string;
  slug: string;
  uploadScene: 'membership-content-image' | 'career-journey-content-image';
}

export interface AdminHtmlContentItem {
  id: string;
  slug: string;
  title: string;
  htmlContent: string;
  previewHtml?: string;
  assetUrls?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  locationCode: HtmlContentLocationCode | null;
  locationLabel: string;
  locationDescription: string;
  uploadScene: 'membership-content-image' | 'career-journey-content-image';
}

export interface AdminServiceProductItem {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  score: number;
  salesCount: number;
  isHot: boolean;
  status: boolean;
  detailHtml?: string | null;
  detailPreviewHtml?: string | null;
  detailAssetUrls?: Record<string, string>;
  orderServiceText?: string | null;
  orderServiceImageUrl?: string | null;
  orderServiceImagePreviewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminResumeVerticalSpacingConfig {
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

export interface AdminResumeStyleConfig {
  templateCode: string;
  fontFamily: string;
  fontSize: number;
  spacingScale: number;
  verticalSpacing: AdminResumeVerticalSpacingConfig;
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

export interface AdminResumeTemplateConfigItem {
  id: string;
  templateCode: string;
  templateName: string;
  description?: string | null;
  styleJson: AdminResumeStyleConfig;
  createdAt: string;
  updatedAt: string;
}

export interface AdminResumeTemplateConfigsResponse {
  templates: AdminResumeTemplateConfigItem[];
  globalVerticalSpacing: AdminResumeVerticalSpacingConfig;
}

export interface AdminOrderItem {
  id: string;
  orderNo: string;
  amount: number;
  payStatus: string;
  payTime?: string | null;
  refundReason?: string | null;
  refundAt?: string | null;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    phone: string;
    myInviteCode: string;
  };
  product: {
    id: string;
    name: string;
  };
}

export interface AdminOrderListResponse extends AdminListResponse<AdminOrderItem> {
  stats: {
    total: number;
    amount: number;
  };
}

export interface AdminCommissionLogItem {
  id: number;
  orderNo: string;
  inviter: {
    id: string;
    phone: string;
  };
  consumer: {
    id: string;
    phone: string;
  };
  commissionRate: number;
  commissionMoney: number;
  originalConsumeMoney: number;
  logType: number;
  createAt: string;
}

export interface AdminCommissionLogListResponse extends AdminListResponse<AdminCommissionLogItem> {
  stats: {
    total: number;
    amount: number;
  };
}

export interface AdminCommissionConfigItem {
  id: number;
  oneLevelRate: number;
  updateAt: string;
}

export interface AdminJobsRecommendationConfigItem {
  id: number;
  companyWeight: number;
  jobWeight: number;
  cityExactWeight: number;
  cityParentWeight: number;
  degreeWeight: number;
  majorWeight: number;
  fresh3DaysWeight: number;
  fresh7DaysWeight: number;
  stateOwnedFallbackWeight: number;
  deliveredPenalty: number;
  heatMax: number;
  hotAccessThreshold: number;
  hotDeliveryThreshold: number;
  updatedAt: string;
}

export interface AdminNormalizationSummary {
  termCount: number;
  aliasCount: number;
  locationHierarchyCount: number;
  updatedAt?: string | null;
}

export interface AdminNormalizationTermItem {
  id: string;
  domain: string;
  canonicalName: string;
  canonicalCode?: string | null;
  level?: string | null;
  status: string;
  sortOrder: number;
  metadata?: Record<string, unknown> | null;
  aliasCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminNormalizationAliasItem {
  id: string;
  termId: string;
  termDomain: string;
  termCanonicalName: string;
  aliasName: string;
  aliasNormalized: string;
  matchMode: string;
  status: string;
  source?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLocationHierarchyItem {
  id: string;
  provinceTermId: string;
  provinceCanonicalName: string;
  cityTermId: string;
  cityCanonicalName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRoleItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

export interface AdminPermissionCatalogItem {
  key: string;
  name: string;
  group: string;
  description?: string;
}

export interface AdminMemberRoleItem {
  id: string;
  code: MemberRoleCode;
  name: string;
  description?: string | null;
  status: string;
  isSystem: boolean;
  sortOrder: number;
  inheritedRoleCode?: MemberRoleCode | null;
  userCount: number;
  permissionKeys: MemberPermissionKey[];
  effectivePermissionKeys: MemberPermissionKey[];
  permissions: Array<{
    key: MemberPermissionKey;
    name: string;
    group: string;
    description: string;
    inherited: boolean;
  }>;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AdminManagedRoleItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  permissionKeys: string[];
  permissions: Array<{
    id: string;
    key: string;
    name: string;
    group?: string | null;
  }>;
}

export interface AdminManagedUserItem {
  id: string;
  username: string;
  realName?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  remark?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  isSuperAdmin: boolean;
  roleIds: string[];
  roles: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  permissions: string[];
}

export interface AdminOperationLogItem {
  id: string;
  adminUserId?: string | null;
  adminUsername?: string;
  adminRealName?: string;
  module: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  requestMethod?: string | null;
  requestPath?: string | null;
  requestPayload?: unknown;
  responseSummary?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface AdminAuthSession {
  token?: string;
  admin: {
    id: string;
    username: string;
    realName: string;
    phone?: string | null;
    email?: string | null;
    status: string;
    remark?: string | null;
    lastLoginAt?: string | null;
    roles: AdminRoleItem[];
    roleCodes: string[];
    permissions: string[];
    isSuperAdmin: boolean;
  };
}

export interface AdminBootstrapStatus {
  hasAdminAccounts: boolean;
  adminCount: number;
  registerEntryClosed: boolean;
  shouldShowRegister: boolean;
}

export interface AdminFileDownloadPayload {
  filename: string;
  mimeType: string;
  content: string;
  encoding?: 'utf8' | 'base64';
}

export interface AdminImportResult {
  total: number;
  success: number;
  failed: number;
  durationMs: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
}

export interface AdminRedeemBatchItem {
  id: string;
  batchNo: string;
  memberLevel: MemberLevel;
  memberLevelLabel: string;
  cardType: string;
  grantDays: number;
  quantity: number;
  usedCount: number;
  unusedCount: number;
  status: string;
  validFrom?: string | null;
  validUntil?: string | null;
  remark?: string | null;
  createdByAdminName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRedeemCodeItem {
  id: string;
  code: string;
  batchId: string;
  batchNo: string;
  memberLevel: MemberLevel;
  memberLevelLabel: string;
  cardType: string;
  grantDays: number;
  status: string;
  validUntil?: string | null;
  usedByUserId?: string | null;
  usedByUserPhone?: string;
  usedAt?: string | null;
  invalidatedAt?: string | null;
  invalidReason?: string | null;
  invalidatedByAdminName?: string;
  latestRemark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRedeemRecordItem {
  id: string;
  batchId: string;
  batchNo: string;
  codeId: string;
  code: string;
  userId: string;
  userPhone?: string;
  memberLevel: MemberLevel;
  memberLevelLabel: string;
  cardType: string;
  grantDays: number;
  usedAt: string;
  remark?: string | null;
}

export interface AdminRedeemCodeListResponse extends AdminListResponse<AdminRedeemCodeItem> {
  stats: {
    total: number;
    unusedCount: number;
    usedCount: number;
    voidCount: number;
    expiredCount: number;
  };
}

export interface AdminRedeemRecordListResponse extends AdminListResponse<AdminRedeemRecordItem> {}
