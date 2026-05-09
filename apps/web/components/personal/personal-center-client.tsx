'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEGREE_OPTIONS } from '@offer360/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { clientFetch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useGlobalToast } from '@/store/toast-store';
import {
  PersonalNormalizedProfileSummary,
  PersonalOrderItem,
  PersonalOverview,
  PersonalPreferenceSummary,
  PersonalProfileSummary,
} from '@/types';

interface InvitationData {
  inviteCode: string;
  shareText: string;
  rules: string[];
  stats: {
    inviteCount: number;
    nextMilestone: number;
    rewardedTimes: number;
    distanceToNext: number;
    wallet?: { availableBalance: number; totalEarn: number } | null;
  };
  progress: { current: number; target: number; text: string };
  records: Array<{ id: string; registerTime: string; rewardStatus: string; maskedPhone: string }>;
}

const sections = [
  { id: 'membership', label: '会员权益' },
  { id: 'profile', label: '个人信息' },
  { id: 'preference', label: '求职意向' },
  { id: 'invitation', label: '我的邀请' },
  { id: 'orders', label: '我的订单' },
] as const;

type ProfileFormState = {
  name: string;
  graduationYear: string;
  degree: string;
  schoolName: string;
  major: string;
};

type PreferenceFormState = PersonalPreferenceSummary;
type PreferenceKey = keyof PreferenceFormState;
type PersonalAuthCodeBusiness = 'reset_password' | 'update_phone';
type ProfileUpdateResponse = PersonalProfileSummary & { userId?: string };
type PreferenceUpdateResponse = PersonalPreferenceSummary & {
  normalizedPreference?: PersonalPreferenceSummary | null;
};
type SendAuthCodeResult = {
  business: PersonalAuthCodeBusiness;
  businessLabel: string;
  phone: string;
  expiresAt: string;
  reused: boolean;
  sent: boolean;
  cooldownSeconds: number;
};
type UpdatePhoneResponse = { id: string; phone: string };

const defaultProfileForm: ProfileFormState = {
  name: '',
  graduationYear: '2026',
  degree: '本科',
  schoolName: '',
  major: '',
};

const defaultPreferenceForm: PreferenceFormState = {
  intentionCity: [],
  intentionJob: [],
  intentionCompany: [],
};

function buildProfileForm(
  profile?: PersonalProfileSummary | null,
  normalizedProfile?: PersonalNormalizedProfileSummary | null,
): ProfileFormState {
  return {
    name: profile?.name || '',
    graduationYear: String(profile?.graduationYear || 2026),
    degree: normalizedProfile?.degree ?? profile?.degree ?? '本科',
    schoolName: profile?.schoolName || '',
    major: normalizedProfile?.major ?? profile?.major ?? '',
  };
}

function buildPreferenceForm(
  preference?: PersonalPreferenceSummary | null,
  normalizedPreference?: PersonalPreferenceSummary | null,
): PreferenceFormState {
  return {
    intentionCity: normalizedPreference?.intentionCity ?? preference?.intentionCity ?? [],
    intentionJob: normalizedPreference?.intentionJob ?? preference?.intentionJob ?? [],
    intentionCompany: normalizedPreference?.intentionCompany ?? preference?.intentionCompany ?? [],
  };
}

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function hasCanonicalizedPreference(submitted: PreferenceFormState, saved: PreferenceFormState) {
  return (Object.keys(saved) as PreferenceKey[]).some((key) => !areStringArraysEqual(submitted[key], saved[key]));
}

function isValidPhone(phone: string) {
  return /^1\d{10}$/.test(phone.trim());
}

