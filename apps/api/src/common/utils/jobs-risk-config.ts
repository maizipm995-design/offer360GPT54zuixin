import { Prisma } from '@prisma/client';

type BootstrapConfigClient = {
  $executeRawUnsafe: (query: string) => Promise<unknown>;
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
      perMinute: 18,
      perTenMinutes: 120,
      perHour: 320,
      perDay: 800,
    },
    viewAnnouncement: {
      perMinute: 10,
      perTenMinutes: 50,
      perHour: 150,
      perDay: 400,
    },
    deliver: {
      perMinute: 10,
      perTenMinutes: 50,
      perHour: 150,
      perDay: 400,
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
      restrictSeconds: 30 * 60,
    },
    repeatedLimitHits: {
      windowSeconds: 10 * 60,
      userThreshold: 10,
      ipThreshold: 20,
      deviceThreshold: 18,
      userCooldownSeconds: 5 * 60,
      ipRestrictSeconds: 5 * 60,
      deviceRestrictSeconds: 5 * 60,
    },
    distinctJobBurst: {
      windowSeconds: 10 * 60,
      userThreshold: 45,
      ipThreshold: 90,
      deviceThreshold: 60,
      restrictSeconds: 8 * 60,
    },
    nightBurst: {
      windowSeconds: 20 * 60,
      userThreshold: 60,
      ipThreshold: 90,
      deviceThreshold: 72,
      freezeSeconds: 10 * 60,
      startHour: 1,
      endHour: 6,
    },
    sharedIpUsers: {
      windowSeconds: 10 * 60,
      threshold: 15,
      freezeSeconds: 10 * 60,
    },
    sharedDeviceUsers: {
      windowSeconds: 10 * 60,
      threshold: 10,
      freezeSeconds: 10 * 60,
    },
    userIpRotation: {
      windowSeconds: 10 * 60,
      threshold: 12,
      freezeSeconds: 10 * 60,
    },
    regularPageScan: {
      windowSeconds: 2 * 60,
      userThreshold: 24,
      ipThreshold: 40,
      deviceThreshold: 32,
      sessionThreshold: 24,
      maxGapSeconds: 12,
      cooldownSeconds: 3 * 60,
    },
    jobEnumeration: {
      windowSeconds: 2 * 60,
      userThreshold: 40,
      ipThreshold: 60,
      deviceThreshold: 48,
      sessionThreshold: 40,
      restrictSeconds: 8 * 60,
    },
    escalation: {
      windowSeconds: 24 * 60 * 60,
      distinctRuleThreshold: 5,
      severeHitThreshold: 5,
      freezeSeconds: 2 * 60 * 60,
    },
  },
};

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

  return {
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
  await client.$executeRawUnsafe(`
    ALTER TABLE admin_bootstrap_configs
    ADD COLUMN IF NOT EXISTS jobs_risk_config JSON NULL AFTER register_entry_closed
  `);
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
