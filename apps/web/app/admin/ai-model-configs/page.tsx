'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { clientFetch } from '@/lib/api';
import { ADMIN_TOAST_COPY } from '@/lib/toast-copy';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import type { AdminAiModelConfigItem, AdminAiModelConfigTestResult } from '@/types';

type FormState = {
  code: string;
  configName: string;
  provider: 'volcengine-ark';
  baseUrl: string;
  apiKey: string;
  modelName: string;
  endpointType: 'responses';
  timeoutMs: string;
  maxOutputTokens: string;
  temperature: string;
  topP: string;
  systemPrompt: string;
  globalPromptTemplate: string;
  entryPromptTemplate: string;
  professionalPromptTemplate: string;
  assessmentPromptTemplate: string;
  enabled: boolean;
  isDefault: boolean;
  remark: string;
};

const DEFAULT_FORM: FormState = {
  code: 'resume_optimizer_default',
  configName: '简历优化默认模型',
  provider: 'volcengine-ark',
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  apiKey: '',
  modelName: 'doubao-seed-2-0-lite-260428',
  endpointType: 'responses',
  timeoutMs: '60000',
  maxOutputTokens: '1200',
  temperature: '0.7',
  topP: '0.9',
  systemPrompt: '',
  globalPromptTemplate: '',
  entryPromptTemplate: '',
  professionalPromptTemplate: '',
  assessmentPromptTemplate: '',
  enabled: true,
  isDefault: true,
  remark: '',
};

function toFormState(item: AdminAiModelConfigItem): FormState {
  return {
    code: item.code,
    configName: item.configName,
    provider: item.provider,
    baseUrl: item.baseUrl,
    apiKey: '',
    modelName: item.modelName,
    endpointType: item.endpointType,
    timeoutMs: String(item.timeoutMs),
    maxOutputTokens: item.maxOutputTokens ? String(item.maxOutputTokens) : '',
    temperature: item.temperature !== null && item.temperature !== undefined ? String(item.temperature) : '',
    topP: item.topP !== null && item.topP !== undefined ? String(item.topP) : '',
    systemPrompt: item.systemPrompt || '',
    globalPromptTemplate: item.globalPromptTemplate || '',
    entryPromptTemplate: item.entryPromptTemplate || '',
    professionalPromptTemplate: item.professionalPromptTemplate || '',
    assessmentPromptTemplate: item.assessmentPromptTemplate || '',
    enabled: item.enabled,
    isDefault: item.isDefault,
    remark: item.remark || '',
  };
}

function buildPayload(form: FormState) {
  return {
    code: form.code.trim(),
    configName: form.configName.trim(),
    provider: form.provider,
    baseUrl: form.baseUrl.trim(),
    ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
    modelName: form.modelName.trim(),
    endpointType: form.endpointType,
    timeoutMs: Number(form.timeoutMs),
    ...(form.maxOutputTokens.trim() ? { maxOutputTokens: Number(form.maxOutputTokens) } : {}),
    ...(form.temperature.trim() ? { temperature: Number(form.temperature) } : {}),
    ...(form.topP.trim() ? { topP: Number(form.topP) } : {}),
    systemPrompt: form.systemPrompt,
    globalPromptTemplate: form.globalPromptTemplate,
    entryPromptTemplate: form.entryPromptTemplate,
    professionalPromptTemplate: form.professionalPromptTemplate,
    assessmentPromptTemplate: form.assessmentPromptTemplate,
    enabled: form.enabled,
    isDefault: form.isDefault,
    remark: form.remark,
  };
}

