'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { KeywordSuggestionDropdown, useKeywordSuggestions } from '@/components/common/keyword-suggestion-dropdown';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { clientFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { showToast } from '@/store/toast-store';
import type {
  JobSearchSuggestionItem,
  PersonalNormalizedProfileSummary,
  PersonalOverview,
  PersonalPreferenceSummary,
  PersonalProfileSummary,
} from '@/types';

type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type PreferenceKey = keyof PersonalPreferenceSummary;
type ProfileUpdateResponse = PersonalProfileSummary & { userId?: string };
type PreferenceUpdateResponse = PersonalPreferenceSummary & {
  normalizedPreference?: PersonalPreferenceSummary | null;
};

type ProfileFormState = {
  name: string;
  schoolName: string;
  major: string;
  graduationYear: string;
  degree: string;
};

type PersistOptions = {
  commitDraft?: boolean;
  saveProfile?: boolean;
  savePreference?: boolean;
  preferenceOverride?: PersonalPreferenceSummary;
  tagInputOverride?: Record<PreferenceKey, string>;
};

type PersistResult = {
  saved: boolean;
  profileForm: ProfileFormState;
  preferenceForm: PersonalPreferenceSummary;
};

const STEP_TITLES: Record<StepId, string> = {
  1: '真实姓名',
  2: '求职意向',
  3: '意向岗位',
  4: '目标公司',
  5: '毕业学校',
  6: '所学专业',
  7: '毕业届别',
  8: '学历层次',
};

const STEP_HINTS: Record<StepId, string> = {
  1: '填写后，系统会更准确地识别你的基础求职资料。',
  2: '支持手动填写或一键推荐填充，推荐内容也可随时修改或删除。',
  3: '最多 5 个，支持模糊匹配；失去焦点或点击按钮时自动保存。',
  4: '最多 5 个，支持模糊匹配；失去焦点或点击按钮时自动保存。',
  5: '填写后失去焦点会自动保存，也可以点击按钮统一保存。',
  6: '填写后失去焦点会自动保存，也可以点击按钮统一保存。',
  7: '固定为「YY届」，范围为当前年份前后 5 年，不支持手动输入。',
  8: '固定选项，不支持手动输入，点击保存即可关闭弹窗。',
};

const ALL_STEPS: StepId[] = [1, 2, 3, 4, 5, 6, 7, 8];
const DISPLAY_STEPS: StepId[] = [1, 2, 5, 6, 7, 8];
const DEGREE_OPTIONS = ['大专', '本科', '硕士', '博士'] as const;
const RECOMMENDED_PREFERENCE_VALUES: Record<PreferenceKey, string[]> = {
  intentionCity: ['北京', '上海', '深圳', '杭州', '成都'],
  intentionJob: ['运营', '策划', '业务', '管培生', '职能'],
  intentionCompany: ['字节', '腾讯', '美团', '银行', '京东'],
};
const CORE_PREFERENCE_FIELDS: Array<{
  key: PreferenceKey;
  label: string;
  placeholder: string;
}> = [
  { key: 'intentionCity', label: '求职城市', placeholder: '输入求职城市关键词，如：北京、上海' },
  { key: 'intentionJob', label: '意向岗位', placeholder: '输入意向岗位关键词，如：开发、运营' },
  { key: 'intentionCompany', label: '目标公司', placeholder: '输入目标公司关键词' },
];

function toDisplayDegree(value?: string | null) {
  if (value === '专科') {
    return '大专';
  }
  return value?.trim() || '';
}

function buildProfileForm(
  profile?: PersonalProfileSummary | null,
  normalizedProfile?: PersonalNormalizedProfileSummary | null,
): ProfileFormState {
  return {
    name: profile?.name?.trim() || '',
    schoolName: profile?.schoolName?.trim() || '',
    major: normalizedProfile?.major?.trim() || profile?.major?.trim() || '',
    graduationYear: profile?.graduationYear ? String(profile.graduationYear) : '',
    degree: toDisplayDegree(normalizedProfile?.degree || profile?.degree),
  };
}

