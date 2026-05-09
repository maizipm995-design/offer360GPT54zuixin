import { PrismaClient } from '@prisma/client';
import {
  loadNormalizationLookup,
  normalizeOptionalValueForStorage,
  normalizePreferencesForStorage,
} from './normalization-storage';

const prisma = new PrismaClient();

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function parseUserIdsFromArgs() {
  return Array.from(
    new Set(
      process.argv
        .filter((item) => item.startsWith('--userId='))
        .flatMap((item) => item.slice('--userId='.length).split(','))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

async function main() {
  const apply = process.argv.includes('--apply');
  const userIds = parseUserIdsFromArgs();
  const userFilter = userIds.length ? { userId: { in: userIds } } : undefined;
  const normalizationLookup = await loadNormalizationLookup(prisma);

  const [profiles, preferences] = await Promise.all([
    prisma.userProfile.findMany({
      where: userFilter,
      orderBy: { userId: 'asc' },
      select: {
        userId: true,
        degree: true,
        major: true,
      },
    }),
    prisma.userJobPreferenceTag.findMany({
      where: userFilter,
      orderBy: { userId: 'asc' },
      select: {
        userId: true,
        intentionCity: true,
        intentionJob: true,
        intentionCompany: true,
      },
    }),
  ]);

  const profileChanges: Array<{
    userId: string;
    before: { degree: string | null; major: string | null };
    after: { degree: string | null; major: string | null };
  }> = [];
  const preferenceChanges: Array<{
    userId: string;
    before: { intentionCity: string[]; intentionJob: string[]; intentionCompany: string[] };
    after: { intentionCity: string[]; intentionJob: string[]; intentionCompany: string[] };
  }> = [];

  for (const profile of profiles) {
    const nextDegree = normalizeOptionalValueForStorage(normalizationLookup, 'DEGREE', profile.degree);
    const nextMajor = normalizeOptionalValueForStorage(normalizationLookup, 'MAJOR', profile.major);
    if (nextDegree === profile.degree && nextMajor === profile.major) {
      continue;
    }

    const change = {
      userId: profile.userId,
      before: { degree: profile.degree, major: profile.major },
      after: {
        degree: nextDegree ?? null,
        major: nextMajor ?? null,
      },
    };
    profileChanges.push(change);

    if (apply) {
      await prisma.userProfile.update({
        where: { userId: profile.userId },
        data: change.after,
      });
    }
  }

  for (const preference of preferences) {
    const currentIntentionCity = Array.isArray(preference.intentionCity) ? preference.intentionCity as string[] : [];
    const currentIntentionJob = Array.isArray(preference.intentionJob) ? preference.intentionJob as string[] : [];
    const currentIntentionCompany = Array.isArray(preference.intentionCompany) ? preference.intentionCompany as string[] : [];

    const nextIntentionCity = normalizePreferencesForStorage(normalizationLookup, 'LOCATION', currentIntentionCity) ?? [];
    const nextIntentionJob = normalizePreferencesForStorage(normalizationLookup, 'JOB_TITLE', currentIntentionJob) ?? [];
    const nextIntentionCompany = normalizePreferencesForStorage(normalizationLookup, 'COMPANY', currentIntentionCompany) ?? [];

    if (
      arraysEqual(nextIntentionCity, currentIntentionCity)
      && arraysEqual(nextIntentionJob, currentIntentionJob)
      && arraysEqual(nextIntentionCompany, currentIntentionCompany)
    ) {
      continue;
    }

    const change = {
      userId: preference.userId,
      before: {
        intentionCity: currentIntentionCity,
        intentionJob: currentIntentionJob,
        intentionCompany: currentIntentionCompany,
      },
      after: {
        intentionCity: nextIntentionCity,
        intentionJob: nextIntentionJob,
        intentionCompany: nextIntentionCompany,
      },
    };
    preferenceChanges.push(change);

    if (apply) {
      await prisma.userJobPreferenceTag.update({
        where: { userId: preference.userId },
        data: change.after,
      });
    }
  }

  const modeLabel = apply ? 'apply' : 'dry-run';
  console.log(`[user-normalization-backfill] mode=${modeLabel}`);
  if (userIds.length) {
    console.log(`[user-normalization-backfill] scoped_user_ids=${userIds.join(',')}`);
  }
  console.log(`[user-normalization-backfill] profile_changes=${profileChanges.length}`);
  console.log(`[user-normalization-backfill] preference_changes=${preferenceChanges.length}`);

  if (profileChanges.length) {
    console.log('[user-normalization-backfill] profile_samples=', JSON.stringify(profileChanges.slice(0, 5), null, 2));
  }
  if (preferenceChanges.length) {
    console.log('[user-normalization-backfill] preference_samples=', JSON.stringify(preferenceChanges.slice(0, 5), null, 2));
  }

  if (apply && (profileChanges.length || preferenceChanges.length)) {
    console.log('[user-normalization-backfill] 已写回数据库。请在执行后重启 API 进程，确保进程内推荐缓存与标准化缓存完全刷新。');
  }
}

main()
  .catch((error) => {
    console.error('[user-normalization-backfill] 执行失败');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