export function PersonalCenterClient() {
  const router = useRouter();
  const { token, user, updateUser } = useAuthStore();
  const [overview, setOverview] = useState<PersonalOverview | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [orders, setOrders] = useState<PersonalOrderItem[]>([]);
  const [activeOrderGuide, setActiveOrderGuide] = useState<PersonalOrderItem | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [phoneSendingCode, setPhoneSendingCode] = useState(false);
  const [passwordSendingCode, setPasswordSendingCode] = useState(false);
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const [passwordCountdown, setPasswordCountdown] = useState(0);
  const [phoneForm, setPhoneForm] = useState({ phone: '', code: '' });
  const [passwordForm, setPasswordForm] = useState({ phone: '', code: '', newPassword: '' });
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(defaultProfileForm);
  const [preferenceForm, setPreferenceForm] = useState<PreferenceFormState>(defaultPreferenceForm);
  const [tagInput, setTagInput] = useState<Record<PreferenceKey, string>>({ intentionCity: '', intentionJob: '', intentionCompany: '' });
  const refs = {
    membership: useRef<HTMLDivElement | null>(null),
    profile: useRef<HTMLDivElement | null>(null),
    preference: useRef<HTMLDivElement | null>(null),
    invitation: useRef<HTMLDivElement | null>(null),
    orders: useRef<HTMLDivElement | null>(null),
  };
  const [activeSection, setActiveSection] = useState('membership');

  useGlobalToast(message, setMessage);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      clientFetch<PersonalOverview>('/me/overview', {}, token),
      clientFetch<InvitationData>('/me/invitations', {}, token),
      clientFetch<PersonalOrderItem[]>('/me/orders', {}, token),
    ])
      .then(([overviewData, invitationData, orderData]) => {
        setOverview(overviewData);
        setInvitation(invitationData);
        setOrders(orderData);
        setProfileForm(buildProfileForm(overviewData.profile, overviewData.normalizedProfile));
        setPreferenceForm(buildPreferenceForm(overviewData.preference, overviewData.normalizedPreference));
        setPhoneForm({ phone: '', code: '' });
        setPasswordForm({ phone: overviewData.phone, code: '', newPassword: '' });
        updateUser({
          phone: overviewData.phone,
          name: overviewData.profile?.name || user?.name || '',
          isMember: overviewData.isMember,
          memberLevel: overviewData.memberLevel,
          memberLevelLabel: overviewData.memberLevelLabel,
          memberRoleCode: overviewData.memberRoleCode,
          memberRoleName: overviewData.memberRoleName,
          permissionKeys: overviewData.permissionKeys,
          membershipRemainingDays: overviewData.membershipRemainingDays,
        });
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : '个人中心加载失败'));
  }, [token, updateUser, user?.name]);

  useEffect(() => {
    const observers = sections.map((section) => {
      const el = refs[section.id].current;
      if (!el) return null;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setActiveSection(section.id);
          }
        },
        { threshold: 0.35 },
      );
      observer.observe(el);
      return observer;
    });
    return () => observers.forEach((observer) => observer?.disconnect());
  });

  useEffect(() => {
    if (phoneCountdown <= 0 && passwordCountdown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setPhoneCountdown((current) => (current > 0 ? current - 1 : 0));
      setPasswordCountdown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [phoneCountdown, passwordCountdown]);

  if (!token) {
    return (
      <main className="mx-auto max-w-[960px] px-4 py-10 lg:px-8">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-ink">请先登录后查看个人中心</h1>
          <Button className="mt-6" onClick={() => router.push('/login')}>前往登录</Button>
        </Card>
      </main>
    );
  }

  const saveProfile = async () => {
    try {
      setSaving(true);
      const savedProfile = await clientFetch<ProfileUpdateResponse>(
        '/me/profile',
        { method: 'PUT', body: JSON.stringify({ ...profileForm, graduationYear: Number(profileForm.graduationYear) }) },
        token,
      );
      const nextProfileForm = buildProfileForm(savedProfile, {
        degree: savedProfile.degree,
        major: savedProfile.major,
      });
      const wasCanonicalized = nextProfileForm.degree !== profileForm.degree || nextProfileForm.major !== profileForm.major;

      setProfileForm(nextProfileForm);
      setOverview((prev) => (prev
        ? {
            ...prev,
            profile: savedProfile,
            normalizedProfile: {
              degree: savedProfile.degree,
              major: savedProfile.major,
            },
          }
        : prev));
      updateUser({ name: savedProfile.name || user?.name || '' });
      setMessage(wasCanonicalized ? '个人信息已自动标准化并保存' : '个人信息已自动保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async (next = preferenceForm) => {
    try {
      const savedPreference = await clientFetch<PreferenceUpdateResponse>(
        '/me/preferences',
        { method: 'PUT', body: JSON.stringify(next) },
        token,
      );
      const nextPreferenceForm = buildPreferenceForm(savedPreference, savedPreference.normalizedPreference);
      const wasCanonicalized = hasCanonicalizedPreference(next, nextPreferenceForm);

      setPreferenceForm(nextPreferenceForm);
      setOverview((prev) => (prev
        ? {
            ...prev,
            preference: {
              intentionCity: savedPreference.intentionCity,
              intentionJob: savedPreference.intentionJob,
              intentionCompany: savedPreference.intentionCompany,
            },
            normalizedPreference: savedPreference.normalizedPreference ?? nextPreferenceForm,
          }
        : prev));
      setMessage(wasCanonicalized ? '求职意向已自动标准化并保存' : '求职意向已自动保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    }
  };

  const addTag = (key: PreferenceKey) => {
    const value = tagInput[key].trim();
    if (!value) return;
    const list = preferenceForm[key];
    if (list.length >= 5) {
      setMessage('最多添加 5 个标签');
      return;
    }
    if (list.includes(value)) {
      setMessage('该标签已存在，无需重复添加');
      return;
    }
    const next = { ...preferenceForm, [key]: [...list, value] };
    setPreferenceForm(next);
    setTagInput((prev) => ({ ...prev, [key]: '' }));
    void savePreferences(next);
  };

  const removeTag = (key: PreferenceKey, value: string) => {
    const next = { ...preferenceForm, [key]: preferenceForm[key].filter((item) => item !== value) };
    setPreferenceForm(next);
    void savePreferences(next);
  };

  const openPhoneModal = () => {
    setPhoneForm({ phone: '', code: '' });
    setPhoneCountdown(0);
    setShowPhoneModal(true);
  };

  const openPasswordModal = () => {
    const currentPhone = overview?.phone || user?.phone || '';
    setPasswordForm({ phone: currentPhone, code: '', newPassword: '' });
    setPasswordCountdown(0);
    setShowPasswordModal(true);
  };

  const sendPersonalCode = async (business: PersonalAuthCodeBusiness, targetPhone: string) => {
    return clientFetch<SendAuthCodeResult>(
      '/auth/send-code',
      {
        method: 'POST',
        body: JSON.stringify({ phone: targetPhone.trim(), business }),
      },
      token,
    );
  };

  const handleSendPhoneCode = async () => {
    if (!isValidPhone(phoneForm.phone)) {
      setMessage('请输入正确的新手机号');
      return;
    }

    try {
      setPhoneSendingCode(true);
      const result = await sendPersonalCode('update_phone', phoneForm.phone);
      setPhoneCountdown(result.cooldownSeconds || 60);
      setMessage('验证码已发送，请注意查收。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '验证码发送失败');
    } finally {
      setPhoneSendingCode(false);
    }
  };

  const handleSendPasswordCode = async () => {
    if (!isValidPhone(passwordForm.phone)) {
      setMessage('当前手机号异常，请刷新页面后重试');
      return;
    }

    try {
      setPasswordSendingCode(true);
      const result = await sendPersonalCode('reset_password', passwordForm.phone);
      setPasswordCountdown(result.cooldownSeconds || 60);
      setMessage('验证码已发送，请注意查收。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '验证码发送失败');
    } finally {
      setPasswordSendingCode(false);
    }
  };

  const updatePhone = async () => {
    const nextPhone = phoneForm.phone.trim();
    if (!isValidPhone(nextPhone)) {
      setMessage('请输入正确的新手机号');
      return;
    }
    if (nextPhone === (overview?.phone || '').trim()) {
      setMessage('新手机号不能与当前手机号相同');
      return;
    }
    if (phoneForm.code.trim().length < 4) {
      setMessage('请输入收到的验证码');
      return;
    }

    try {
      setPhoneSubmitting(true);
      const result = await clientFetch<UpdatePhoneResponse>('/me/phone', { method: 'PUT', body: JSON.stringify(phoneForm) }, token);
      setOverview((prev) => (prev ? { ...prev, phone: result.phone } : prev));
      setPhoneForm({ phone: '', code: '' });
      setPasswordForm({ phone: result.phone, code: '', newPassword: '' });
      updateUser({ phone: result.phone });
      setShowPhoneModal(false);
      setPhoneCountdown(0);
      setMessage('手机号修改成功');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '手机号修改失败');
    } finally {
      setPhoneSubmitting(false);
    }
  };

  const updatePassword = async () => {
    if (!isValidPhone(passwordForm.phone)) {
      setMessage('当前手机号异常，请刷新页面后重试');
      return;
    }
    if (passwordForm.code.trim().length < 4) {
      setMessage('请输入收到的验证码');
      return;
    }
    if (passwordForm.newPassword.trim().length < 8) {
      setMessage('新密码至少需要 8 位');
      return;
    }

    try {
      setPasswordSubmitting(true);
      await clientFetch('/me/password', { method: 'PUT', body: JSON.stringify(passwordForm) }, token);
      setShowPasswordModal(false);
      setPasswordCountdown(0);
      setPasswordForm((prev) => ({ ...prev, code: '', newPassword: '' }));
      setMessage('重置密码成功');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '重置密码失败');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const goToMembershipPage = () => {
    router.push('/membership');
  };

  const copyInvite = async () => {
    if (!invitation) return;
    await navigator.clipboard.writeText(invitation.shareText);
    setMessage('邀请文案已复制，快去分享给好友吧');
  };

  const getOrderStatusText = (order: PersonalOrderItem) => {
    if (order.payStatus === 'paid') return '已支付';
    if (order.payStatus === 'refund_pending') return '退款处理中';
    if (order.payStatus === 'closed') return '已关闭';
    if (order.payStatus === 'refunded') return '已退款';
    return '待支付';
  };

  const getOrderStatusClassName = (order: PersonalOrderItem) => {
    if (order.payStatus === 'paid') return 'text-brand';
    if (order.payStatus === 'refund_pending') return 'text-amber-600';
    if (order.payStatus === 'closed' || order.payStatus === 'refunded') return 'text-slate-500';
    return 'text-red-500';
  };

  const handleOrderEntryClick = (order: PersonalOrderItem) => {
    if (order.canContinuePay) {
      router.push(order.checkoutPath);
      return;
    }
    if (order.orderType === 'membership') {
      router.push(order.serviceEntryUrl);
      return;
    }
    setActiveOrderGuide(order);
  };

  const closeOrderGuide = () => {
    setActiveOrderGuide(null);
  };

  const activeOrderGuideText = activeOrderGuide?.orderServiceText?.trim() || (
    activeOrderGuide ? `${activeOrderGuide.productName} 已购买成功，我们会根据服务流程尽快与您联系，请留意站内通知或客服消息。` : ''
  );
  const activeOrderGuideImageUrl = activeOrderGuide?.orderServiceImageUrl?.trim() || '';

  return (
    <main className="mx-auto max-w-[1366px] px-4 py-8 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="h-fit p-4 lg:sticky lg:top-[84px]">
          {sections.map((section) => (
            <button
              key={section.id}
              className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-medium transition ${activeSection === section.id ? 'bg-brand text-white' : 'text-muted hover:bg-brand/10 hover:text-brand'}`}
              onClick={() => refs[section.id].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              {section.label}
            </button>
          ))}
        </Card>

        <div className="space-y-6">
          <Card ref={refs.membership} className="p-6" id="membership">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-ink">会员权益</h2>
                <p className="mt-1 text-sm text-muted">统一查看会员状态、剩余天数和核心权益入口。</p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
                  <span className="rounded-full bg-brand/10 px-3 py-1 text-brand">无限投递</span>
                  <span className="rounded-full bg-brand/10 px-3 py-1 text-brand">专属推荐</span>
                  <span className="rounded-full bg-brand/10 px-3 py-1 text-brand">内推资源</span>
                  <span className="rounded-full bg-brand/10 px-3 py-1 text-brand">求职资料包</span>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5 lg:min-w-[260px]">
                <p className="text-sm text-muted">当前状态</p>
                <p className="mt-2 text-2xl font-bold text-ink">{overview?.membership ? `${overview.memberLevelLabel} · 剩余 ${overview.membership.remainingDays} 天` : '未开通会员'}</p>
                <p className="mt-2 text-sm text-muted">
                  {overview?.membership ? `到期时间：${formatDate(overview.membership.endAt)}` : '开通后可在导航栏直接查看剩余天数'}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted">
                  点击下方按钮将前往会员开通详情页；需在开通页完成套餐选择与支付或兑换后，会员权益才会正式生效。
                </p>
                <Button className="mt-4 w-full" onClick={goToMembershipPage}>
                  {overview?.membership ? '前往续费会员' : '前往开通会员'}
                </Button>
              </div>
            </div>
          </Card>
          <Card ref={refs.profile} className="p-6" id="profile">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-ink">个人信息</h2>
                <p className="mt-1 text-sm text-muted">修改后将实时同步到岗位推荐算法。</p>
              </div>
              <p className="text-sm text-muted">{saving ? '自动保存中...' : '已开启自动保存'}</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">姓名</label>
                <Input value={profileForm.name} onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))} onBlur={saveProfile} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-ink">手机号</label>
                <div className="grid grid-cols-[minmax(0,1fr)_96px_96px] gap-2 sm:grid-cols-[minmax(0,1fr)_112px_112px] sm:gap-3">
                  <div className="flex h-11 min-w-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-ink">
                    <span className="truncate">{overview?.phone || '--'}</span>
                  </div>
                  <Button variant="secondary" className="h-11 whitespace-nowrap px-3" onClick={openPhoneModal}>修改手机号</Button>
                  <Button variant="secondary" className="h-11 whitespace-nowrap px-3" onClick={openPasswordModal}>重置密码</Button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">毕业届别</label>
                <Input value={profileForm.graduationYear} onChange={(e) => setProfileForm((prev) => ({ ...prev, graduationYear: e.target.value }))} onBlur={saveProfile} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">学历层次</label>
                <Select value={profileForm.degree} onChange={(e) => setProfileForm((prev) => ({ ...prev, degree: e.target.value }))} onBlur={saveProfile}>
                  {DEGREE_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">毕业学校</label>
                <Input value={profileForm.schoolName} onChange={(e) => setProfileForm((prev) => ({ ...prev, schoolName: e.target.value }))} onBlur={saveProfile} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">专业</label>
                <Input value={profileForm.major} onChange={(e) => setProfileForm((prev) => ({ ...prev, major: e.target.value }))} onBlur={saveProfile} />
              </div>
            </div>
          </Card>

          <Card ref={refs.preference} className="p-6" id="preference">
            <h2 className="text-2xl font-bold text-ink">求职意向</h2>
            <div className="mt-6 grid gap-6">
              {([
                ['意向城市', 'intentionCity', '输入城市后回车添加'],
                ['目标岗位', 'intentionJob', '岗位关键词认准 2-3 字，太长会影响匹配精度'],
                ['感兴趣的公司', 'intentionCompany', '公司名写 2-4 字关键词，太长会影响匹配精度'],
              ] as const).map(([title, key, tip]) => (
                <div key={key}>
                  <label className="mb-2 block text-sm font-medium text-ink">{title}</label>
                  <Input
                    value={tagInput[key]}
                    placeholder={tip}
                    onChange={(e) => setTagInput((prev) => ({ ...prev, [key]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(key);
                      }
                    }}
                  />
                  <p className="mt-2 text-xs text-muted">保存后系统会自动收敛为标准词，并直接用于专属推荐。</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {preferenceForm[key].map((item) => (
                      <button
                        key={item}
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm text-ink transition hover:bg-brand/10 hover:text-brand"
                        onClick={() => removeTag(key, item)}
                      >
                        {item} ×
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card ref={refs.invitation} className="p-6" id="invitation">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-ink">我的邀请</h2>
                <div className="mt-4 space-y-2 text-sm text-muted">
                  {invitation?.rules.map((rule) => <p key={rule}>{rule}</p>)}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="text-muted">我的邀请码</p>
                <p className="mt-2 text-2xl font-bold text-brand">{invitation?.inviteCode}</p>
                <Button className="mt-4 w-full" onClick={copyInvite}>一键复制邀请文案</Button>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Card className="p-4"><p className="text-sm text-muted">累计邀请</p><p className="mt-2 text-2xl font-bold text-ink">{invitation?.stats.inviteCount ?? 0}</p></Card>
              <Card className="p-4"><p className="text-sm text-muted">下一里程碑</p><p className="mt-2 text-2xl font-bold text-ink">{invitation?.stats.nextMilestone ?? 0}</p></Card>
              <Card className="p-4"><p className="text-sm text-muted">已获奖励</p><p className="mt-2 text-2xl font-bold text-ink">{invitation?.stats.rewardedTimes ?? 0}</p></Card>
            </div>
            <div className="mt-6 rounded-2xl bg-slate-50 p-4">
              <div className="h-3 rounded-full bg-slate-200">
                <div className="h-3 rounded-full bg-brand" style={{ width: `${Math.min(((invitation?.progress.current || 0) / Math.max(invitation?.progress.target || 1, 1)) * 100, 100)}%` }} />
              </div>
              <p className="mt-3 text-sm text-muted">{invitation?.progress.current ?? 0}/{invitation?.progress.target ?? 0} · {invitation?.progress.text}</p>
            </div>
            <div className="mt-6 space-y-3">
              {(invitation?.records || []).length ? invitation?.records.map((record) => (
                <div key={record.id} className="rounded-2xl border border-slate-100 p-4 text-sm text-muted">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p>{record.maskedPhone}</p>
                    <p>{formatDate(record.registerTime)}</p>
                    <p className="font-medium text-brand">{record.rewardStatus}</p>
                  </div>
                </div>
              )) : <p className="text-sm text-muted">还没有邀请记录，快去分享邀请码吧。</p>}
            </div>
          </Card>

          <Card ref={refs.orders} className="p-6" id="orders">
            <h2 className="text-2xl font-bold text-ink">我的订单</h2>
            <div className="mt-6 space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_160px] md:items-center">
                    <div>
                      <p className="text-sm text-muted">订单号</p>
                      <p className="mt-1 font-semibold text-ink">{order.orderNo}</p>
                      <p className="mt-2 text-sm text-muted">商品：{order.productName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted">金额</p>
                      <p className="mt-1 font-semibold text-ink">{formatCurrency(order.amount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted">下单时间</p>
                      <p className="mt-1 font-semibold text-ink">{formatDate(order.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted">支付时间</p>
                      <p className="mt-1 font-semibold text-ink">{formatDate(order.payTime || undefined)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 md:justify-end">
                      <span className={`text-sm font-semibold ${getOrderStatusClassName(order)}`}>{getOrderStatusText(order)}</span>
                      {order.canContinuePay ? (
                        <Button onClick={() => router.push(order.checkoutPath)}>继续支付</Button>
                      ) : null}
                      {!order.canContinuePay ? (
                        <Button variant="secondary" onClick={() => handleOrderEntryClick(order)}>{order.entryLabel}</Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {activeOrderGuide ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <Card className="w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-brand">服务入口</p>
                <h3 className="mt-2 text-2xl font-bold text-ink">{activeOrderGuide.productName}</h3>
                <p className="mt-2 text-sm text-muted">订单号：{activeOrderGuide.orderNo}</p>
              </div>
              <Button variant="secondary" onClick={closeOrderGuide}>关闭</Button>
            </div>

            <div className={`mt-6 ${activeOrderGuideImageUrl ? 'grid gap-5 lg:grid-cols-[1.05fr_0.95fr]' : ''}`}>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-semibold text-ink">服务说明</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{activeOrderGuideText}</p>
              </div>
              {activeOrderGuideImageUrl ? (
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeOrderGuideImageUrl} alt={`${activeOrderGuide.productName} 服务说明配图`} className="h-auto w-full object-cover" />
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {showPhoneModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-ink">修改手机号</h3>
            <p className="mt-2 text-sm text-muted">请输入新的手机号，并完成短信验证码验证。</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">当前手机号</label>
                <Input value={overview?.phone || ''} disabled />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">新手机号</label>
                <Input
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="请输入新的手机号"
                  value={phoneForm.phone}
                  onChange={(e) => setPhoneForm((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">短信验证码</label>
                <div className="flex gap-3">
                  <Input
                    className="flex-1"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="请输入验证码"
                    value={phoneForm.code}
                    onChange={(e) => setPhoneForm((prev) => ({ ...prev, code: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-w-[132px]"
                    disabled={phoneSendingCode || phoneCountdown > 0 || !isValidPhone(phoneForm.phone)}
                    onClick={() => void handleSendPhoneCode()}
                  >
                    {phoneCountdown > 0 ? `${phoneCountdown}s 后重发` : phoneSendingCode ? '发送中...' : '获取验证码'}
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowPhoneModal(false)}>取消</Button>
              <Button onClick={() => void updatePhone()} disabled={phoneSubmitting}>{phoneSubmitting ? '提交中...' : '确认修改'}</Button>
            </div>
          </Card>
        </div>
      ) : null}

      {showPasswordModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-ink">重置密码</h3>
            <p className="mt-2 text-sm text-muted">通过当前手机号验证码验证后，直接设置新的登录密码。</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">当前手机号</label>
                <Input value={passwordForm.phone} disabled />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">短信验证码</label>
                <div className="flex gap-3">
                  <Input
                    className="flex-1"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="请输入验证码"
                    value={passwordForm.code}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, code: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-w-[132px]"
                    disabled={passwordSendingCode || passwordCountdown > 0 || !isValidPhone(passwordForm.phone)}
                    onClick={() => void handleSendPasswordCode()}
                  >
                    {passwordCountdown > 0 ? `${passwordCountdown}s 后重发` : passwordSendingCode ? '发送中...' : '获取验证码'}
                  </Button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink">新密码</label>
                <Input
                  type="password"
                  placeholder="请输入 8-32 位新密码"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowPasswordModal(false)}>取消</Button>
              <Button onClick={() => void updatePassword()} disabled={passwordSubmitting}>{passwordSubmitting ? '提交中...' : '确认重置'}</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
