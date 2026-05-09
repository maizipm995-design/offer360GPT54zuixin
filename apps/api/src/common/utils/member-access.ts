import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { getMembershipRemainingDays, isMembershipActive } from './membership-time';

export type MemberRoleCode = 'FREE_USER' | 'STANDARD_MEMBER' | 'SUPER_MEMBER';
export type MemberLevel = 'standard' | 'super';
export type MemberPermissionKey =
  | 'jobs:list:view'
  | 'jobs:search:use'
  | 'jobs:filter:use'
  | 'jobs:detail:view'
  | 'jobs:deliver:use'
  | 'jobs:referral:view'
  | 'jobs:progress:update'
  | 'jobs:recommend:view';

export interface MemberPermissionCatalogItem {
  key: MemberPermissionKey;
  name: string;
  group: string;
  description: string;
}

export interface MemberRoleDefinition {
  code: MemberRoleCode;
  name: string;
  description: string;
  sortOrder: number;
  inheritedRoleCode?: MemberRoleCode | null;
  permissionKeys: MemberPermissionKey[];
}

export interface MemberAccessSnapshot {
  isMember: boolean;
  memberLevel: MemberLevel | null;
  memberLevelLabel: string;
  memberRoleCode: MemberRoleCode;
  memberRoleName: string;
  permissionKeys: MemberPermissionKey[];
  membershipRemainingDays: number;
}

export interface MemberRolePermissionMaps {
  directPermissionMap: Record<MemberRoleCode, MemberPermissionKey[]>;
  effectivePermissionMap: Record<MemberRoleCode, MemberPermissionKey[]>;
}

type PrismaLike = PrismaService | Prisma.TransactionClient;
type MembershipLike = { endAt?: Date | null; memberLevel?: string | null } | null | undefined;

export const MEMBER_PERMISSION_CATALOG: MemberPermissionCatalogItem[] = [
  { key: 'jobs:list:view', name: '招聘公告列表访问权限', group: 'jobs', description: '控制是否能获取招聘公告列表数据' },
  { key: 'jobs:search:use', name: '岗位搜索权限', group: 'jobs', description: '控制关键词搜索能力' },
  { key: 'jobs:filter:use', name: '岗位筛选权限', group: 'jobs', description: '控制地区、学历、企业性质、招聘类型等筛选能力' },
  { key: 'jobs:detail:view', name: '查看招聘公告详情权限', group: 'jobs', description: '控制查看公告、查看详情等能力' },
  { key: 'jobs:deliver:use', name: '立即投递权限', group: 'jobs', description: '控制复制邮箱或跳转投递入口的能力' },
  { key: 'jobs:referral:view', name: '查看内推码权限', group: 'jobs', description: '控制查看岗位内推信息的能力' },
  { key: 'jobs:progress:update', name: '标记求职进度权限', group: 'jobs', description: '控制更新岗位求职进度的能力' },
  { key: 'jobs:recommend:view', name: '访问专属推荐模块权限', group: 'jobs', description: '控制进入专属推荐与获取推荐结果的能力' },
];

export const MEMBER_ROLE_DEFINITIONS: MemberRoleDefinition[] = [
  {
    code: 'FREE_USER',
    name: '免费用户',
    description: '注册默认角色，仅可浏览基础公开内容',
    sortOrder: 10,
    inheritedRoleCode: null,
    permissionKeys: [],
  },
  {
    code: 'STANDARD_MEMBER',
    name: '标准会员',
    description: '开放招聘列表、搜索筛选、详情查看与立即投递能力',
    sortOrder: 20,
    inheritedRoleCode: 'FREE_USER',
    permissionKeys: ['jobs:list:view', 'jobs:search:use', 'jobs:filter:use', 'jobs:detail:view', 'jobs:deliver:use'],
  },
  {
    code: 'SUPER_MEMBER',
    name: '超级会员',
    description: '自动继承标准会员能力，并额外开放内推、进度与专属推荐',
    sortOrder: 30,
    inheritedRoleCode: 'STANDARD_MEMBER',
    permissionKeys: ['jobs:referral:view', 'jobs:progress:update', 'jobs:recommend:view'],
  },
];

