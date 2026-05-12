'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { clientFetch } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminCommissionConfigItem } from '@/types';

export default function AdminCommissionConfigPage() {
  const [config, setConfig] = useState<AdminCommissionConfigItem | null>(null);
  const [oneLevelRate, setOneLevelRate] = useState('15');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useGlobalToast(message, setMessage);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await clientFetch<AdminCommissionConfigItem>('/admin/commission-config');
        setConfig(result);
        setOneLevelRate(String(result.oneLevelRate));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '激励金配置加载失败');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const rateNumber = Number(oneLevelRate || 0);
  const sampleCommission = Number.isNaN(rateNumber) ? 0 : (100 * rateNumber) / 100;

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      const result = await clientFetch<AdminCommissionConfigItem>(`/admin/commission-config/${config.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ oneLevelRate: Number(oneLevelRate) }),
      });
      setConfig(result);
      setOneLevelRate(String(result.oneLevelRate));
      setMessage('激励金配置已保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '激励金配置保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin incentive config</p>
        <h2 className="mt-2 text-3xl font-bold text-ink">激励金配置</h2>
        <p className="mt-2 text-sm text-muted">这是后台单例配置页，用于调整一级激励金比例，新的订单会按这里的比例结算。</p>
      </section>

      {loading && !config ? <Card className="p-8 text-sm text-muted">正在加载激励金配置...</Card> : null}

      {config ? (
        <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="rounded-3xl p-6">
            <h3 className="text-xl font-semibold text-ink">一级激励金比例</h3>
            <p className="mt-1 text-sm text-muted">建议只允许运营负责人修改，修改后请同步财务核对口径。</p>
            <div className="mt-5 space-y-4">
              <Input type="number" value={oneLevelRate} onChange={(e) => setOneLevelRate(e.target.value)} />
              <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存配置'}</Button>
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>配置 ID：{config.id}</p>
              <p className="mt-1">最后更新时间：{formatDate(config.updateAt)}</p>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-3xl p-5">
              <p className="text-sm text-muted">当前一级激励金比例</p>
              <p className="mt-3 text-3xl font-bold text-ink">{rateNumber}%</p>
            </Card>
            <Card className="rounded-3xl p-5">
              <p className="text-sm text-muted">示例：消费 100 元可得</p>
              <p className="mt-3 text-3xl font-bold text-ink">{formatCurrency(sampleCommission)}</p>
            </Card>
            <Card className="rounded-3xl p-5 md:col-span-2">
              <h4 className="text-lg font-semibold text-ink">配置说明</h4>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>1. 当前配置只作用于一级邀请关系。</li>
                <li>2. 新订单创建时会读取这里的比例并写入激励金流水。</li>
                <li>3. 已生成的历史流水不会因为这里修改而回溯变更。</li>
              </ul>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}
