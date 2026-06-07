import { Prisma } from '@prisma/client';

type BootstrapConfigClient = {
  $executeRawUnsafe: (query: string) => Promise<unknown>;
  $queryRawUnsafe: <T = unknown>(query: string) => Promise<T>;
};

type BootstrapConfigReader = BootstrapConfigClient & {
  adminBootstrapConfig: {
    findUnique: (args: { where: { id: number } }) => Promise<Record<string, unknown> | null>;
    upsert: (args: {
      where: { id: number };
      update: { jobsRiskConfig: Prisma.InputJsonValue };
      create: { id: number; jobsRiskConfig: Prisma.InputJsonValue };
    }) => Promise<Record<string, unknown>>;
  };
};

type NormalizeOptions = {
  strict?: boolean;
};

export type JobsAccessLimitActionConfig = {
  perMinute: number;
  perTenMinutes: number;
  perHour: number;
  perDay: number;
};

export type JobsRiskConfig = {
  accessLimits: {
    detail: JobsAccessLimitActionConfig;
    viewAnnouncement: JobsAccessLimitActionConfig;
    deliver: JobsAccessLimitActionConfig;
    scopeMultiplier: {
      user: number;
      ip: number;
      device: number;
      session: number;
    };
  };
  controls: {
    dailyQuotaExceeded: {
      restrictSeconds: number;
    };
    repeatedLimitHits: {
      windowSeconds: number;
      userThreshold: number;
      ipThreshold: number;
      deviceThreshold: number;
      userCooldownSeconds: number;
      ipRestrictSeconds: number;
      deviceRestrictSeconds: number;
    };
    distinctJobBurst: {
      windowSeconds: number;
      userThreshold: number;
      ipThreshold: number;
      deviceThreshold: number;
      restrictSeconds: number;
    };
    nightBurst: {
      windowSeconds: number;
      userThreshold: number;
      ipThreshold: number;
      deviceThreshold: number;
      freezeSeconds: number;
      startHour: number;
      endHour: number;
    };
    sharedIpUsers: {
      windowSeconds: number;
      threshold: number;
      freezeSeconds: number;
    };
    sharedDeviceUsers: {
      windowSeconds: number;
      threshold: number;
      freezeSeconds: number;
    };
    userIpRotation: {
      windowSeconds: number;
      threshold: number;
      freezeSeconds: number;
    };
    regularPageScan: {
      windowSeconds: number;
      userThreshold: number;
      ipThreshold: number;
      deviceThreshold: number;
      sessionThreshold: number;
      maxGapSeconds: number;
      cooldownSeconds: number;
    };
    jobEnumeration: {
      windowSeconds: number;
      userThreshold: number;
      ipThreshold: number;
      deviceThreshold: number;
      sessionThreshold: number;
      restrictSeconds: number;
    };
    escalation: {
      windowSeconds: number;
      distinctRuleThreshold: number;
      severeHitThreshold: number;
      freezeSeconds: number;
    };
  };
};

export const DEFAULT_JOBS_RISK_CONFIG: JobsRiskConfig = {
  accessLimits: {
    detail: {
      perMinute: 10000,
      perTenMinutes: 100000,
      perHour: 300000,
      perDay: 2000000,
    },
    viewAnnouncement: {
      perMinute: 5000,
      perTenMinutes: 50000,
      perHour: 200000,
      perDay: 1000000,
    },
    deliver: {
      perMinute: 5000,
      perTenMinutes: 50000,
      perHour: 200000,
      perDay: 1000000,
    },
    scopeMultiplier: {
      user: 1,
      ip: 2.5,
      device: 2,
      session: 1.5,
    },
  },
  controls: {
    dailyQuotaExceeded: {
      restrictSeconds: 20 * 60,
    },
    repeatedLimitHits: {
      windowSeconds: 10 * 60,
      userThreshold: 50000,
      ipThreshold: 50000,
      deviceThreshold: 50000,
      userCooldownSeconds: 2 * 60,
      ipRestrictSeconds: 3 * 60,
      deviceRestrictSeconds: 3 * 60,
    },
    distinctJobBurst: {
      windowSeconds: 10 * 60,
      userThreshold: 50000,
      ipThreshold: 50000,
      deviceThreshold: 50000,
      restrictSeconds: 5 * 60,
    },
    nightBurst: {
      windowSeconds: 20 * 60,
      userThreshold: 50000,
      ipThreshold: 50000,
      deviceThreshold: 50000,
      freezeSeconds: 5 * 60,
      startHour: 1,
      endHour: 6,
    },
    sharedIpUsers: {
      windowSeconds: 10 * 60,
      threshold: 10000,
      freezeSeconds: 10 * 60,
    },
    sharedDeviceUsers: {
      windowSeconds: 10 * 60,
      threshold: 10000,
      freezeSeconds: 10 * 60,
    },
    userIpRotation: {
      windowSeconds: 10 * 60,
      threshold: 10000,
      freezeSeconds: 5 * 60,
    },
    regularPageScan: {
      windowSeconds: 5 * 60,
      userThreshold: 50000,
      ipThreshold: 50000,
      deviceThreshold: 50000,
      sessionThreshold: 50000,
      maxGapSeconds: 4,
      cooldownSeconds: 2 * 60,
    },
    jobEnumeration: {
      windowSeconds: 5 * 60,
      userThreshold: 50000,
      ipThreshold: 50000,
      deviceThreshold: 50000,
      sessionThreshold: 50000,
      restrictSeconds: 5 * 60,
    },
    escalation: {
      windowSeconds: 24 * 60 * 60,
      distinctRuleThreshold: 999,
      severeHitThreshold: 50000,
      freezeSeconds: 60 * 60,
    },
  },
};

