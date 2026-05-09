export const DEGREE_OPTIONS = ['专科', '本科', '硕士', '博士'] as const;
export const ENTERPRISE_NATURE_OPTIONS = ['央企', '国企', '外资', '内资', '事业单位', '银行', '高校', '其他'] as const;
export const JOB_TYPE_OPTIONS = ['校招', '实习'] as const;
export const PROGRESS_STATUS_OPTIONS = ['全部', '已投递', '已笔试', '已面试', '已录用', '已拒绝', '已取消', '其他'] as const;
export const SERVICE_STAGE_MAP = {
  default: ['简历精修', '面试辅导', '笔试代做', '求职全流程'],
  interview: ['面试辅导', '求职全流程', 'offer 谈判'],
} as const;

export type DegreeOption = (typeof DEGREE_OPTIONS)[number];
export type EnterpriseNatureOption = (typeof ENTERPRISE_NATURE_OPTIONS)[number];
export type JobTypeOption = (typeof JOB_TYPE_OPTIONS)[number];
export type ProgressStatusOption = (typeof PROGRESS_STATUS_OPTIONS)[number];
