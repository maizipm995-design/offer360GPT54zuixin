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

const STEP_TITLES: Record<StepId, string> = {
  1: '真实姓名',
  2: '求职城市',
  3: '意向岗位',
  4: '目标公司',
  5: '毕业学校',
  6: '所学专业',
  7: '毕业届别',
  8: '学历层次',
};

const STEP_HINTS: Record<StepId, string> = {
  1: '填写后，系统会更准确地识别你的基础求职资料。',
  2: '最多 5 个，支持模糊匹配；失去焦点或点击按钮时自动保存。',
  3: '最多 5 个，支持模糊匹配；失去焦点或点击按钮时自动保存。',
  4: '最多 5 个，支持模糊匹配；失去焦点或点击按钮时自动保存。',
  5: '填写后失去焦点会自动保存，也可以点击按钮统一保存。',
  6: '填写后失去焦点会自动保存，也可以点击按钮统一保存。',
  7: '固定为「YY届」，范围为当前年份前后 5 年，不支持手动输入。',
  8: '固定选项，不支持手动输入，点击保存即可关闭弹窗。',
};

const REQUIRED_STEPS: StepId[] = [1, 5, 6, 7, 8];
const DEGREE_OPTIONS = ['大专', '本科', '硕士', '博士'] as const;

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
  return {
    intentionCity: preference?.intentionCity ?? normalizedPreference?.intentionCity ?? [],
    intentionJob: preference?.intentionJob ?? normalizedPreference?.intentionJob ?? [],
    intentionCompany: preference?.intentionCompany ?? normalizedPreference?.intentionCompany ?? [],
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
      return preferenceForm.intentionCity.length > 0;
    case 3:
      return preferenceForm.intentionJob.length > 0;
    case 4:
      return preferenceForm.intentionCompany.length > 0;
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

function resolveInitialStep(profileForm: ProfileFormState, preferenceForm: PersonalPreferenceSummary): StepId {
  if (!profileForm.name.trim()) {
    return 1;
  }
  if (!preferenceForm.intentionCity.length) {
    return 2;
  }
  if (!preferenceForm.intentionJob.length) {
    return 3;
  }
  if (!preferenceForm.intentionCompany.length) {
    return 4;
  }
  if (!profileForm.schoolName.trim()) {
    return 5;
  }
  if (!profileForm.major.trim()) {
    return 6;
  }
  if (!profileForm.graduationYear) {
    return 7;
  }
  return 8;
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
  const canClose = REQUIRED_STEPS.some((step) => getStepCompleted(step, profileForm, preferenceForm));
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
      setLastSavedProfile('');
      setLastSavedPreference('');
      return;
    }

    let cancelled = false;
    setLoadingOverview(true);

    clientFetch<PersonalOverview>('/me/overview', {}, token)
      .then((overview) => {
        if (cancelled || !overview.profileOnboardingRequired) {
          return;
        }

        const nextProfile = buildProfileForm(overview.profile, overview.normalizedProfile);
        const nextPreference = buildPreferenceForm(overview.preference, overview.normalizedPreference);
        setProfileForm(nextProfile);
        setPreferenceForm(nextPreference);
        setCurrentStep(resolveInitialStep(nextProfile, nextPreference));
        setVisible(true);
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

  const persistForms = async (options?: PersistOptions) => {
    if (!token) {
      return true;
    }

    const commitDraft = Boolean(options?.commitDraft);
    let nextPreference = options?.preferenceOverride ?? preferenceForm;
    let nextTagInput = options?.tagInputOverride ?? tagInput;

    if (commitDraft && currentStep >= 2 && currentStep <= 4) {
      const key = currentStep === 2 ? 'intentionCity' : currentStep === 3 ? 'intentionJob' : 'intentionCompany';
      const committed = commitTagDraft(key, nextPreference, nextTagInput);
      nextPreference = committed.nextPreference;
      nextTagInput = committed.nextTagInput;
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
      return true;
    }

    try {
      setPersisting(true);
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
      }
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败，请稍后重试');
      return false;
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

  const removeTag = async (key: PreferenceKey, value: string) => {
    const nextPreference = {
      ...preferenceForm,
      [key]: preferenceForm[key].filter((item) => item !== value),
    };
    setPreferenceForm(nextPreference);
    await persistForms({
      saveProfile: false,
      savePreference: true,
      preferenceOverride: nextPreference,
    });
  };

  const applySuggestion = (key: PreferenceKey, item: JobSearchSuggestionItem) => {
    addTag(key, item.value);
  };

  const validateStep = (step: StepId) => {
    if (step === 1 && !profileForm.name.trim()) {
      showToast('请先填写姓名');
      return false;
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

  const goPrevious = async () => {
    const saved = await persistForms({ commitDraft: true });
    if (!saved) {
      return;
    }
    setCurrentStep((current) => (Math.max(1, current - 1) as StepId));
  };

  const goNext = async () => {
    if (!validateStep(currentStep)) {
      return;
    }
    const saved = await persistForms({ commitDraft: true });
    if (!saved || currentStep >= 8) {
      return;
    }
    setCurrentStep((current) => (current + 1) as StepId);
  };

  const handleClose = async () => {
    if (!canClose) {
      showToast('至少完成 1 个必填项后才能关闭');
      return;
    }
    const saved = await persistForms({ commitDraft: true });
    if (!saved) {
      return;
    }
    setVisible(false);
    setActiveSuggestionField(null);
  };

  const handleSave = async () => {
    if (!validateStep(currentStep)) {
      return;
    }
    const saved = await persistForms({ commitDraft: true });
    if (!saved) {
      return;
    }
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
                canClose ? 'border-slate-200 text-slate-500 hover:border-brand hover:text-brand' : 'cursor-not-allowed border-slate-100 text-slate-300',
              )}
              onClick={() => void handleClose()}
              disabled={!canClose || persisting}
              aria-label="关闭资料完善弹窗"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${(currentStep / 8) * 100}%` }}
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
                  <div className="relative">
                    <Input
                      autoFocus
                      value={tagInput.intentionCity}
                      placeholder="输入求职城市关键词，如：北京、上海"
                      onChange={(event) => setTagInput((prev) => ({ ...prev, intentionCity: event.target.value }))}
                      onFocus={() => setActiveSuggestionField('intentionCity')}
                      onBlur={() => void handlePreferenceBlur()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addTag('intentionCity');
                        }
                      }}
                    />
                    <KeywordSuggestionDropdown
                      visible={activeSuggestionField === 'intentionCity' && Boolean(tagInput.intentionCity.trim())}
                      loading={citySuggestions.loading}
                      suggestions={citySuggestions.suggestions}
                      onSelect={(item) => applySuggestion('intentionCity', item)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {preferenceForm.intentionCity.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm text-ink transition hover:bg-brand/10 hover:text-brand"
                        onClick={() => void removeTag('intentionCity', item)}
                      >
                        {item} ×
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {currentStep === 3 ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Input
                      autoFocus
                      value={tagInput.intentionJob}
                      placeholder="输入意向岗位关键词，如：开发、运营"
                      onChange={(event) => setTagInput((prev) => ({ ...prev, intentionJob: event.target.value }))}
                      onFocus={() => setActiveSuggestionField('intentionJob')}
                      onBlur={() => void handlePreferenceBlur()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addTag('intentionJob');
                        }
                      }}
                    />
                    <KeywordSuggestionDropdown
                      visible={activeSuggestionField === 'intentionJob' && Boolean(tagInput.intentionJob.trim())}
                      loading={jobSuggestions.loading}
                      suggestions={jobSuggestions.suggestions}
                      onSelect={(item) => applySuggestion('intentionJob', item)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {preferenceForm.intentionJob.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm text-ink transition hover:bg-brand/10 hover:text-brand"
                        onClick={() => void removeTag('intentionJob', item)}
                      >
                        {item} ×
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {currentStep === 4 ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Input
                      autoFocus
                      value={tagInput.intentionCompany}
                      placeholder="输入目标公司关键词"
                      onChange={(event) => setTagInput((prev) => ({ ...prev, intentionCompany: event.target.value }))}
                      onFocus={() => setActiveSuggestionField('intentionCompany')}
                      onBlur={() => void handlePreferenceBlur()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addTag('intentionCompany');
                        }
                      }}
                    />
                    <KeywordSuggestionDropdown
                      visible={activeSuggestionField === 'intentionCompany' && Boolean(tagInput.intentionCompany.trim())}
                      loading={companySuggestions.loading}
                      suggestions={companySuggestions.suggestions}
                      onSelect={(item) => applySuggestion('intentionCompany', item)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {preferenceForm.intentionCompany.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm text-ink transition hover:bg-brand/10 hover:text-brand"
                        onClick={() => void removeTag('intentionCompany', item)}
                      >
                        {item} ×
                      </button>
                    ))}
                  </div>
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
                disabled={currentStep === 1 || persisting}
              >
                上一步
              </Button>

              {currentStep < 8 ? (
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
