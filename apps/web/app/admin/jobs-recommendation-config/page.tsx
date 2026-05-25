'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { clientFetch } from '@/lib/api';
import { ADMIN_TOAST_COPY } from '@/lib/toast-copy';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminJobsRecommendationConfigItem } from '@/types';

const fieldGroups = [
  {
    title: '核心匹配加分',
    description: '控制公司、岗位、城市、学历、专业等核心匹配维度的加分力度。',
    fields: [
      { key: 'companyWeight', label: '意向公司加分', hint: '公司名称命中用户意向公司关键词时加分' },
      { key: 'jobWeight', label: '目标岗位加分', hint: '岗位名称或类别命中用户目标岗位关键词时加分' },
      { key: 'cityExactWeight', label: '精确城市加分', hint: '岗位城市与用户意向城市完全命中时加分' },
      { key: 'cityParentWeight', label: '父级地区加分', hint: '岗位只命中父级省份范围时加分' },
      { key: 'degreeWeight', label: '学历匹配加分', hint: '岗位学历要求命中用户学历时加分' },
      { key: 'majorWeight', label: '专业匹配加分', hint: '岗位专业要求命中用户专业时加分' },
    ],
  },
  {
    title: '时效与热度加分',
    description: '控制岗位新鲜度和热度在推荐排序里的影响程度。',
    fields: [
      { key: 'fresh3DaysWeight', label: '近 3 天更新加分', hint: '岗位在近 72 小时内更新时加分' },
      { key: 'fresh7DaysWeight', label: '近 7 天更新加分', hint: '岗位在近 7 天内更新时加分' },
      { key: 'heatMax', label: '热度加分上限', hint: '点击与投递换算后的热度加分不会超过该值' },
      { key: 'hotAccessThreshold', label: '点击热度阈值', hint: '每达到多少次累计点击折算 1 分热度' },
      { key: 'hotDeliveryThreshold', label: '投递热度阈值', hint: '每达到多少次投递标记折算 1 分热度' },
    ],
  },
  {
    title: '兜底与惩罚',
    description: '用于无明显画像命中时的平台精选补位，以及已投递岗位的排序下调。',
    fields: [
      { key: 'stateOwnedFallbackWeight', label: '精选兜底加分', hint: '无画像命中时，央企/国企等精选岗位可获得的补充分数' },
      { key: 'deliveredPenalty', label: '已投递惩罚分', hint: '用户已经标记过进度的岗位会追加该惩罚分，通常建议填负数' },
    ],
  },
] as const;

type FormState = Record<(typeof fieldGroups)[number]['fields'][number]['key'], string>;

const emptyForm: FormState = {
  companyWeight: '35',
  jobWeight: '30',
  cityExactWeight: '20',
  cityParentWeight: '10',
  degreeWeight: '8',
  majorWeight: '8',
  fresh3DaysWeight: '6',
  fresh7DaysWeight: '3',
  stateOwnedFallbackWeight: '4',
  deliveredPenalty: '-12',
  heatMax: '6',
  hotAccessThreshold: '50',
  hotDeliveryThreshold: '10',
};

function toFormState(config: AdminJobsRecommendationConfigItem): FormState {
  return {
    companyWeight: String(config.companyWeight),
    jobWeight: String(config.jobWeight),
    cityExactWeight: String(config.cityExactWeight),
    cityParentWeight: String(config.cityParentWeight),
    degreeWeight: String(config.degreeWeight),
    majorWeight: String(config.majorWeight),
    fresh3DaysWeight: String(config.fresh3DaysWeight),
    fresh7DaysWeight: String(config.fresh7DaysWeight),
    stateOwnedFallbackWeight: String(config.stateOwnedFallbackWeight),
    deliveredPenalty: String(config.deliveredPenalty),
    heatMax: String(config.heatMax),
    hotAccessThreshold: String(config.hotAccessThreshold),
    hotDeliveryThreshold: String(config.hotDeliveryThreshold),
  };
}

export default function AdminJobsRecommendationConfigPage() {
  const [config, setConfig] = useState<AdminJobsRecommendationConfigItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useGlobalToast(message, setMessage);

  const totalPositiveWeight = useMemo(() => {
    return [
      form.companyWeight,
      form.jobWeight,
      form.cityExactWeight,
      form.cityParentWeight,
      form.degreeWeight,
      form.majorWeight,
      form.fresh3DaysWeight,
      form.fresh7DaysWeight,
      form.stateOwnedFallbackWeight,
      form.heatMax,
    ].reduce((sum, item) => sum + (Number(item) || 0), 0);
  }, [form]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await clientFetch<AdminJobsRecommendationConfigItem>('/admin/jobs-recommendation-config');
        setConfig(result);
        setForm(toFormState(result));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.loadFailed('专属推荐权重配置'));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)]));
      const result = await clientFetch<AdminJobsRecommendationConfigItem>(`/admin/jobs-recommendation-config/${config.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setConfig(result);
      setForm(toFormState(result));
      setMessage(ADMIN_TOAST_COPY.saved('专属推荐权重配置'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.saveFailed('专属推荐权重配置'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Jobs recommendation config</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">专属推荐权重配置</h2>
            <p className="mt-2 text-sm text-muted">后台可直接调整各匹配项加分值与热度阈值，保存后新的专属推荐排序会立即按最新配置生效，无需改代码。</p>
          </div>
          <Button variant="secondary" onClick={() => config && setForm(toFormState(config))} disabled={!config || saving}>
            恢复当前配置
          </Button>
        </div>
      </section>

      {loading && !config ? <Card className="p-8 text-sm text-muted">正在加载专属推荐权重配置...</Card> : null}

      {config ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {fieldGroups.map((group) => (
              <Card key={group.title} className="rounded-3xl p-5">
                <div>
                  <h3 className="text-xl font-semibold text-ink">{group.title}</h3>
                  <p className="mt-1 text-sm text-muted">{group.description}</p>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {group.fields.map((field) => (
                    <label key={field.key} className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">{field.label}</span>
                      <Input
                        type="number"
                        value={form[field.key]}
                        onChange={(event) => handleChange(field.key, event.target.value)}
                      />
                      <p className="mt-2 text-xs leading-5 text-slate-500">{field.hint}</p>
                    </label>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card className="rounded-3xl p-5">
              <h3 className="text-lg font-semibold text-ink">当前配置概览</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-muted">正向权重总和</p>
                  <p className="mt-2 text-3xl font-bold text-ink">{totalPositiveWeight}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-muted">已投递惩罚分</p>
                  <p className="mt-2 text-3xl font-bold text-ink">{Number(form.deliveredPenalty) || 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-muted">热度阈值</p>
                  <p className="mt-2 text-sm font-semibold text-ink">点击 {form.hotAccessThreshold} / 投递 {form.hotDeliveryThreshold}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-muted">最后更新时间</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{formatDate(config.updatedAt)}</p>
                </div>
              </div>
              <Button className="mt-5 w-full" onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存推荐权重配置'}
              </Button>
            </Card>

            <Card className="rounded-3xl p-5">
              <h3 className="text-lg font-semibold text-ink">调权建议</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>1. 想更强调用户真实意向，可优先提高“目标岗位 / 精确城市 / 意向公司”加分。</li>
                <li>2. 想让新岗位更靠前，可提高“近 3 天更新加分”和“近 7 天更新加分”。</li>
                <li>3. 想压低已投递岗位重复曝光，可把“已投递惩罚分”调得更负一些。</li>
                <li>4. 想让高热岗位更容易上浮，可适当降低点击/投递热度阈值或提高热度上限。</li>
              </ul>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}