function buildPreferenceForm(
  preference?: PersonalPreferenceSummary | null,
  normalizedPreference?: PersonalPreferenceSummary | null,
): PersonalPreferenceSummary {
  const sanitizeValues = (values?: string[] | null) => Array.from(new Set((values ?? []).map((item) => item.trim()).filter(Boolean)));
  const rawIntentionCity = sanitizeValues(preference?.intentionCity);
  const rawIntentionJob = sanitizeValues(preference?.intentionJob);
  const rawIntentionCompany = sanitizeValues(preference?.intentionCompany);
  const normalizedIntentionCity = sanitizeValues(normalizedPreference?.intentionCity);
  const normalizedIntentionJob = sanitizeValues(normalizedPreference?.intentionJob);
  const normalizedIntentionCompany = sanitizeValues(normalizedPreference?.intentionCompany);

  return {
    intentionCity: rawIntentionCity.length ? rawIntentionCity : normalizedIntentionCity,
    intentionJob: rawIntentionJob.length ? rawIntentionJob : normalizedIntentionJob,
    intentionCompany: rawIntentionCompany.length ? rawIntentionCompany : normalizedIntentionCompany,
  };
}

function serializeProfileForm(form: ProfileFormState) {
  return JSON.stringify(form);
}

function serializePreferenceForm(form: PersonalPreferenceSummary) {
  return JSON.stringify(form);
}

function getStepCompleted(step: StepId, profileForm: ProfileFormState, preferenceForm: PersonalPreferenceSummary) {
  switch (step) {
    case 1:
      return Boolean(profileForm.name.trim());
    case 2:
      return hasCompletedPreference(preferenceForm.intentionCity);
    case 3:
      return hasCompletedPreference(preferenceForm.intentionJob);
    case 4:
      return hasCompletedPreference(preferenceForm.intentionCompany);
    case 5:
      return Boolean(profileForm.schoolName.trim());
    case 6:
      return Boolean(profileForm.major.trim());
    case 7:
      return Boolean(profileForm.graduationYear);
    case 8:
      return Boolean(profileForm.degree);
    default:
      return false;
  }
}

function hasCompletedPreference(values: string[]) {
  return values.some((item) => Boolean(item.trim()));
}

function getIncompleteSteps(profileForm: ProfileFormState, preferenceForm: PersonalPreferenceSummary) {
  const incompleteCorePreference = ([2, 3, 4] as StepId[]).some((step) => !getStepCompleted(step, profileForm, preferenceForm));
  return DISPLAY_STEPS.filter((step) => {
    if (step === 2) {
      return incompleteCorePreference;
    }
    return !getStepCompleted(step, profileForm, preferenceForm);
  });
}

function getGraduationOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 11 }, (_, index) => {
    const year = currentYear + 5 - index;
    return {
      value: String(year),
      label: `${String(year).slice(-2)}届`,
    };
  });
}

