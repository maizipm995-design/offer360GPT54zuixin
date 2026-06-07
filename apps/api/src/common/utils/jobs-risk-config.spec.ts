import { describe, expect, it } from 'vitest';
import { DEFAULT_JOBS_RISK_CONFIG, normalizeJobsRiskConfig } from './jobs-risk-config';

describe('jobs-risk-config', () => {
  it('默认配置直接使用放宽后的高阈值', () => {
    const result = normalizeJobsRiskConfig(null);

    expect(result.accessLimits.viewAnnouncement.perMinute).toBe(DEFAULT_JOBS_RISK_CONFIG.accessLimits.viewAnnouncement.perMinute);
    expect(result.accessLimits.deliver.perDay).toBe(DEFAULT_JOBS_RISK_CONFIG.accessLimits.deliver.perDay);
    expect(result.controls.sharedIpUsers.threshold).toBe(DEFAULT_JOBS_RISK_CONFIG.controls.sharedIpUsers.threshold);
    expect(result.controls.escalation.distinctRuleThreshold).toBe(DEFAULT_JOBS_RISK_CONFIG.controls.escalation.distinctRuleThreshold);
  });

  it('历史严苛小阈值配置会在运行时被统一抬升到放宽下限', () => {
    const result = normalizeJobsRiskConfig({
      accessLimits: {
        detail: { perMinute: 1, perTenMinutes: 10, perHour: 20, perDay: 30 },
        viewAnnouncement: { perMinute: 1, perTenMinutes: 10, perHour: 20, perDay: 30 },
        deliver: { perMinute: 1, perTenMinutes: 10, perHour: 20, perDay: 30 },
        scopeMultiplier: { user: 0.1, ip: 0.1, device: 0.1, session: 0.1 },
      },
      controls: {
        repeatedLimitHits: { userThreshold: 1, ipThreshold: 1, deviceThreshold: 1 },
        distinctJobBurst: { userThreshold: 1, ipThreshold: 1, deviceThreshold: 1 },
        nightBurst: { userThreshold: 1, ipThreshold: 1, deviceThreshold: 1 },
        sharedIpUsers: { threshold: 1 },
        sharedDeviceUsers: { threshold: 1 },
        userIpRotation: { threshold: 1 },
        regularPageScan: { userThreshold: 1, ipThreshold: 1, deviceThreshold: 1, sessionThreshold: 1 },
        jobEnumeration: { userThreshold: 1, ipThreshold: 1, deviceThreshold: 1, sessionThreshold: 1 },
        escalation: { distinctRuleThreshold: 1, severeHitThreshold: 1 },
      },
    });

    expect(result.accessLimits.detail.perMinute).toBe(DEFAULT_JOBS_RISK_CONFIG.accessLimits.detail.perMinute);
    expect(result.accessLimits.viewAnnouncement.perDay).toBe(DEFAULT_JOBS_RISK_CONFIG.accessLimits.viewAnnouncement.perDay);
    expect(result.accessLimits.deliver.perHour).toBe(DEFAULT_JOBS_RISK_CONFIG.accessLimits.deliver.perHour);
    expect(result.accessLimits.scopeMultiplier.user).toBe(1);
    expect(result.accessLimits.scopeMultiplier.ip).toBe(1);
    expect(result.controls.repeatedLimitHits.userThreshold).toBe(DEFAULT_JOBS_RISK_CONFIG.controls.repeatedLimitHits.userThreshold);
    expect(result.controls.sharedIpUsers.threshold).toBe(DEFAULT_JOBS_RISK_CONFIG.controls.sharedIpUsers.threshold);
    expect(result.controls.regularPageScan.sessionThreshold).toBe(DEFAULT_JOBS_RISK_CONFIG.controls.regularPageScan.sessionThreshold);
    expect(result.controls.jobEnumeration.deviceThreshold).toBe(DEFAULT_JOBS_RISK_CONFIG.controls.jobEnumeration.deviceThreshold);
    expect(result.controls.escalation.distinctRuleThreshold).toBe(DEFAULT_JOBS_RISK_CONFIG.controls.escalation.distinctRuleThreshold);
  });
});