function applyRelaxedJobsRiskFloor(config: JobsRiskConfig): JobsRiskConfig {
  const floor = DEFAULT_JOBS_RISK_CONFIG;

  return {
    accessLimits: {
      detail: {
        perMinute: Math.max(config.accessLimits.detail.perMinute, floor.accessLimits.detail.perMinute),
        perTenMinutes: Math.max(config.accessLimits.detail.perTenMinutes, floor.accessLimits.detail.perTenMinutes),
        perHour: Math.max(config.accessLimits.detail.perHour, floor.accessLimits.detail.perHour),
        perDay: Math.max(config.accessLimits.detail.perDay, floor.accessLimits.detail.perDay),
      },
      viewAnnouncement: {
        perMinute: Math.max(config.accessLimits.viewAnnouncement.perMinute, floor.accessLimits.viewAnnouncement.perMinute),
        perTenMinutes: Math.max(config.accessLimits.viewAnnouncement.perTenMinutes, floor.accessLimits.viewAnnouncement.perTenMinutes),
        perHour: Math.max(config.accessLimits.viewAnnouncement.perHour, floor.accessLimits.viewAnnouncement.perHour),
        perDay: Math.max(config.accessLimits.viewAnnouncement.perDay, floor.accessLimits.viewAnnouncement.perDay),
      },
      deliver: {
        perMinute: Math.max(config.accessLimits.deliver.perMinute, floor.accessLimits.deliver.perMinute),
        perTenMinutes: Math.max(config.accessLimits.deliver.perTenMinutes, floor.accessLimits.deliver.perTenMinutes),
        perHour: Math.max(config.accessLimits.deliver.perHour, floor.accessLimits.deliver.perHour),
        perDay: Math.max(config.accessLimits.deliver.perDay, floor.accessLimits.deliver.perDay),
      },
      scopeMultiplier: {
        user: Math.max(config.accessLimits.scopeMultiplier.user, 1),
        ip: Math.max(config.accessLimits.scopeMultiplier.ip, 1),
        device: Math.max(config.accessLimits.scopeMultiplier.device, 1),
        session: Math.max(config.accessLimits.scopeMultiplier.session, 1),
      },
    },
    controls: {
      dailyQuotaExceeded: {
        restrictSeconds: config.controls.dailyQuotaExceeded.restrictSeconds,
      },
      repeatedLimitHits: {
        windowSeconds: config.controls.repeatedLimitHits.windowSeconds,
        userThreshold: Math.max(config.controls.repeatedLimitHits.userThreshold, floor.controls.repeatedLimitHits.userThreshold),
        ipThreshold: Math.max(config.controls.repeatedLimitHits.ipThreshold, floor.controls.repeatedLimitHits.ipThreshold),
        deviceThreshold: Math.max(config.controls.repeatedLimitHits.deviceThreshold, floor.controls.repeatedLimitHits.deviceThreshold),
        userCooldownSeconds: config.controls.repeatedLimitHits.userCooldownSeconds,
        ipRestrictSeconds: config.controls.repeatedLimitHits.ipRestrictSeconds,
        deviceRestrictSeconds: config.controls.repeatedLimitHits.deviceRestrictSeconds,
      },
      distinctJobBurst: {
        windowSeconds: config.controls.distinctJobBurst.windowSeconds,
        userThreshold: Math.max(config.controls.distinctJobBurst.userThreshold, floor.controls.distinctJobBurst.userThreshold),
        ipThreshold: Math.max(config.controls.distinctJobBurst.ipThreshold, floor.controls.distinctJobBurst.ipThreshold),
        deviceThreshold: Math.max(config.controls.distinctJobBurst.deviceThreshold, floor.controls.distinctJobBurst.deviceThreshold),
        restrictSeconds: config.controls.distinctJobBurst.restrictSeconds,
      },
      nightBurst: {
        windowSeconds: config.controls.nightBurst.windowSeconds,
        userThreshold: Math.max(config.controls.nightBurst.userThreshold, floor.controls.nightBurst.userThreshold),
        ipThreshold: Math.max(config.controls.nightBurst.ipThreshold, floor.controls.nightBurst.ipThreshold),
        deviceThreshold: Math.max(config.controls.nightBurst.deviceThreshold, floor.controls.nightBurst.deviceThreshold),
        freezeSeconds: config.controls.nightBurst.freezeSeconds,
        startHour: config.controls.nightBurst.startHour,
        endHour: config.controls.nightBurst.endHour,
      },
      sharedIpUsers: {
        windowSeconds: config.controls.sharedIpUsers.windowSeconds,
        threshold: Math.max(config.controls.sharedIpUsers.threshold, floor.controls.sharedIpUsers.threshold),
        freezeSeconds: config.controls.sharedIpUsers.freezeSeconds,
      },
      sharedDeviceUsers: {
        windowSeconds: config.controls.sharedDeviceUsers.windowSeconds,
        threshold: Math.max(config.controls.sharedDeviceUsers.threshold, floor.controls.sharedDeviceUsers.threshold),
        freezeSeconds: config.controls.sharedDeviceUsers.freezeSeconds,
      },
      userIpRotation: {
        windowSeconds: config.controls.userIpRotation.windowSeconds,
        threshold: Math.max(config.controls.userIpRotation.threshold, floor.controls.userIpRotation.threshold),
        freezeSeconds: config.controls.userIpRotation.freezeSeconds,
      },
      regularPageScan: {
        windowSeconds: config.controls.regularPageScan.windowSeconds,
        userThreshold: Math.max(config.controls.regularPageScan.userThreshold, floor.controls.regularPageScan.userThreshold),
        ipThreshold: Math.max(config.controls.regularPageScan.ipThreshold, floor.controls.regularPageScan.ipThreshold),
        deviceThreshold: Math.max(config.controls.regularPageScan.deviceThreshold, floor.controls.regularPageScan.deviceThreshold),
        sessionThreshold: Math.max(config.controls.regularPageScan.sessionThreshold, floor.controls.regularPageScan.sessionThreshold),
        maxGapSeconds: config.controls.regularPageScan.maxGapSeconds,
        cooldownSeconds: config.controls.regularPageScan.cooldownSeconds,
      },
      jobEnumeration: {
        windowSeconds: config.controls.jobEnumeration.windowSeconds,
        userThreshold: Math.max(config.controls.jobEnumeration.userThreshold, floor.controls.jobEnumeration.userThreshold),
        ipThreshold: Math.max(config.controls.jobEnumeration.ipThreshold, floor.controls.jobEnumeration.ipThreshold),
        deviceThreshold: Math.max(config.controls.jobEnumeration.deviceThreshold, floor.controls.jobEnumeration.deviceThreshold),
        sessionThreshold: Math.max(config.controls.jobEnumeration.sessionThreshold, floor.controls.jobEnumeration.sessionThreshold),
        restrictSeconds: config.controls.jobEnumeration.restrictSeconds,
      },
      escalation: {
        windowSeconds: config.controls.escalation.windowSeconds,
        distinctRuleThreshold: Math.max(config.controls.escalation.distinctRuleThreshold, floor.controls.escalation.distinctRuleThreshold),
        severeHitThreshold: Math.max(config.controls.escalation.severeHitThreshold, floor.controls.escalation.severeHitThreshold),
        freezeSeconds: config.controls.escalation.freezeSeconds,
      },
    },
  };
}

