export interface AdminPermissionCatalogItem {
  key: string;
  name: string;
  group: string;
}

export const ADMIN_PERMISSION_CATALOG: AdminPermissionCatalogItem[] = [
  { key: 'dashboard:view', name: '查看工作台', group: 'dashboard' },
  { key: 'admin:job:manage', name: '管理招聘公告', group: 'content' },
  { key: 'admin:user:manage', name: '管理 C 端用户', group: 'user' },
  { key: 'admin:membership:manage', name: '管理会员与权益内容', group: 'membership' },
  { key: 'admin:service:manage', name: '管理服务商品与订单', group: 'service' },
  { key: 'admin:commission:manage', name: '管理分销配置与流水', group: 'commission' },
  { key: 'admin:redeem:manage', name: '管理兑换码批次与明细', group: 'redeem' },
  { key: 'admin:admin-user:manage', name: '管理后台账号', group: 'governance' },
  { key: 'admin:role:manage', name: '管理后台角色与权限', group: 'governance' },
  { key: 'admin:operation-log:view', name: '查看后台操作日志', group: 'governance' },
];

export const ADMIN_PERMISSION_KEY_SET = new Set(ADMIN_PERMISSION_CATALOG.map((item) => item.key));