const MEMBER_ROLE_LABEL_MAP: Record<MemberRoleCode, string> = Object.fromEntries(
  MEMBER_ROLE_DEFINITIONS.map((item) => [item.code, item.name]),
) as Record<MemberRoleCode, string>;

const MEMBER_LEVEL_LABEL_MAP: Record<MemberLevel, string> = {
  standard: '标准会员',
  super: '超级会员',
};

const MEMBER_ROLE_PARENT_MAP: Record<MemberRoleCode, MemberRoleCode | null> = {
  FREE_USER: null,
  STANDARD_MEMBER: 'FREE_USER',
  SUPER_MEMBER: 'STANDARD_MEMBER',
};

const DEFAULT_DIRECT_PERMISSION_MAP: Record<MemberRoleCode, MemberPermissionKey[]> = MEMBER_ROLE_DEFINITIONS.reduce(
  (accumulator, item) => {
    accumulator[item.code] = [...item.permissionKeys];
    return accumulator;
  },
  {} as Record<MemberRoleCode, MemberPermissionKey[]>,
);

export function getMemberRoleName(roleCode: MemberRoleCode) {
  return MEMBER_ROLE_LABEL_MAP[roleCode] || roleCode;
}

export function getMemberLevelLabel(memberLevel?: string | null) {
  const normalized = normalizeStoredMemberLevel(memberLevel);
  return normalized ? MEMBER_LEVEL_LABEL_MAP[normalized] : '免费用户';
}

export function normalizeStoredMemberLevel(memberLevel?: string | null): MemberLevel | null {
  if (!memberLevel) {
    return null;
  }

  const normalized = String(memberLevel).trim().toLowerCase();
  if (normalized === 'super' || normalized === 'super_member' || normalized === 'super-member') {
    return 'super';
  }
  if (normalized === 'standard' || normalized === 'standard_member' || normalized === 'standard-member') {
    return 'standard';
  }

  return 'standard';
}

export function parseMemberLevelInput(input: unknown, fallback: MemberLevel = 'standard'): MemberLevel {
  if (input === undefined || input === null || input === '') {
    return fallback;
  }

  const normalized = String(input).trim().toLowerCase();
  if (normalized === 'standard' || normalized === 'standard_member' || normalized === 'standard-member') {
    return 'standard';
  }
  if (normalized === 'super' || normalized === 'super_member' || normalized === 'super-member') {
    return 'super';
  }

  throw new BadRequestException('会员等级仅支持 standard 或 super');
}

export function getMemberRoleCodeByLevel(memberLevel?: string | null): Exclude<MemberRoleCode, 'FREE_USER'> {
  return normalizeStoredMemberLevel(memberLevel) === 'super' ? 'SUPER_MEMBER' : 'STANDARD_MEMBER';
}

export function deriveMemberRoleCode(membership?: MembershipLike, now: Date = new Date()): MemberRoleCode {
  if (!membership || !isMembershipActive(membership.endAt, now)) {
    return 'FREE_USER';
  }

  return getMemberRoleCodeByLevel(membership.memberLevel);
}

export async function ensureMemberRoleSetup(prisma: PrismaLike) {
  const existingRoles = await prisma.memberRole.findMany({
    select: {
      id: true,
      code: true,
    },
  });

  const existingRoleMap = new Map(existingRoles.map((item) => [item.code, item]));

  for (const role of MEMBER_ROLE_DEFINITIONS) {
    if (existingRoleMap.has(role.code)) {
      continue;
    }

    await prisma.memberRole.create({
      data: {
        code: role.code,
        name: role.name,
        description: role.description,
        status: 'active',
        isSystem: true,
        sortOrder: role.sortOrder,
        permissions: role.permissionKeys.length
          ? {
              create: role.permissionKeys.map((permissionKey) => {
                const meta = MEMBER_PERMISSION_CATALOG.find((item) => item.key === permissionKey)!;
                return {
                  permissionKey,
                  permissionName: meta.name,
                  permissionGroup: meta.group,
                  permissionType: 'member',
                };
              }),
            }
          : undefined,
      },
    });
  }
}