let jobsRiskConfigCache: { value: JobsRiskConfig; expiresAt: number } | null = null;

const JOBS_RISK_CONFIG_CACHE_TTL_MS = 15 * 1000;

function cloneConfig(config: JobsRiskConfig): JobsRiskConfig {
  return JSON.parse(JSON.stringify(config)) as JobsRiskConfig;
}

function ensureObject(value: unknown, field: string, strict: boolean) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (strict) {
    throw new Error(`${field} 配置格式不合法`);
  }
  return {};
}

function readNumber(value: unknown, fallback: number, field: string, strict: boolean) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (strict) {
    throw new Error(`${field} 必须为数字`);
  }
  return fallback;
}

function readPositiveInteger(value: unknown, fallback: number, field: string, strict: boolean) {
  const parsed = readNumber(value, fallback, field, strict);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  if (strict) {
    throw new Error(`${field} 必须为大于 0 的整数`);
  }
  return fallback;
}

function readPositiveDecimal(value: unknown, fallback: number, field: string, strict: boolean) {
  const parsed = readNumber(value, fallback, field, strict);
  if (parsed > 0) {
    return parsed;
  }
  if (strict) {
    throw new Error(`${field} 必须为大于 0 的数字`);
  }
  return fallback;
}

function readHour(value: unknown, fallback: number, field: string, strict: boolean) {
  const parsed = readNumber(value, fallback, field, strict);
  if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 23) {
    return parsed;
  }
  if (strict) {
    throw new Error(`${field} 必须为 0 到 23 之间的整数`);
  }
  return fallback;
}

