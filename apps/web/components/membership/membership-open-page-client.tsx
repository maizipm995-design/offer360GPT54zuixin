'use client';

import { useMemo, useState } from 'react';
import { CircleHelp, Crown, Ticket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clientFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { showToast, useGlobalToast } from '@/store/toast-store';
import { MemberPermissionKey, MembershipBenefitsContent, MembershipPlanItem } from '@/types';

interface Props {
  benefitsContent: MembershipBenefitsContent;
  plans: MembershipPlanItem[];
}

type BenefitItem = {
  title: string;
  content: string;
  hint?: string;
};

const freeUserBenefits: BenefitItem[] = [
  {
    title: '校招公告查看：',
    content: '每天仅能查看10条招聘,错过大量热门优质总招岗位机会窗口',
  },
  {
    title: '专属岗位推荐：',
    content: '手动翻几百个岗位,耗时费力找岗难',
  },
  {
    title: '校招求职资料包：',
    content: '网上零散拼凑优质资料,简历/面试题缺乏体系,求职竞争力较弱',
  },
  {
    title: '商品购买权益：',
    content: '站内全部商品均按原价购买,无会员专属折扣',
    hint: '开通超级会员后，网站内所有商品和会员续费订单都可长期享受 9 折优惠。',
  },
  {
    title: '激励金抵扣权益：',
    content: '激励金单笔订单最高仅可抵扣 5%',
    hint: '激励金可通过邀请好友注册或下单获得，下单时可按会员规则抵扣部分金额，普通/标准会员最高 5%，超级会员最高 10%。',
  },
  {
    title: '求职辅导视频课：',
    content: '缺少系统化精品录播课程,求职方法碎片化,面试容易反复踩坑',
  },
  {
    title: '服务周期：',
    content: '无任何求职服务',
  },
] as const;

const superMemberBenefits: BenefitItem[] = [
  {
    title: '校招公告查看：',
    content: '每日更新100+全行业岗位,无限次查看,不错过任何投递窗口',
  },
  {
    title: '专属岗位推荐：',
    content: 'AI专属推荐岗位,省你九成找岗时间',
  },
  {
    title: '校招求职资料包：',
    content: '全套求职资料:高分简历模板+大厂面试题+行业科普,一站式备齐',
  },
  {
    title: '商品购买权益：',
    content: '购买站内全部商品一律享 9 折优惠',
    hint: '开通超级会员后，网站内所有商品和会员续费订单都可长期享受 9 折优惠。',
  },
  {
    title: '激励金抵扣权益：',
    content: '激励金单笔订单最高可抵扣 10%',
    hint: '激励金可通过邀请好友注册或下单获得，下单时可按会员规则抵扣部分金额，普通/标准会员最高 5%，超级会员最高 10%。',
  },
  {
    title: '求职辅导视频课：',
    content: '行业大牛精心打造精品求职辅导视频课程,可反复学习,系统提升求职能力',
  },
  {
    title: '服务周期：',
    content: '365天年付会员',
  },
] as const;

interface RedeemResult {
  code: string;
  cardType: string;
  grantDays: number;
  endAt: string;
  remainingDays: number;
  memberLevel: 'standard' | 'super';
  memberLevelLabel: string;
  memberRoleCode: 'STANDARD_MEMBER' | 'SUPER_MEMBER';
  memberRoleName: string;
  permissionKeys: MemberPermissionKey[];
}

export function MembershipOpenPageClient({ benefitsContent, plans }: Props) {
  const router = useRouter();
  const { token, user, updateUser } = useAuthStore();
  const [agreed, setAgreed] = useState(true);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [message, setMessage] = useState('');

  useGlobalToast(message, setMessage);

  const superPlan = useMemo(
    () =>
      [...plans]
        .sort((left, right) => Number(right.isHot) - Number(left.isHot) || left.price - right.price)
        .find((plan) => plan.memberLevel === 'super') ?? null,
    [plans],
  );

  const displaySuperPlan = useMemo(() => {
    if (!superPlan) {
      return null;
    }
    return {
      ...superPlan,
      name: 'offer360求职会员',
      price: 99,
      originalPrice: superPlan.originalPrice > 99 ? superPlan.originalPrice : 199,
      grantDays: 365,
    };
  }, [superPlan]);

  const ensureLogin = () => {
    if (!token) {
      router.push('/login');
      return false;
    }
    return true;
  };

  const handleRedeemClick = () => {
    if (!ensureLogin()) {
      return;
    }
    setShowRedeem((current) => !current);
    setMessage('');
  };

  const handleRedeemSubmit = async () => {
    if (!ensureLogin()) {
      return;
    }

    const normalizedCode = redeemCode.trim().toUpperCase();
    if (!normalizedCode) {
      setMessage('请输入兑换码');
      return;
    }

    setRedeemLoading(true);
    setMessage('');
    try {
      const result = await clientFetch<RedeemResult>(
        '/me/membership/redeem',
        {
          method: 'POST',
          body: JSON.stringify({ code: normalizedCode }),
        },
        token!,
      );
      updateUser({
        isMember: true,
        memberLevel: result.memberLevel,
        memberLevelLabel: result.memberLevelLabel,
        memberRoleCode: result.memberRoleCode,
        memberRoleName: result.memberRoleName,
        permissionKeys: result.permissionKeys,
        membershipRemainingDays: result.remainingDays,
      });
      setRedeemCode('');
      setShowRedeem(false);
      showToast(`兑换成功，已为你开通 ${result.memberLevelLabel}，增加 ${result.grantDays} 天。`, 'success');
      router.push('/personal-center#membership');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '兑换失败');
    } finally {
      setRedeemLoading(false);
    }
  };

  const handlePurchasePlan = async (plan: MembershipPlanItem) => {
    if (!agreed) {
      setMessage('开通前请先阅读并勾选会员服务协议');
      return;
    }

    if (!ensureLogin()) {
      return;
    }

    setLoadingPlanId(plan.id);
    setMessage('');
    try {
      showToast('正在前往支付页面。', 'success');
      router.push(`/checkout?productId=${encodeURIComponent(plan.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '跳转支付页失败');
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <main className="bg-[#F6F6F6] pb-16">
      {showRedeem ? (
        <section className="px-4 pb-4 pt-6">
          <div className="mx-auto max-w-[980px] rounded-[22px] border border-[#FFCFAB] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[#F08A24]">
                <Crown className="h-5 w-5" />
                <h1 className="text-xl font-bold sm:text-2xl">offer360会员</h1>
              </div>
              <button
                type="button"
                onClick={handleRedeemClick}
                className="inline-flex items-center gap-1 rounded-xl border border-[#FFE2C7] bg-[#FFF8F1] px-3 py-2 text-sm font-medium text-[#F08A24] transition hover:bg-[#FFF1E5]"
              >
                <Ticket className="h-4 w-4" />
                返回开通
              </button>
            </div>
            <div className="flex w-full flex-col gap-3 lg:flex-row">
              <input
                value={redeemCode}
                onChange={(event) => setRedeemCode(event.target.value.toUpperCase())}
                placeholder="请输入兑换码"
                className="h-11 flex-1 rounded-xl border border-gray-200 px-4 text-sm outline-none transition focus:border-[#F08A24]"
              />
              <button
                type="button"
                onClick={handleRedeemSubmit}
                disabled={redeemLoading}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#F08A24] px-5 text-sm font-medium text-white transition hover:bg-[#DD7C1A] disabled:cursor-not-allowed disabled:opacity-60 lg:min-w-[140px]"
              >
                {redeemLoading ? '兑换中...' : '立即兑换'}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="px-2 pb-4 pt-6 sm:px-4">
            <div className="mx-auto w-full max-w-[980px] overflow-hidden">
              <div className="flex flex-col items-center gap-3 pb-5 sm:relative sm:block sm:pb-6">
                <div className="flex items-center justify-center gap-2 text-[#F08A24]">
                  <Crown className="h-5 w-5 sm:h-6 sm:w-6" />
                  <h1 className="text-[24px] font-bold leading-none sm:text-[36px]">offer360会员</h1>
                </div>
                <button
                  type="button"
                  onClick={handleRedeemClick}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#FFE2C7] bg-[#FFF8F1] px-3 py-2 text-xs font-medium text-[#F08A24] transition hover:bg-[#FFF1E5] sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2 sm:text-sm"
                >
                  <Ticket className="h-4 w-4" />
                  兑换码
                </button>
              </div>

              <div className="grid grid-cols-2 items-stretch gap-1.5 sm:gap-4">
                <article className="flex min-h-[388px] min-w-0 flex-col overflow-hidden rounded-[14px] border border-[#D9D9D9] bg-[#FBFBFB] px-2.5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:min-h-[430px] sm:rounded-[18px] sm:px-7 sm:py-6">
                  <h2 className="text-center text-[15px] font-bold text-[#333333] sm:text-[22px]">普通用户</h2>
                  <div className="mt-4 space-y-3 text-[10px] leading-[1.45] text-[#555555] sm:mt-6 sm:space-y-5 sm:text-[15px] sm:leading-7">
                    {freeUserBenefits.map((item) => (
                      <div key={item.title} className="min-w-0">
                        <BenefitTitle title={item.title} hint={item.hint} tone="default" />
                        <p>{item.content}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto border-t border-[#E9E9E9] pt-4 sm:pt-5">
                    <button
                      type="button"
                      onClick={() => router.push('/')}
                      className="mx-auto inline-flex h-9 w-full items-center justify-center rounded-lg bg-brand px-2 text-[11px] font-semibold text-white transition hover:bg-brand-dark sm:h-11 sm:min-w-[132px] sm:w-auto sm:rounded-xl sm:px-6 sm:text-sm"
                    >
                      去查看公告
                    </button>
                  </div>
                </article>

                <article className="flex min-h-[388px] min-w-0 flex-col overflow-hidden rounded-[14px] border border-[#F08A24] bg-white px-2.5 py-4 shadow-[0_8px_20px_rgba(240,138,36,0.08)] sm:min-h-[430px] sm:rounded-[18px] sm:px-7 sm:py-6">
                  <h2 className="text-center text-[15px] font-bold text-[#F08A24] sm:text-[22px]">offer360求职会员</h2>
                  <div className="mt-4 space-y-3 text-[10px] leading-[1.45] text-[#555555] sm:mt-6 sm:space-y-5 sm:text-[15px] sm:leading-7">
                    {superMemberBenefits.map((item) => (
                      <div key={item.title} className="min-w-0">
                        <BenefitTitle title={item.title} hint={item.hint} tone="accent" />
                        <p>{item.content}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto border-t border-[#F4D7BF] pt-3 sm:pt-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                      <div>
                        <div className="flex flex-wrap items-end gap-1 sm:gap-2">
                          <span className="text-[25px] font-bold leading-none text-[#F08A24] sm:text-[36px]">¥{displaySuperPlan?.price ?? 99}</span>
                          <span className="pb-0.5 text-[10px] text-[#9CA3AF] line-through sm:pb-1 sm:text-sm">¥{displaySuperPlan?.originalPrice ?? 199}</span>
                          <span className="pb-0.5 text-[10px] text-[#666666] sm:pb-1 sm:text-sm">/年</span>
                        </div>
                        <p className="mt-1 text-[10px] text-[#666666] sm:text-sm">日均仅约 ¥{((displaySuperPlan?.price ?? 99) / 365).toFixed(2)}</p>
                        <div className="mt-2 space-y-1 text-[10px] leading-4 text-[#666666] sm:text-sm sm:leading-5">
                          <p>标准会员为系统赠送权益，不支持单独购买。</p>
                          <p>超级会员支持随时购买、提前续费，系统会自动顺延叠加时长。</p>
                        </div>
                        <label className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-[#666666] sm:gap-2 sm:text-sm sm:leading-5">
                          <input
                            type="checkbox"
                            checked={agreed}
                            onChange={(event) => setAgreed(event.target.checked)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-[#D3D3D3] sm:mt-1 sm:h-4 sm:w-4"
                          />
                          <span>
                            开通前请阅读
                            <button
                              type="button"
                              onClick={() => router.push('/membership#membership-benefits')}
                              className="ml-1 font-medium text-[#F08A24]"
                            >
                              《会员服务协议》
                            </button>
                          </span>
                        </label>
                        {user?.isMember ? (
                          <p className="mt-2 text-[10px] font-medium leading-4 text-[#F08A24] sm:text-sm sm:leading-5">
                            当前账号已开通 {user.memberLevelLabel}，剩余约 {user.membershipRemainingDays ?? 0} 天，可随时继续购买或续费。
                          </p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => displaySuperPlan && handlePurchasePlan(displaySuperPlan)}
                        disabled={!displaySuperPlan || loadingPlanId === displaySuperPlan?.id}
                        className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-[#F08A24] px-2 text-[11px] font-semibold text-white transition hover:bg-[#DD7C1A] disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:min-w-[132px] sm:w-auto sm:rounded-xl sm:px-6 sm:text-sm"
                      >
                        {loadingPlanId === displaySuperPlan?.id ? '创建订单中...' : user?.memberLevel === 'super' ? '立即续费超级会员' : '立即开通超级会员'}
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>

          <section id="membership-benefits" className="px-4 py-6">
            <div className="mx-auto max-w-[980px] rounded-3xl bg-white p-8 shadow-sm">
              <h2 className="mb-8 text-center text-2xl font-bold text-[#FF7D00]">{benefitsContent.title}</h2>
              <div className="rich-html-content membership-rich-content" dangerouslySetInnerHTML={{ __html: benefitsContent.htmlContent }} />
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function BenefitTitle({
  title,
  hint,
  tone,
}: {
  title: string;
  hint?: string;
  tone: 'default' | 'accent';
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-start gap-1">
      <p className={`font-semibold ${tone === 'accent' ? 'text-[#F08A24]' : 'text-[#333333]'}`}>{title}</p>
      {hint ? (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className={`relative mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border transition sm:h-4.5 sm:w-4.5 ${
            tone === 'accent'
              ? 'border-[#F4B276] text-[#F08A24] hover:bg-[#FFF5EC]'
              : 'border-[#D9D9D9] text-[#999999] hover:bg-[#F8F8F8]'
          }`}
          aria-label={`${title}说明`}
        >
          <CircleHelp className="h-3 w-3" />
          {open ? (
            <span
              className="absolute left-1/2 top-full z-20 mt-2 w-[220px] -translate-x-1/2 rounded-xl border border-[#FFE2C7] bg-white px-3 py-2 text-left text-[11px] font-normal leading-5 text-[#666666] shadow-[0_12px_36px_rgba(15,23,42,0.12)]"
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
            >
              {hint}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
