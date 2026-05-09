export const MEMBERSHIP_DAY_IN_MS = 24 * 60 * 60 * 1000;

export function isMembershipActive(endAt?: Date | null, now: Date = new Date()) {
  if (!endAt) {
    return false;
  }

  return endAt.getTime() >= now.getTime();
}

export function getMembershipRemainingDays(endAt?: Date | null, now: Date = new Date()) {
  if (!endAt) {
    return 0;
  }

  const diff = endAt.getTime() - now.getTime();
  if (diff < 0) {
    return 0;
  }

  return Math.max(Math.ceil(diff / MEMBERSHIP_DAY_IN_MS), 1);
}