export function normalizeJobsRiskConfig(input: unknown, options: NormalizeOptions = {}) {
  const strict = options.strict ?? false;
  const source = ensureObject(input, 'jobsRiskConfig', strict);
  const accessLimits = ensureObject(source.accessLimits, 'accessLimits', strict);
  const controls = ensureObject(source.controls, 'controls', strict);
  const defaultConfig = DEFAULT_JOBS_RISK_CONFIG;

  const detail = ensureObject(accessLimits.detail, 'accessLimits.detail', strict);
  const viewAnnouncement = ensureObject(accessLimits.viewAnnouncement, 'accessLimits.viewAnnouncement', strict);
  const deliver = ensureObject(accessLimits.deliver, 'accessLimits.deliver', strict);
  const scopeMultiplier = ensureObject(accessLimits.scopeMultiplier, 'accessLimits.scopeMultiplier', strict);
  const dailyQuotaExceeded = ensureObject(controls.dailyQuotaExceeded, 'controls.dailyQuotaExceeded', strict);
  const repeatedLimitHits = ensureObject(controls.repeatedLimitHits, 'controls.repeatedLimitHits', strict);
  const distinctJobBurst = ensureObject(controls.distinctJobBurst, 'controls.distinctJobBurst', strict);
  const nightBurst = ensureObject(controls.nightBurst, 'controls.nightBurst', strict);
  const sharedIpUsers = ensureObject(controls.sharedIpUsers, 'controls.sharedIpUsers', strict);
  const sharedDeviceUsers = ensureObject(controls.sharedDeviceUsers, 'controls.sharedDeviceUsers', strict);
  const userIpRotation = ensureObject(controls.userIpRotation, 'controls.userIpRotation', strict);
  const regularPageScan = ensureObject(controls.regularPageScan, 'controls.regularPageScan', strict);
  const jobEnumeration = ensureObject(controls.jobEnumeration, 'controls.jobEnumeration', strict);
  const escalation = ensureObject(controls.escalation, 'controls.escalation', strict);

  const normalized = {
    accessLimits: {
      detail: {
        perMinute: readPositiveInteger(detail.perMinute, defaultConfig.accessLimits.detail.perMinute, '详情每分钟阈值', strict),
        perTenMinutes: readPositiveInteger(detail.perTenMinutes, defaultConfig.accessLimits.detail.perTenMinutes, '详情十分钟阈值', strict),
        perHour: readPositiveInteger(detail.perHour, defaultConfig.accessLimits.detail.perHour, '详情每小时阈值', strict),
        perDay: readPositiveInteger(detail.perDay, defaultConfig.accessLimits.detail.perDay, '详情每日阈值', strict),
      },
      viewAnnouncement: {
        perMinute: readPositiveInteger(viewAnnouncement.perMinute, defaultConfig.accessLimits.viewAnnouncement.perMinute, '公告每分钟阈值', strict),
        perTenMinutes: readPositiveInteger(viewAnnouncement.perTenMinutes, defaultConfig.accessLimits.viewAnnouncement.perTenMinutes, '公告十分钟阈值', strict),
        perHour: readPositiveInteger(viewAnnouncement.perHour, defaultConfig.accessLimits.viewAnnouncement.perHour, '公告每小时阈值', strict),
        perDay: readPositiveInteger(viewAnnouncement.perDay, defaultConfig.accessLimits.viewAnnouncement.perDay, '公告每日阈值', strict),
      },
      deliver: {
        perMinute: readPositiveInteger(deliver.perMinute, defaultConfig.accessLimits.deliver.perMinute, '投递每分钟阈值', strict),
        perTenMinutes: readPositiveInteger(deliver.perTenMinutes, defaultConfig.accessLimits.deliver.perTenMinutes, '投递十分钟阈值', strict),
        perHour: readPositiveInteger(deliver.perHour, defaultConfig.accessLimits.deliver.perHour, '投递每小时阈值', strict),
        perDay: readPositiveInteger(deliver.perDay, defaultConfig.accessLimits.deliver.perDay, '投递每日阈值', strict),
      },
      scopeMultiplier: {
        user: readPositiveDecimal(scopeMultiplier.user, defaultConfig.accessLimits.scopeMultiplier.user, '账号倍率', strict),
        ip: readPositiveDecimal(scopeMultiplier.ip, defaultConfig.accessLimits.scopeMultiplier.ip, 'IP 倍率', strict),
        device: readPositiveDecimal(scopeMultiplier.device, defaultConfig.accessLimits.scopeMultiplier.device, '设备倍率', strict),
        session: readPositiveDecimal(scopeMultiplier.session, defaultConfig.accessLimits.scopeMultiplier.session, '会话倍率', strict),
      },
    },
    controls: {
      dailyQuotaExceeded: {
        restrictSeconds: readPositiveInteger(dailyQuotaExceeded.restrictSeconds, defaultConfig.controls.dailyQuotaExceeded.restrictSeconds, '每日额度处罚时长', strict),
      },
      repeatedLimitHits: {
        windowSeconds: readPositiveInteger(repeatedLimitHits.windowSeconds, defaultConfig.controls.repeatedLimitHits.windowSeconds, '频控命中统计窗口', strict),
        userThreshold: readPositiveInteger(repeatedLimitHits.userThreshold, defaultConfig.controls.repeatedLimitHits.userThreshold, '账号频控命中阈值', strict),
        ipThreshold: readPositiveInteger(repeatedLimitHits.ipThreshold, defaultConfig.controls.repeatedLimitHits.ipThreshold, 'IP 频控命中阈值', strict),
        deviceThreshold: readPositiveInteger(repeatedLimitHits.deviceThreshold, defaultConfig.controls.repeatedLimitHits.deviceThreshold, '设备频控命中阈值', strict),
        userCooldownSeconds: readPositiveInteger(repeatedLimitHits.userCooldownSeconds, defaultConfig.controls.repeatedLimitHits.userCooldownSeconds, '账号冷却时长', strict),
        ipRestrictSeconds: readPositiveInteger(repeatedLimitHits.ipRestrictSeconds, defaultConfig.controls.repeatedLimitHits.ipRestrictSeconds, 'IP 限制时长', strict),
        deviceRestrictSeconds: readPositiveInteger(repeatedLimitHits.deviceRestrictSeconds, defaultConfig.controls.repeatedLimitHits.deviceRestrictSeconds, '设备限制时长', strict),
      },
      distinctJobBurst: {
        windowSeconds: readPositiveInteger(distinctJobBurst.windowSeconds, defaultConfig.controls.distinctJobBurst.windowSeconds, '不同岗位统计窗口', strict),
        userThreshold: readPositiveInteger(distinctJobBurst.userThreshold, defaultConfig.controls.distinctJobBurst.userThreshold, '账号不同岗位阈值', strict),
        ipThreshold: readPositiveInteger(distinctJobBurst.ipThreshold, defaultConfig.controls.distinctJobBurst.ipThreshold, 'IP 不同岗位阈值', strict),
        deviceThreshold: readPositiveInteger(distinctJobBurst.deviceThreshold, defaultConfig.controls.distinctJobBurst.deviceThreshold, '设备不同岗位阈值', strict),
        restrictSeconds: readPositiveInteger(distinctJobBurst.restrictSeconds, defaultConfig.controls.distinctJobBurst.restrictSeconds, '不同岗位限制时长', strict),
      },
      nightBurst: {
        windowSeconds: readPositiveInteger(nightBurst.windowSeconds, defaultConfig.controls.nightBurst.windowSeconds, '深夜统计窗口', strict),
        userThreshold: readPositiveInteger(nightBurst.userThreshold, defaultConfig.controls.nightBurst.userThreshold, '账号深夜阈值', strict),
        ipThreshold: readPositiveInteger(nightBurst.ipThreshold, defaultConfig.controls.nightBurst.ipThreshold, 'IP 深夜阈值', strict),
        deviceThreshold: readPositiveInteger(nightBurst.deviceThreshold, defaultConfig.controls.nightBurst.deviceThreshold, '设备深夜阈值', strict),
        freezeSeconds: readPositiveInteger(nightBurst.freezeSeconds, defaultConfig.controls.nightBurst.freezeSeconds, '深夜冻结时长', strict),
        startHour: readHour(nightBurst.startHour, defaultConfig.controls.nightBurst.startHour, '深夜开始小时', strict),
        endHour: readHour(nightBurst.endHour, defaultConfig.controls.nightBurst.endHour, '深夜结束小时', strict),
      },
      sharedIpUsers: {
        windowSeconds: readPositiveInteger(sharedIpUsers.windowSeconds, defaultConfig.controls.sharedIpUsers.windowSeconds, '共享 IP 统计窗口', strict),
        threshold: readPositiveInteger(sharedIpUsers.threshold, defaultConfig.controls.sharedIpUsers.threshold, '共享 IP 账号阈值', strict),
        freezeSeconds: readPositiveInteger(sharedIpUsers.freezeSeconds, defaultConfig.controls.sharedIpUsers.freezeSeconds, '共享 IP 冻结时长', strict),
      },
      sharedDeviceUsers: {
        windowSeconds: readPositiveInteger(sharedDeviceUsers.windowSeconds, defaultConfig.controls.sharedDeviceUsers.windowSeconds, '共享设备统计窗口', strict),
        threshold: readPositiveInteger(sharedDeviceUsers.threshold, defaultConfig.controls.sharedDeviceUsers.threshold, '共享设备账号阈值', strict),
        freezeSeconds: readPositiveInteger(sharedDeviceUsers.freezeSeconds, defaultConfig.controls.sharedDeviceUsers.freezeSeconds, '共享设备冻结时长', strict),
      },
      userIpRotation: {
        windowSeconds: readPositiveInteger(userIpRotation.windowSeconds, defaultConfig.controls.userIpRotation.windowSeconds, '轮换 IP 统计窗口', strict),
        threshold: readPositiveInteger(userIpRotation.threshold, defaultConfig.controls.userIpRotation.threshold, '轮换 IP 阈值', strict),
        freezeSeconds: readPositiveInteger(userIpRotation.freezeSeconds, defaultConfig.controls.userIpRotation.freezeSeconds, '轮换 IP 冻结时长', strict),
      },
      regularPageScan: {
        windowSeconds: readPositiveInteger(regularPageScan.windowSeconds, defaultConfig.controls.regularPageScan.windowSeconds, '规律翻页统计窗口', strict),
        userThreshold: readPositiveInteger(regularPageScan.userThreshold, defaultConfig.controls.regularPageScan.userThreshold, '账号规律翻页阈值', strict),
        ipThreshold: readPositiveInteger(regularPageScan.ipThreshold, defaultConfig.controls.regularPageScan.ipThreshold, 'IP 规律翻页阈值', strict),
        deviceThreshold: readPositiveInteger(regularPageScan.deviceThreshold, defaultConfig.controls.regularPageScan.deviceThreshold, '设备规律翻页阈值', strict),
        sessionThreshold: readPositiveInteger(regularPageScan.sessionThreshold, defaultConfig.controls.regularPageScan.sessionThreshold, '会话规律翻页阈值', strict),
        maxGapSeconds: readPositiveInteger(regularPageScan.maxGapSeconds, defaultConfig.controls.regularPageScan.maxGapSeconds, '规律翻页最大间隔秒数', strict),
        cooldownSeconds: readPositiveInteger(regularPageScan.cooldownSeconds, defaultConfig.controls.regularPageScan.cooldownSeconds, '规律翻页冷却时长', strict),
      },
      jobEnumeration: {
        windowSeconds: readPositiveInteger(jobEnumeration.windowSeconds, defaultConfig.controls.jobEnumeration.windowSeconds, '岗位枚举统计窗口', strict),
        userThreshold: readPositiveInteger(jobEnumeration.userThreshold, defaultConfig.controls.jobEnumeration.userThreshold, '账号岗位枚举阈值', strict),
        ipThreshold: readPositiveInteger(jobEnumeration.ipThreshold, defaultConfig.controls.jobEnumeration.ipThreshold, 'IP 岗位枚举阈值', strict),
        deviceThreshold: readPositiveInteger(jobEnumeration.deviceThreshold, defaultConfig.controls.jobEnumeration.deviceThreshold, '设备岗位枚举阈值', strict),
        sessionThreshold: readPositiveInteger(jobEnumeration.sessionThreshold, defaultConfig.controls.jobEnumeration.sessionThreshold, '会话岗位枚举阈值', strict),
        restrictSeconds: readPositiveInteger(jobEnumeration.restrictSeconds, defaultConfig.controls.jobEnumeration.restrictSeconds, '岗位枚举限制时长', strict),
      },
      escalation: {
        windowSeconds: readPositiveInteger(escalation.windowSeconds, defaultConfig.controls.escalation.windowSeconds, '升级统计窗口', strict),
        distinctRuleThreshold: readPositiveInteger(escalation.distinctRuleThreshold, defaultConfig.controls.escalation.distinctRuleThreshold, '升级所需规则数', strict),
        severeHitThreshold: readPositiveInteger(escalation.severeHitThreshold, defaultConfig.controls.escalation.severeHitThreshold, '高等级重复命中阈值', strict),
        freezeSeconds: readPositiveInteger(escalation.freezeSeconds, defaultConfig.controls.escalation.freezeSeconds, '四级冻结时长', strict),
      },
    },
  } satisfies JobsRiskConfig;

  return applyRelaxedJobsRiskFloor(normalized);
}