export function ProfileOnboardingModal({ token }: { token: string | null }) {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [pendingSteps, setPendingSteps] = useState<StepId[]>(ALL_STEPS);
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    name: '',
    schoolName: '',
    major: '',
    graduationYear: '',
    degree: '',
  });
  const [preferenceForm, setPreferenceForm] = useState<PersonalPreferenceSummary>({
    intentionCity: [],
    intentionJob: [],
    intentionCompany: [],
  });
  const [tagInput, setTagInput] = useState<Record<PreferenceKey, string>>({
    intentionCity: '',
    intentionJob: '',
    intentionCompany: '',
  });
  const [activeSuggestionField, setActiveSuggestionField] = useState<PreferenceKey | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const [lastSavedProfile, setLastSavedProfile] = useState('');
  const [lastSavedPreference, setLastSavedPreference] = useState('');

  const graduationOptions = useMemo(() => getGraduationOptions(), []);
  const completedStepsCount = useMemo(
    () => ALL_STEPS.filter((step) => getStepCompleted(step, profileForm, preferenceForm)).length,
    [profileForm, preferenceForm],
  );
  const currentStepQueueIndex = pendingSteps.indexOf(currentStep);
  const isLastPendingStep = pendingSteps.length > 0 && currentStepQueueIndex === pendingSteps.length - 1;
  const firstIncompleteCoreField: PreferenceKey = !hasCompletedPreference(preferenceForm.intentionCity)
    ? 'intentionCity'
    : !hasCompletedPreference(preferenceForm.intentionJob)
      ? 'intentionJob'
      : !hasCompletedPreference(preferenceForm.intentionCompany)
        ? 'intentionCompany'
        : 'intentionCity';
  const citySuggestions = useKeywordSuggestions({
    keyword: tagInput.intentionCity,
    field: 'location',
    token,
    enabled: visible && activeSuggestionField === 'intentionCity',
  });
  const jobSuggestions = useKeywordSuggestions({
    keyword: tagInput.intentionJob,
    field: 'job',
    token,
    enabled: visible && activeSuggestionField === 'intentionJob',
  });
  const companySuggestions = useKeywordSuggestions({
    keyword: tagInput.intentionCompany,
    field: 'company',
    token,
    enabled: visible && activeSuggestionField === 'intentionCompany',
  });

  useEffect(() => {
    if (!token) {
      setVisible(false);
      setCurrentStep(1);
      setPendingSteps(ALL_STEPS);
      setLastSavedProfile('');
      setLastSavedPreference('');
      return;
    }

    let cancelled = false;
    setLoadingOverview(true);

    clientFetch<PersonalOverview>('/me/overview', {}, token)
      .then((overview) => {
        if (cancelled) {
          return;
        }

        const nextProfile = buildProfileForm(overview.profile, overview.normalizedProfile);
        const nextPreference = buildPreferenceForm(overview.preference, overview.normalizedPreference);
        const nextPendingSteps = getIncompleteSteps(nextProfile, nextPreference);
        const shouldShowModal = overview.profileOnboardingRequired && nextPendingSteps.length > 0;
        setProfileForm(nextProfile);
        setPreferenceForm(nextPreference);
        setPendingSteps(nextPendingSteps);
        setCurrentStep(nextPendingSteps[0] ?? 1);
        setVisible(shouldShowModal);
        if (!shouldShowModal) {
          setActiveSuggestionField(null);
        }
        setLastSavedProfile(serializeProfileForm(nextProfile));
        setLastSavedPreference(serializePreferenceForm(nextPreference));
      })
      .catch((error) => {
        if (!cancelled) {
          showToast(error instanceof Error ? error.message : '资料完善弹窗初始化失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOverview(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const commitTagDraft = (
    key: PreferenceKey,
    sourcePreference = preferenceForm,
    sourceTagInput = tagInput,
  ) => {
    const draft = sourceTagInput[key].trim();
    if (!draft) {
      return { nextPreference: sourcePreference, nextTagInput: sourceTagInput };
    }

    const currentList = sourcePreference[key];
    if (currentList.includes(draft)) {
      return {
        nextPreference: sourcePreference,
        nextTagInput: { ...sourceTagInput, [key]: '' },
      };
    }
    if (currentList.length >= 5) {
      showToast('最多添加 5 个关键词');
      return { nextPreference: sourcePreference, nextTagInput: sourceTagInput };
    }

    return {
      nextPreference: { ...sourcePreference, [key]: [...currentList, draft] },
      nextTagInput: { ...sourceTagInput, [key]: '' },
    };
  };

  const persistForms = async (options?: PersistOptions): Promise<PersistResult> => {
    if (!token) {
      return { saved: true, profileForm, preferenceForm };
    }

    const commitDraft = Boolean(options?.commitDraft);
    let nextPreference = options?.preferenceOverride ?? preferenceForm;
    let nextTagInput = options?.tagInputOverride ?? tagInput;

    if (commitDraft && currentStep === 2) {
      for (const { key } of CORE_PREFERENCE_FIELDS) {
        const committed = commitTagDraft(key, nextPreference, nextTagInput);
        nextPreference = committed.nextPreference;
        nextTagInput = committed.nextTagInput;
      }
    }

    if (nextPreference !== preferenceForm) {
      setPreferenceForm(nextPreference);
    }
    if (nextTagInput !== tagInput) {
      setTagInput(nextTagInput);
    }

    const shouldSaveProfile = options?.saveProfile ?? true;
    const shouldSavePreference = options?.savePreference ?? true;
    const nextProfileSnapshot = serializeProfileForm(profileForm);
    const nextPreferenceSnapshot = serializePreferenceForm(nextPreference);
    const profileChanged = shouldSaveProfile && nextProfileSnapshot !== lastSavedProfile;
    const preferenceChanged = shouldSavePreference && nextPreferenceSnapshot !== lastSavedPreference;

    if (!profileChanged && !preferenceChanged) {
      return {
        saved: true,
        profileForm,
        preferenceForm: nextPreference,
      };
    }

    try {
      setPersisting(true);
      let nextResolvedProfile = profileForm;
      let nextResolvedPreference = nextPreference;
      if (profileChanged) {
        const savedProfile = await clientFetch<ProfileUpdateResponse>(
          '/me/profile',
          {
            method: 'PUT',
            body: JSON.stringify({
              name: profileForm.name.trim() || null,
              schoolName: profileForm.schoolName.trim() || null,
              major: profileForm.major.trim() || null,
              graduationYear: profileForm.graduationYear ? Number(profileForm.graduationYear) : null,
              degree: profileForm.degree || null,
            }),
          },
          token,
        );
        const normalizedProfileForm = buildProfileForm(savedProfile, {
          degree: savedProfile.degree,
          major: savedProfile.major,
        });
        setProfileForm(normalizedProfileForm);
        setLastSavedProfile(serializeProfileForm(normalizedProfileForm));
        nextResolvedProfile = normalizedProfileForm;
      }

      if (preferenceChanged) {
        const savedPreference = await clientFetch<PreferenceUpdateResponse>(
          '/me/preferences',
          {
            method: 'PUT',
            body: JSON.stringify(nextPreference),
          },
          token,
        );
        const normalizedPreferenceForm = buildPreferenceForm(savedPreference, savedPreference.normalizedPreference);
        setPreferenceForm(normalizedPreferenceForm);
        setLastSavedPreference(serializePreferenceForm(normalizedPreferenceForm));
        nextResolvedPreference = normalizedPreferenceForm;
      }
      return {
        saved: true,
        profileForm: nextResolvedProfile,
        preferenceForm: nextResolvedPreference,
      };
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败，请稍后重试');
      return {
        saved: false,
        profileForm,
        preferenceForm: nextPreference,
      };
    } finally {
      setPersisting(false);
    }
  };

  const addTag = (key: PreferenceKey, preferredValue?: string) => {
    const value = (preferredValue ?? tagInput[key]).trim();
    if (!value) {
      return;
    }

    const list = preferenceForm[key];
    if (list.length >= 5) {
      showToast('最多添加 5 个关键词');
      return;
    }
    if (list.includes(value)) {
      setTagInput((prev) => ({ ...prev, [key]: '' }));
      showToast('该关键词已存在');
      return;
    }

    setPreferenceForm((prev) => ({ ...prev, [key]: [...prev[key], value] }));
    setTagInput((prev) => ({ ...prev, [key]: '' }));
    setActiveSuggestionField(null);
  };

  const removeTag = (key: PreferenceKey, value: string) => {
    setPreferenceForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((item) => item !== value),
    }));
  };

  const applySuggestion = (key: PreferenceKey, item: JobSearchSuggestionItem) => {
    addTag(key, item.value);
  };

  const applyRecommendedFill = () => {
    setPreferenceForm((prev) => {
      return {
        ...prev,
        intentionCity: hasCompletedPreference(prev.intentionCity)
          ? prev.intentionCity
          : [...RECOMMENDED_PREFERENCE_VALUES.intentionCity],
        intentionJob: hasCompletedPreference(prev.intentionJob)
          ? prev.intentionJob
          : [...RECOMMENDED_PREFERENCE_VALUES.intentionJob],
        intentionCompany: hasCompletedPreference(prev.intentionCompany)
          ? prev.intentionCompany
          : [...RECOMMENDED_PREFERENCE_VALUES.intentionCompany],
      };
    });
    setTagInput((prev) => ({
      ...prev,
      intentionCity: '',
      intentionJob: '',
      intentionCompany: '',
    }));
    setActiveSuggestionField(null);
  };

  const validateStep = (step: StepId) => {
    if (step === 1 && !profileForm.name.trim()) {
      showToast('请先填写姓名');
      return false;
    }
    if (step === 2) {
      const missingFields = CORE_PREFERENCE_FIELDS
        .filter(({ key }) => !hasCompletedPreference(preferenceForm[key]))
        .map(({ label }) => label);
      if (missingFields.length > 0) {
        showToast(`请先补充${missingFields.join('、')}`);
        return false;
      }
    }
    if (step === 5 && !profileForm.schoolName.trim()) {
      showToast('请先填写毕业学校');
      return false;
    }
    if (step === 6 && !profileForm.major.trim()) {
      showToast('请先填写所学专业');
      return false;
    }
    if (step === 7 && !profileForm.graduationYear) {
      showToast('请选择毕业届别');
      return false;
    }
    if (step === 8 && !profileForm.degree) {
      showToast('请选择学历层次');
      return false;
    }
    return true;
  };

  const resolvePendingNavigation = (
    nextProfileForm: ProfileFormState,
    nextPreferenceForm: PersonalPreferenceSummary,
    direction: 'previous' | 'next',
  ) => {
    const nextPending = getIncompleteSteps(nextProfileForm, nextPreferenceForm);
    setPendingSteps(nextPending);

    if (!nextPending.length) {
      setVisible(false);
      setActiveSuggestionField(null);
      return;
    }

    const referenceSteps = direction === 'previous'
      ? pendingSteps.slice(0, Math.max(0, currentStepQueueIndex)).reverse()
      : pendingSteps.slice(currentStepQueueIndex + 1);
    const nextStep = referenceSteps.find((step) => nextPending.includes(step))
      ?? (nextPending.includes(currentStep) ? currentStep : nextPending[0]);
    setCurrentStep(nextStep);
  };

  const goPrevious = async () => {
    const result = await persistForms({ commitDraft: true });
    if (!result.saved) {
      return;
    }
    resolvePendingNavigation(result.profileForm, result.preferenceForm, 'previous');
  };

  const goNext = async () => {
    if (!validateStep(currentStep)) {
      return;
    }
    const result = await persistForms({ commitDraft: true });
    if (!result.saved) {
      return;
    }
    resolvePendingNavigation(result.profileForm, result.preferenceForm, 'next');
  };

  const handleClose = async () => {
    const result = await persistForms({ commitDraft: true });
    if (!result.saved) {
      return;
    }
    setPendingSteps(getIncompleteSteps(result.profileForm, result.preferenceForm));
    setVisible(false);
    setActiveSuggestionField(null);
  };

  const handleSave = async () => {
    if (!validateStep(currentStep)) {
      return;
    }
    const result = await persistForms({ commitDraft: true });
    if (!result.saved) {
      return;
    }
    setPendingSteps(getIncompleteSteps(result.profileForm, result.preferenceForm));
    setVisible(false);
    setActiveSuggestionField(null);
    showToast('资料已保存', 'success');
  };

  const handleProfileBlur = async () => {
    await persistForms({ savePreference: false });
  };

  const handlePreferenceBlur = async () => {
    window.setTimeout(() => {
      void persistForms({ commitDraft: true, saveProfile: false, savePreference: true });
      setActiveSuggestionField(null);
    }, 120);
  };

  if (!token || (!visible && !loadingOverview)) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-[1px]">
      <Card className="w-full max-w-2xl overflow-hidden p-0 shadow-2xl">
        <div className="border-b border-slate-100 bg-white px-6 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-brand">求职画像补充</p>
              <h2 className="mt-2 text-2xl font-bold text-ink">补一项，推荐就更准一点</h2>
            </div>
            <button
              type="button"
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-full border transition',
                'border-slate-200 text-slate-500 hover:border-brand hover:text-brand',
              )}
              onClick={() => void handleClose()}
              disabled={persisting}
              aria-label="关闭资料完善弹窗"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${Math.max((completedStepsCount / ALL_STEPS.length) * 100, 8)}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-6 sm:px-7">
          <Card className="p-6">
            <div className="min-h-[320px]">
              <div className="mb-6">
                <p className="text-sm font-semibold text-brand">{STEP_TITLES[currentStep]}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{STEP_HINTS[currentStep]}</p>
              </div>

              {currentStep === 1 ? (
                <Input
                  autoFocus
                  placeholder="请输入你的真实姓名"
                  value={profileForm.name}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                  onBlur={() => void handleProfileBlur()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void goNext();
                    }
                  }}
                />
              ) : null}

              {currentStep === 2 ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-brand">高上岸推荐填写</p>
                        <p className="mt-1 text-xs text-slate-500">自动补齐当前空白的求职城市、意向岗位、目标公司</p>
                      </div>
                      <Button type="button" variant="secondary" className="border-brand/20 text-brand hover:bg-brand/10 hover:text-brand" onClick={applyRecommendedFill}>
                        高上岸推荐填写
                      </Button>
                    </div>
                  </div>

                  {CORE_PREFERENCE_FIELDS.map(({ key, label, placeholder }) => {
                    const suggestions = key === 'intentionCity'
                      ? citySuggestions
                      : key === 'intentionJob'
                        ? jobSuggestions
                        : companySuggestions;

                    return (
                      <div key={key} className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-ink">{label}</p>
                          <p className="text-xs text-slate-400">最多 5 个</p>
                        </div>
                        <div className="relative">
                          <Input
                            autoFocus={firstIncompleteCoreField === key}
                            value={tagInput[key]}
                            placeholder={placeholder}
                            onChange={(event) => setTagInput((prev) => ({ ...prev, [key]: event.target.value }))}
                            onFocus={() => setActiveSuggestionField(key)}
                            onBlur={() => void handlePreferenceBlur()}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                addTag(key);
                              }
                            }}
                          />
                          <KeywordSuggestionDropdown
                            visible={activeSuggestionField === key && Boolean(tagInput[key].trim())}
                            loading={suggestions.loading}
                            suggestions={suggestions.suggestions}
                            onSelect={(item) => applySuggestion(key, item)}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {preferenceForm[key].map((item) => (
                            <button
                              key={item}
                              type="button"
                              className="rounded-full bg-slate-100 px-3 py-1 text-sm text-ink transition hover:bg-brand/10 hover:text-brand"
                              onClick={() => void removeTag(key, item)}
                            >
                              {item} ×
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {currentStep === 5 ? (
                <Input
                  autoFocus
                  placeholder="请输入毕业学校"
                  value={profileForm.schoolName}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, schoolName: event.target.value }))}
                  onBlur={() => void handleProfileBlur()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void goNext();
                    }
                  }}
                />
              ) : null}

              {currentStep === 6 ? (
                <Input
                  autoFocus
                  placeholder="请输入所学专业"
                  value={profileForm.major}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, major: event.target.value }))}
                  onBlur={() => void handleProfileBlur()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void goNext();
                    }
                  }}
                />
              ) : null}

              {currentStep === 7 ? (
                <Select
                  autoFocus
                  value={profileForm.graduationYear}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, graduationYear: event.target.value }))}
                  onBlur={() => void handleProfileBlur()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void goNext();
                    }
                  }}
                >
                  <option value="">请选择毕业届别</option>
                  {graduationOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              ) : null}

              {currentStep === 8 ? (
                <Select
                  autoFocus
                  value={profileForm.degree}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, degree: event.target.value }))}
                  onBlur={() => void handleProfileBlur()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleSave();
                    }
                  }}
                >
                  <option value="">请选择学历层次</option>
                  {DEGREE_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              ) : null}
            </div>
          </Card>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white px-6 py-4">
            <div className="text-sm text-muted">
              {loadingOverview ? '资料加载中...' : persisting ? '正在保存...' : '失去焦点或点击按钮时会自动保存'}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => void goPrevious()}
                disabled={currentStepQueueIndex <= 0 || persisting}
              >
                上一步
              </Button>

              {!isLastPendingStep ? (
                <Button onClick={() => void goNext()} disabled={persisting}>
                  下一步
                </Button>
              ) : (
                <Button onClick={() => void handleSave()} disabled={persisting}>
                  保存
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
