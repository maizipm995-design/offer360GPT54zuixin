export const AUTH_CODE_BUSINESSES = ['login', 'register', 'reset_password', 'update_phone'] as const;

export type AuthCodeBusiness = (typeof AUTH_CODE_BUSINESSES)[number];

export const AUTH_CODE_BUSINESS_LABELS: Record<AuthCodeBusiness, string> = {
  login: '登录',
  register: '注册',
  reset_password: '重置密码',
  update_phone: '修改手机号',
};