export default function AdminAiModelConfigsPage() {
  const [list, setList] = useState<AdminAiModelConfigItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [testResult, setTestResult] = useState<AdminAiModelConfigTestResult | null>(null);

  useGlobalToast(message, setMessage);

  const selectedItem = useMemo(
    () => list.find((item) => item.id === selectedId) ?? null,
    [list, selectedId],
  );

  const loadData = useCallback(async (preferredId?: string) => {
    try {
      setLoading(true);
      const result = await clientFetch<AdminAiModelConfigItem[]>('/admin/ai-model-configs');
      setList(result);
      const nextSelected =
        result.find((item) => item.id === preferredId)
        ?? result.find((item) => item.id === selectedId)
        ?? result[0]
        ?? null;

      if (nextSelected) {
        setSelectedId(nextSelected.id);
        setForm(toFormState(nextSelected));
      } else {
        setSelectedId('');
        setForm(DEFAULT_FORM);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.loadFailed('AI 模型配置'));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const fillForm = (item: AdminAiModelConfigItem) => {
    setSelectedId(item.id);
    setForm(toFormState(item));
    setTestResult(null);
  };

  const resetToCreate = () => {
    setSelectedId('');
    setForm(DEFAULT_FORM);
    setTestResult(null);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const payload = buildPayload(form);
      const saved = selectedId
        ? await clientFetch<AdminAiModelConfigItem>(`/admin/ai-model-configs/${selectedId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await clientFetch<AdminAiModelConfigItem>('/admin/ai-model-configs', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setMessage(selectedId ? ADMIN_TOAST_COPY.updated('AI 模型配置') : ADMIN_TOAST_COPY.created('AI 模型配置'));
      await loadData(saved.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.saveFailed('AI 模型配置'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (item: AdminAiModelConfigItem) => {
    try {
      const saved = await clientFetch<AdminAiModelConfigItem>(`/admin/ai-model-configs/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !item.enabled }),
      });
      setMessage(saved.enabled ? ADMIN_TOAST_COPY.enabled('AI 模型配置') : ADMIN_TOAST_COPY.disabled('AI 模型配置'));
      await loadData(saved.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.statusUpdateFailed('AI 模型配置'));
    }
  };

  const handleSetDefault = async (item: AdminAiModelConfigItem) => {
    try {
      const saved = await clientFetch<AdminAiModelConfigItem>(`/admin/ai-model-configs/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          code: item.code,
          configName: item.configName,
          provider: item.provider,
          baseUrl: item.baseUrl,
          modelName: item.modelName,
          endpointType: item.endpointType,
          timeoutMs: item.timeoutMs,
          maxOutputTokens: item.maxOutputTokens,
          temperature: item.temperature,
          topP: item.topP,
          systemPrompt: item.systemPrompt || '',
          globalPromptTemplate: item.globalPromptTemplate || '',
          entryPromptTemplate: item.entryPromptTemplate || '',
          professionalPromptTemplate: item.professionalPromptTemplate || '',
          assessmentPromptTemplate: item.assessmentPromptTemplate || '',
          enabled: true,
          isDefault: true,
          remark: item.remark || '',
        }),
      });
      setMessage(ADMIN_TOAST_COPY.updated('默认 AI 模型配置'));
      await loadData(saved.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.saveFailed('默认 AI 模型配置'));
    }
  };

  const handleTest = async () => {
    if (!selectedId) {
      setMessage(ADMIN_TOAST_COPY.selectSavedItemFirst('模型配置'));
      return;
    }

    try {
      setTesting(true);
      const result = await clientFetch<AdminAiModelConfigTestResult>(`/admin/ai-model-configs/${selectedId}/test`, {
        method: 'POST',
        body: JSON.stringify({ prompt: '请严格返回 {"success":true,"message":"ok"}' }),
      });
      setTestResult(result);
      setMessage(ADMIN_TOAST_COPY.connectionTestDone);
    } catch (error) {
      setTestResult(null);
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.connectionTestFailed);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">AI model configs</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">AI 模型配置</h2>
            <p className="mt-2 text-sm text-muted">后台统一维护 Ark 模型的连接参数、Prompt 模板和启停状态，供简历 AI 优化链路直接复用。</p>
          </div>
          <Button onClick={resetToCreate}>新增配置</Button>
        </div>
      </section>

      {loading && !list.length ? <Card className="p-8 text-sm text-muted">正在加载 AI 模型配置...</Card> : null}

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="rounded-3xl p-5 xl:sticky xl:top-6 xl:self-start">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-ink">配置列表</h3>
              <p className="mt-1 text-sm text-muted">默认配置会被简历 AI 优化接口优先使用。</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {list.length ? list.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => fillForm(item)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  selectedId === item.id
                    ? 'border-brand bg-brand/5 shadow-card'
                    : 'border-slate-200 hover:border-brand/40 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-ink">{item.configName}</p>
                  <div className="flex gap-2">
                    {item.isDefault ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-700">默认</span> : null}
                    <span className={`rounded-full px-2.5 py-1 text-xs ${item.enabled ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-500'}`}>
                      {item.enabled ? '已启用' : '已停用'}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.provider} / {item.modelName}</p>
                <p className="mt-2 break-all text-xs text-slate-500">{item.baseUrl}</p>
                <p className="mt-2 text-xs text-slate-400">Key: {item.apiKeyMask || '未配置'}</p>
                <p className="mt-2 text-xs text-slate-400">更新于 {formatDate(item.updatedAt)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!item.isDefault ? (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleSetDefault(item);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          void handleSetDefault(item);
                        }
                      }}
                      className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm"
                    >
                      设为默认
                    </span>
                  ) : null}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleToggleStatus(item);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleToggleStatus(item);
                      }
                    }}
                    className="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm"
                  >
                    {item.enabled ? '停用' : '启用'}
                  </span>
                </div>
              </button>
            )) : (
              <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">暂无 AI 模型配置，点击右上角开始创建。</div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-ink">{selectedItem ? '编辑模型配置' : '新增模型配置'}</h3>
                <p className="mt-1 text-sm text-muted">编辑已有配置时，API Key 留空表示沿用当前密钥，不会回显明文。</p>
              </div>
              {selectedItem ? (
                <Button variant="secondary" onClick={() => selectedItem && fillForm(selectedItem)} disabled={saving}>
                  恢复表单
                </Button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">配置编码</span>
                <Input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">配置名称</span>
                <Input value={form.configName} onChange={(event) => setForm((prev) => ({ ...prev, configName: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">供应商</span>
                <Select value={form.provider} onChange={(event) => setForm((prev) => ({ ...prev, provider: event.target.value as FormState['provider'] }))}>
                  <option value="volcengine-ark">volcengine-ark</option>
                </Select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Endpoint Type</span>
                <Select value={form.endpointType} onChange={(event) => setForm((prev) => ({ ...prev, endpointType: event.target.value as FormState['endpointType'] }))}>
                  <option value="responses">responses</option>
                </Select>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-ink">Base URL</span>
                <Input value={form.baseUrl} onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))} />
                <p className="mt-2 text-xs text-muted">火山引擎 Ark OpenAI 兼容地址，常用值：https://ark.cn-beijing.volces.com/api/v3（不要带反引号）</p>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-ink">API Key</span>
                <Input
                  type="password"
                  value={form.apiKey}
                  placeholder={selectedItem?.apiKeyMask || '请输入 Ark API Key'}
                  onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                />
                <p className="mt-2 text-xs text-muted">直接粘贴 ark-...；保存后仅展示掩码。请求会以 Authorization: Bearer &lt;API Key&gt; 方式鉴权。</p>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">模型名</span>
                <Input value={form.modelName} onChange={(event) => setForm((prev) => ({ ...prev, modelName: event.target.value }))} />
                <p className="mt-2 text-xs text-muted">示例：doubao-seed-2-0-lite-260428</p>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">超时(ms)</span>
                <Input type="number" value={form.timeoutMs} onChange={(event) => setForm((prev) => ({ ...prev, timeoutMs: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">最大输出 Token</span>
                <Input type="number" value={form.maxOutputTokens} onChange={(event) => setForm((prev) => ({ ...prev, maxOutputTokens: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">temperature</span>
                <Input type="number" step="0.01" value={form.temperature} onChange={(event) => setForm((prev) => ({ ...prev, temperature: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">topP</span>
                <Input type="number" step="0.01" value={form.topP} onChange={(event) => setForm((prev) => ({ ...prev, topP: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">启用状态</span>
                <Select value={String(form.enabled)} onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.value === 'true' }))}>
                  <option value="true">启用</option>
                  <option value="false">停用</option>
                </Select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">默认配置</span>
                <Select value={String(form.isDefault)} onChange={(event) => setForm((prev) => ({ ...prev, isDefault: event.target.value === 'true' }))}>
                  <option value="true">是</option>
                  <option value="false">否</option>
                </Select>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-ink">系统提示词</span>
                <Textarea value={form.systemPrompt} onChange={(event) => setForm((prev) => ({ ...prev, systemPrompt: event.target.value }))} className="min-h-[120px]" />
                <p className="mt-2 text-xs text-muted">作用于全部 AI 链路：全局优化、单条/单模块优化、专业术语优化、评估建议生成和翻译。这里负责定义模型身份、事实边界、输出格式等硬约束。</p>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-ink">通用任务模板（全局优化/翻译）</span>
                <Textarea value={form.globalPromptTemplate} onChange={(event) => setForm((prev) => ({ ...prev, globalPromptTemplate: event.target.value }))} className="min-h-[120px]" />
                <p className="mt-2 text-xs text-muted">运行时它服务 2 条链路：全局一键优化和自定义翻译。单模块精细化优化不走这里，而是走下方“条目优化模板”。</p>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-ink">条目优化模板</span>
                <Textarea value={form.entryPromptTemplate} onChange={(event) => setForm((prev) => ({ ...prev, entryPromptTemplate: event.target.value }))} className="min-h-[140px]" />
                <p className="mt-2 text-xs text-muted">运行时服务 2 条链路：单条经历优化，以及单模块单独精细化优化。要求模型只更新当前条目或当前模块允许修改的文本字段。</p>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-ink">专业术语优化模板</span>
                <Textarea
                  value={form.professionalPromptTemplate}
                  onChange={(event) => setForm((prev) => ({ ...prev, professionalPromptTemplate: event.target.value }))}
                  className="min-h-[140px]"
                />
                <p className="mt-2 text-xs text-muted">仅用于“专业术语优化”链路。建议明确：按目标岗位匹配行业术语，工作/项目经历重点升级，校园经历和个人总结只做适度润色。</p>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-ink">评估建议模板</span>
                <Textarea
                  value={form.assessmentPromptTemplate}
                  onChange={(event) => setForm((prev) => ({ ...prev, assessmentPromptTemplate: event.target.value }))}
                  className="min-h-[140px]"
                />
                <p className="mt-2 text-xs text-muted">仅用于 AI 智能评估生成优化建议链路。要求模型只返回 2 到 3 条可点击、可执行、彼此不重复的优化方向，不直接改写简历内容。</p>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-ink">备注</span>
                <Textarea value={form.remark} onChange={(event) => setForm((prev) => ({ ...prev, remark: event.target.value }))} className="min-h-[88px]" />
                <p className="mt-2 text-xs text-muted">仅供后台标注配置用途和维护说明，不会发送给模型。建议写清这套配置服务哪些 AI 业务链路、适用场景和约束。</p>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={handleSubmit} disabled={saving}>{saving ? '保存中...' : selectedItem ? '保存配置' : '创建配置'}</Button>
              <Button variant="secondary" onClick={handleTest} disabled={testing || !selectedId}>
                {testing ? '测试中...' : '测试模型连接'}
              </Button>
            </div>
          </Card>

          <Card className="rounded-3xl p-5">
            <h3 className="text-lg font-semibold text-ink">连接测试结果</h3>
            {testResult ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-muted">测试结果</p>
                    <p className="mt-2 text-lg font-semibold text-emerald-600">{testResult.success ? '成功' : '失败'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-muted">模型名</p>
                    <p className="mt-2 text-lg font-semibold text-ink">{testResult.modelName}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-muted">耗时</p>
                    <p className="mt-2 text-lg font-semibold text-ink">{testResult.latencyMs} ms</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-ink">返回预览</p>
                  <pre className="mt-2 whitespace-pre-wrap break-all text-xs leading-6 text-slate-600">{testResult.previewText}</pre>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">选择已保存配置后点击“测试模型连接”，这里会显示模型返回文本与耗时。</p>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