export async function getMemberRolePermissionMaps(prisma: PrismaLike): Promise<MemberRolePermissionMaps> {
  await ensureMemberRoleSetup(prisma);

  const roles = await prisma.memberRole.findMany({
    include: {
      permissions: {
        orderBy: {
          permissionKey: 'asc',
        },
      },
    },
  });

  const directPermissionMap = MEMBER_ROLE_DEFINITIONS.reduce((accumulator, item) => {
    const role = roles.find((roleItem) => roleItem.code === item.code);
    accumulator[item.code] = (role?.permissions.map((permission) => permission.permissionKey as MemberPermissionKey) ?? DEFAULT_DIRECT_PERMISSION_MAP[item.code]).sort();
    return accumulator;
  }, {} as Record<MemberRoleCode, MemberPermissionKey[]>);

  const effectivePermissionMap = MEMBER_ROLE_DEFINITIONS.reduce((accumulator, item) => {
    accumulator[item.code] = resolveEffectivePermissionKeys(item.code, directPermissionMap);
    return accumulator;
  }, {} as Record<MemberRoleCode, MemberPermissionKey[]>);

  return {
    directPermissionMap,
    effectivePermissionMap,
  };
}

export function buildMemberAccessSnapshot(
  membership: MembershipLike,
  effectivePermissionMap: Record<MemberRoleCode, MemberPermissionKey[]>,
  now: Date = new Date(),
): MemberAccessSnapshot {
  const memberRoleCode = deriveMemberRoleCode(membership, now);
  const isMember = memberRoleCode !== 'FREE_USER';
  const memberLevel = isMember ? normalizeStoredMemberLevel(membership?.memberLevel) ?? 'standard' : null;

  return {
    isMember,
    memberLevel,
    memberLevelLabel: memberLevel ? MEMBER_LEVEL_LABEL_MAP[memberLevel] : '免费用户',
    memberRoleCode,
    memberRoleName: getMemberRoleName(memberRoleCode),
    permissionKeys: [...(effectivePermissionMap[memberRoleCode] || [])],
    membershipRemainingDays: isMember ? getMembershipRemainingDays(membership?.endAt ?? null, now) : 0,
  };
}

export async function getUserMemberAccess(prisma: PrismaLike, userId: string, now: Date = new Date()) {
  const [membership, permissionMaps] = await Promise.all([
    prisma.userMembership.findUnique({
      where: { userId },
      select: {
        endAt: true,
        memberLevel: true,
      },
    }),
    getMemberRolePermissionMaps(prisma),
  ]);

  return buildMemberAccessSnapshot(membership, permissionMaps.effectivePermissionMap, now);
}

export async function assertUserHasMemberPermission(
  prisma: PrismaLike,
  userId: string,
  permissionKey: MemberPermissionKey,
  message?: string,
) {
  const access = await getUserMemberAccess(prisma, userId);
  if (!access.permissionKeys.includes(permissionKey)) {
    throw new ForbiddenException(message || '当前会员权益暂不支持该操作');
  }
  return access;
}

function resolveEffectivePermissionKeys(
  roleCode: MemberRoleCode,
  directPermissionMap: Record<MemberRoleCode, MemberPermissionKey[]>,
): MemberPermissionKey[] {
  const parentRoleCode = MEMBER_ROLE_PARENT_MAP[roleCode];
  const currentKeys = directPermissionMap[roleCode] || [];
  if (!parentRoleCode) {
    return [...new Set(currentKeys)].sort();
  }

  const parentKeys = resolveEffectivePermissionKeys(parentRoleCode, directPermissionMap);
  return [...new Set([...parentKeys, ...currentKeys])].sort();
}