export async function ensureAdminBootstrapRiskConfigStorage(client: BootstrapConfigClient) {
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS admin_bootstrap_configs (
      id INT NOT NULL PRIMARY KEY,
      register_entry_closed TINYINT(1) NOT NULL DEFAULT 0,
      jobs_risk_config JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  const jobsRiskColumns = await client.$queryRawUnsafe<Array<{ Field: string }>>(
    "SHOW COLUMNS FROM admin_bootstrap_configs LIKE 'jobs_risk_config'",
  );
  if (!jobsRiskColumns.length) {
    await client.$executeRawUnsafe(`
      ALTER TABLE admin_bootstrap_configs
      ADD COLUMN jobs_risk_config JSON NULL AFTER register_entry_closed
    `);
  }
}

export async function getJobsRiskConfig(client: BootstrapConfigReader, options: { forceRefresh?: boolean } = {}) {
  const now = Date.now();
  if (!options.forceRefresh && jobsRiskConfigCache && jobsRiskConfigCache.expiresAt > now) {
    return cloneConfig(jobsRiskConfigCache.value);
  }

  await ensureAdminBootstrapRiskConfigStorage(client);
  const row = await client.adminBootstrapConfig.findUnique({
    where: { id: 1 },
  });
  const value = normalizeJobsRiskConfig(row?.jobsRiskConfig ?? null);
  jobsRiskConfigCache = {
    value,
    expiresAt: now + JOBS_RISK_CONFIG_CACHE_TTL_MS,
  };
  return cloneConfig(value);
}

export async function saveJobsRiskConfig(client: BootstrapConfigReader, input: unknown) {
  const normalized = normalizeJobsRiskConfig(input, { strict: true });
  await ensureAdminBootstrapRiskConfigStorage(client);
  await client.adminBootstrapConfig.upsert({
    where: { id: 1 },
    update: {
      jobsRiskConfig: normalized as Prisma.InputJsonValue,
    },
    create: {
      id: 1,
      jobsRiskConfig: normalized as Prisma.InputJsonValue,
    },
  });
  jobsRiskConfigCache = {
    value: normalized,
    expiresAt: Date.now() + JOBS_RISK_CONFIG_CACHE_TTL_MS,
  };
  return cloneConfig(normalized);
}
