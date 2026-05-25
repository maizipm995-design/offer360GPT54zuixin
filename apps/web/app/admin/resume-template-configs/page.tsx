'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  RESUME_BASIC_INFO_VARIANT_OPTIONS,
  RESUME_EXPERIENCE_HEADER_VARIANT_OPTIONS,
  RESUME_HEADER_VARIANT_OPTIONS,
  RESUME_SECTION_TITLE_VARIANT_OPTIONS,
  RESUME_SKILL_VARIANT_OPTIONS,
} from '@/components/resume/resume-templates';
import { clientFetch } from '@/lib/api';
import { ADMIN_TOAST_COPY } from '@/lib/toast-copy';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import type {
  AdminResumeTemplateConfigItem,
  AdminResumeTemplateConfigsResponse,
  AdminResumeVerticalSpacingConfig,
} from '@/types';

const FONT_FAMILY_OPTIONS = [
  { value: 'yahei', label: '微软雅黑' },
  { value: 'heiti', label: '黑体' },
  { value: 'songti', label: '宋体' },
  { value: 'kaiti', label: '楷体' },
] as const;

const PAPER_BACKGROUND_OPTIONS = [
  { value: 'none', label: '纯净' },
  { value: 'diamond-grid', label: '菱格' },
  { value: 'arc-lines', label: '弧线' },
  { value: 'wave-lines', label: '水波' },
  { value: 'vertical-wave', label: '纵波' },
  { value: 'petal', label: '花纹' },
  { value: 'chevron', label: '折线' },
  { value: 'geo-frame', label: '几何' },
  { value: 'angle-grid', label: '角网' },
] as const;

const PAPER_BACKGROUND_POSITION_OPTIONS = [
  { value: 'right', label: '居右' },
  { value: 'left', label: '居左' },
] as const;

const HEADER_ALIGN_OPTIONS = [
  { value: 'left', label: '居左' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '居右' },
] as const;

const DATE_FORMAT_OPTIONS = [
  { value: 'cn', label: '2021年1月' },
  { value: 'dot', label: '2021.01' },
] as const;

const TITLE_STYLE_OPTIONS = [
  { value: 'single', label: '单行标题' },
  { value: 'double', label: '双行标题' },
] as const;

const DOUBLE_LINE_PRIORITY_OPTIONS = [
  { value: 'time-first', label: '时间优先' },
  { value: 'title-first', label: '标题优先' },
] as const;

const verticalSpacingFields: Array<{ key: keyof AdminResumeVerticalSpacingConfig; label: string; hint: string }> = [
  { key: 'sectionTitleToDividerPt', label: '模块标题到分隔线', hint: '控制标题文字与下方分隔线距离' },
  { key: 'dividerToEntryHeaderPt', label: '分隔线到经历头部', hint: '控制模块标题分隔线与第一条经历标题的距离' },
  { key: 'entryHeaderToBodyPt', label: '经历头部到正文', hint: '控制公司/项目标题与正文描述的距离' },
  { key: 'listItemGapPt', label: '列表项间距', hint: '控制列表条目之间的垂直距离' },
  { key: 'bodyTextLineHeightPt', label: '正文基础行高', hint: '与整体疏密共同决定最终正文行高' },
  { key: 'paragraphGapPt', label: '段落间距', hint: '控制连续段落之间的空隙' },
  { key: 'sectionCardGapPt', label: '模块块间距', hint: '控制两个模块卡片之间的距离' },
  { key: 'pagePaddingTopPt', label: '页面上内边距', hint: '控制整页内容距离页面顶部的距离' },
  { key: 'pagePaddingBottomPt', label: '页面下内边距', hint: '控制整页内容距离页面底部的距离' },
  { key: 'headerPaddingTopPt', label: '头部上内边距', hint: '控制头部区域顶部留白' },
  { key: 'headerPaddingBottomPt', label: '头部下内边距', hint: '控制头部区域底部留白' },
];

type VerticalSpacingFormState = Record<keyof AdminResumeVerticalSpacingConfig, string>;

type FormState = {
  templateName: string;
  description: string;
  fontFamily: string;
  fontSize: string;
  spacingScale: string;
  pageMargin: string;
  themeColor: string;
  headerVariant: string;
  basicInfoVariant: string;
  sectionTitleVariant: string;
  skillVariant: string;
  experienceHeaderVariant: string;
  paperBackgroundVariant: string;
  paperBackgroundPosition: string;
  dateFormat: string;
  titleStyle: string;
  titleSeparator: string;
  doubleLinePriority: string;
  headerAlign: string;
};

function toVerticalSpacingFormState(config: AdminResumeVerticalSpacingConfig): VerticalSpacingFormState {
  return {
    sectionTitleToDividerPt: String(config.sectionTitleToDividerPt),
    dividerToEntryHeaderPt: String(config.dividerToEntryHeaderPt),
    entryHeaderToBodyPt: String(config.entryHeaderToBodyPt),
    listItemGapPt: String(config.listItemGapPt),
    bodyTextLineHeightPt: String(config.bodyTextLineHeightPt),
    paragraphGapPt: String(config.paragraphGapPt),
    sectionCardGapPt: String(config.sectionCardGapPt),
    pagePaddingTopPt: String(config.pagePaddingTopPt),
    pagePaddingBottomPt: String(config.pagePaddingBottomPt),
    headerPaddingTopPt: String(config.headerPaddingTopPt),
    headerPaddingBottomPt: String(config.headerPaddingBottomPt),
  };
}

function toFormState(item: AdminResumeTemplateConfigItem): FormState {
  return {
    templateName: item.templateName,
    description: item.description || '',
    fontFamily: item.styleJson.fontFamily,
    fontSize: String(item.styleJson.fontSize),
    spacingScale: String(item.styleJson.spacingScale),
    pageMargin: String(item.styleJson.pageMargin),
    themeColor: item.styleJson.themeColor,
    headerVariant: item.styleJson.headerVariant,
    basicInfoVariant: item.styleJson.basicInfoVariant,
    sectionTitleVariant: item.styleJson.sectionTitleVariant,
    skillVariant: item.styleJson.skillVariant,
    experienceHeaderVariant: item.styleJson.experienceHeaderVariant,
    paperBackgroundVariant: item.styleJson.paperBackgroundVariant,
    paperBackgroundPosition: item.styleJson.paperBackgroundPosition,
    dateFormat: item.styleJson.dateFormat,
    titleStyle: item.styleJson.titleStyle,
    titleSeparator: item.styleJson.titleSeparator,
    doubleLinePriority: item.styleJson.doubleLinePriority,
    headerAlign: item.styleJson.headerAlign,
  };
}

export default function AdminResumeTemplateConfigsPage() {
  const [list, setList] = useState<AdminResumeTemplateConfigItem[]>([]);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [globalVerticalSpacing, setGlobalVerticalSpacing] = useState<AdminResumeVerticalSpacingConfig | null>(null);
  const [globalVerticalSpacingForm, setGlobalVerticalSpacingForm] = useState<VerticalSpacingFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingGlobalSpacing, setSavingGlobalSpacing] = useState(false);
  const [message, setMessage] = useState('');

  useGlobalToast(message, setMessage);

  const selectedItem = useMemo(
    () => list.find((item) => item.templateCode === selectedTemplateCode) ?? null,
    [list, selectedTemplateCode],
  );

  const computedLineHeight = useMemo(() => {
    if (!form || !globalVerticalSpacingForm) {
      return 0;
    }
    const bodyTextLineHeight = Number(globalVerticalSpacingForm.bodyTextLineHeightPt) || 0;
    const spacingScale = Number(form.spacingScale) || 0;
    return Number((bodyTextLineHeight * spacingScale).toFixed(2));
  }, [form, globalVerticalSpacingForm]);

  const loadData = useCallback(async (preferredTemplateCode?: string) => {
    try {
      setLoading(true);
      const result = await clientFetch<AdminResumeTemplateConfigsResponse>('/admin/resume-template-configs');
      setList(result.templates);
      setGlobalVerticalSpacing(result.globalVerticalSpacing);
      setGlobalVerticalSpacingForm(toVerticalSpacingFormState(result.globalVerticalSpacing));

      const nextSelected =
        result.templates.find((item) => item.templateCode === preferredTemplateCode)
        ?? result.templates.find((item) => item.templateCode === selectedTemplateCode)
        ?? result.templates[0]
        ?? null;

      if (nextSelected) {
        setSelectedTemplateCode(nextSelected.templateCode);
        setForm(toFormState(nextSelected));
      } else {
        setSelectedTemplateCode('');
        setForm(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.loadFailed('简历模板排版配置'));
    } finally {
      setLoading(false);
    }
  }, [selectedTemplateCode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const fillForm = (item: AdminResumeTemplateConfigItem) => {
    setSelectedTemplateCode(item.templateCode);
    setForm(toFormState(item));
  };

  const updateVerticalSpacingField = (key: keyof AdminResumeVerticalSpacingConfig, value: string) => {
    setGlobalVerticalSpacingForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSaveGlobalVerticalSpacing = async () => {
    if (!globalVerticalSpacingForm) {
      return;
    }

    try {
      setSavingGlobalSpacing(true);
      const saved = await clientFetch<AdminResumeVerticalSpacingConfig>('/admin/resume-template-configs/global-vertical-spacing', {
        method: 'PATCH',
        body: JSON.stringify({
          verticalSpacing: Object.fromEntries(
            Object.entries(globalVerticalSpacingForm).map(([key, value]) => [key, Number(value)]),
          ),
        }),
      });

      setGlobalVerticalSpacing(saved);
      setGlobalVerticalSpacingForm(toVerticalSpacingFormState(saved));
      setList((prev) => prev.map((item) => ({
        ...item,
        styleJson: {
          ...item.styleJson,
          verticalSpacing: saved,
          lineHeight: Number((saved.bodyTextLineHeightPt * item.styleJson.spacingScale).toFixed(2)),
          sectionSpacing: Number((saved.bodyTextLineHeightPt * item.styleJson.spacingScale).toFixed(2)),
          itemSpacing: Number((saved.bodyTextLineHeightPt * item.styleJson.spacingScale).toFixed(2)),
        },
      })));
      setMessage(ADMIN_TOAST_COPY.saved('全局垂直排版参数'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.saveFailed('全局垂直排版参数'));
    } finally {
      setSavingGlobalSpacing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedItem || !form) {
      return;
    }

    try {
      setSaving(true);
      const payload = {
        templateName: form.templateName,
        description: form.description,
        styleJson: {
          templateCode: selectedItem.templateCode,
          fontFamily: form.fontFamily,
          fontSize: Number(form.fontSize),
          spacingScale: Number(form.spacingScale),
          pageMargin: Number(form.pageMargin),
          themeColor: form.themeColor,
          headerVariant: form.headerVariant,
          basicInfoVariant: form.basicInfoVariant,
          sectionTitleVariant: form.sectionTitleVariant,
          skillVariant: form.skillVariant,
          experienceHeaderVariant: form.experienceHeaderVariant,
          paperBackgroundVariant: form.paperBackgroundVariant,
          paperBackgroundPosition: form.paperBackgroundPosition,
          dateFormat: form.dateFormat,
          titleStyle: form.titleStyle,
          titleSeparator: form.titleSeparator,
          doubleLinePriority: form.doubleLinePriority,
          headerAlign: form.headerAlign,
        },
      };

      const saved = await clientFetch<AdminResumeTemplateConfigItem>(`/admin/resume-template-configs/${selectedItem.templateCode}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setList((prev) => prev.map((item) => (item.templateCode === saved.templateCode ? saved : item)));
      fillForm(saved);
      setMessage(ADMIN_TOAST_COPY.saved('简历模板排版配置'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : ADMIN_TOAST_COPY.saveFailed('简历模板排版配置'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Resume template configs</p>
        <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-ink">简历模板排版配置</h2>
            <p className="mt-2 text-sm text-muted">后台统一维护模板样式参数与全站共享的垂直排版基准，所有简历模板都会复用同一套底层垂直间距标准。</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => selectedItem && fillForm(selectedItem)}
            disabled={!selectedItem || saving}
          >
            恢复当前配置
          </Button>
        </div>
      </section>

      {loading && !list.length ? <Card className="p-8 text-sm text-muted">正在加载模板排版配置...</Card> : null}

      {list.length && globalVerticalSpacingForm ? (
        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
          <Card className="rounded-3xl p-5 xl:sticky xl:top-6 xl:max-h-[calc(100vh-48px)] xl:self-start xl:overflow-y-auto">
            <div>
              <h3 className="text-xl font-semibold text-ink">模板列表</h3>
              <p className="mt-1 text-sm text-muted">选择模板后即可修改模板专属样式；垂直排版参数已改为全站共享，不再跟随单模板单独保存。</p>
            </div>
            <div className="mt-5 space-y-3">
              {list.map((item) => (
                <button
                  key={item.templateCode}
                  type="button"
                  onClick={() => fillForm(item)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selectedTemplateCode === item.templateCode
                      ? 'border-brand bg-brand/5 shadow-card'
                      : 'border-slate-200 hover:border-brand/40 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-ink">{item.templateName}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{item.templateCode}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.description || '未填写模板描述'}</p>
                  <div className="mt-3 text-xs text-slate-400">更新于 {formatDate(item.updatedAt)}</div>
                </button>
              ))}
            </div>
          </Card>

          {form && selectedItem ? (
            <div className="space-y-4">
              <Card className="rounded-3xl border-brand/20 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-ink">全局垂直排版参数</h3>
                    <p className="mt-1 text-sm text-muted">这里维护的是全站统一默认基准。A/B/C 及后续模板、以及前端用户的个性化调节，都会以这套参数为基础生效。</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => globalVerticalSpacing && setGlobalVerticalSpacingForm(toVerticalSpacingFormState(globalVerticalSpacing))}
                    disabled={!globalVerticalSpacing || savingGlobalSpacing}
                  >
                    恢复全局基准
                  </Button>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {verticalSpacingFields.map((field) => (
                    <label key={field.key} className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">{field.label}</span>
                      <Input
                        type="number"
                        step="0.1"
                        value={globalVerticalSpacingForm[field.key]}
                        onChange={(event) => updateVerticalSpacingField(field.key, event.target.value)}
                      />
                      <p className="mt-2 text-xs leading-5 text-slate-500">{field.hint}</p>
                    </label>
                  ))}
                </div>
                <Button className="mt-5" onClick={handleSaveGlobalVerticalSpacing} disabled={savingGlobalSpacing}>
                  {savingGlobalSpacing ? '保存中...' : '保存全局垂直排版参数'}
                </Button>
              </Card>

              <Card className="rounded-3xl p-5">
                <h3 className="text-xl font-semibold text-ink">基础信息</h3>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">模板名称</span>
                    <Input value={form.templateName} onChange={(event) => setForm((prev) => (prev ? { ...prev, templateName: event.target.value } : prev))} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">模板编码</span>
                    <Input value={selectedItem.templateCode} disabled />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-ink">模板描述</span>
                    <Textarea
                      value={form.description}
                      onChange={(event) => setForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
                      className="min-h-[88px]"
                    />
                  </label>
                </div>
              </Card>

              <Card className="rounded-3xl p-5">
                <h3 className="text-xl font-semibold text-ink">样式参数</h3>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Select value={form.fontFamily} onChange={(event) => setForm((prev) => (prev ? { ...prev, fontFamily: event.target.value } : prev))}>
                    {FONT_FAMILY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                  <Input type="color" value={form.themeColor} onChange={(event) => setForm((prev) => (prev ? { ...prev, themeColor: event.target.value } : prev))} />
                  <Input type="number" step="0.1" value={form.fontSize} onChange={(event) => setForm((prev) => (prev ? { ...prev, fontSize: event.target.value } : prev))} placeholder="字号" />
                  <Input type="number" step="0.01" value={form.spacingScale} onChange={(event) => setForm((prev) => (prev ? { ...prev, spacingScale: event.target.value } : prev))} placeholder="整体疏密" />
                  <Input type="number" step="0.1" value={form.pageMargin} onChange={(event) => setForm((prev) => (prev ? { ...prev, pageMargin: event.target.value } : prev))} placeholder="页边距" />
                  <Input value={form.titleSeparator} onChange={(event) => setForm((prev) => (prev ? { ...prev, titleSeparator: event.target.value } : prev))} placeholder="标题分隔符" />
                  <Select value={form.headerAlign} onChange={(event) => setForm((prev) => (prev ? { ...prev, headerAlign: event.target.value } : prev))}>
                    {HEADER_ALIGN_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                  <Select value={form.headerVariant} onChange={(event) => setForm((prev) => (prev ? { ...prev, headerVariant: event.target.value } : prev))}>
                    {RESUME_HEADER_VARIANT_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                  <Select value={form.basicInfoVariant} onChange={(event) => setForm((prev) => (prev ? { ...prev, basicInfoVariant: event.target.value } : prev))}>
                    {RESUME_BASIC_INFO_VARIANT_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                  <Select value={form.sectionTitleVariant} onChange={(event) => setForm((prev) => (prev ? { ...prev, sectionTitleVariant: event.target.value } : prev))}>
                    {RESUME_SECTION_TITLE_VARIANT_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                  <Select value={form.skillVariant} onChange={(event) => setForm((prev) => (prev ? { ...prev, skillVariant: event.target.value } : prev))}>
                    {RESUME_SKILL_VARIANT_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                  <Select
                    value={form.experienceHeaderVariant}
                    onChange={(event) => setForm((prev) => (prev ? { ...prev, experienceHeaderVariant: event.target.value } : prev))}
                  >
                    {RESUME_EXPERIENCE_HEADER_VARIANT_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                  <Select
                    value={form.paperBackgroundVariant}
                    onChange={(event) => setForm((prev) => (prev ? { ...prev, paperBackgroundVariant: event.target.value } : prev))}
                  >
                    {PAPER_BACKGROUND_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                  <Select
                    value={form.paperBackgroundPosition}
                    onChange={(event) => setForm((prev) => (prev ? { ...prev, paperBackgroundPosition: event.target.value } : prev))}
                  >
                    {PAPER_BACKGROUND_POSITION_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                  <Select value={form.dateFormat} onChange={(event) => setForm((prev) => (prev ? { ...prev, dateFormat: event.target.value } : prev))}>
                    {DATE_FORMAT_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                  <Select value={form.titleStyle} onChange={(event) => setForm((prev) => (prev ? { ...prev, titleStyle: event.target.value } : prev))}>
                    {TITLE_STYLE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                  <Select
                    value={form.doubleLinePriority}
                    onChange={(event) => setForm((prev) => (prev ? { ...prev, doubleLinePriority: event.target.value } : prev))}
                  >
                    {DOUBLE_LINE_PRIORITY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </Select>
                </div>
              </Card>
            </div>
          ) : null}

          {form && selectedItem ? (
            <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
              <Card className="rounded-3xl p-5">
                <h3 className="text-lg font-semibold text-ink">参数概览</h3>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-muted">模板名称</p>
                    <p className="mt-2 text-lg font-semibold text-ink">{form.templateName || selectedItem.templateCode}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-muted">最终正文行高</p>
                    <p className="mt-2 text-3xl font-bold text-ink">{computedLineHeight} pt</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-muted">整体疏密 / 页边距</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{form.spacingScale} / {form.pageMargin} mm</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-muted">最后更新时间</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatDate(selectedItem.updatedAt)}</p>
                  </div>
                </div>
                <Button className="mt-5 w-full" onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : '保存模板排版配置'}
                </Button>
              </Card>

              <Card className="rounded-3xl p-5">
                <h3 className="text-lg font-semibold text-ink">联动说明</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>1. 全局垂直排版参数保存后，会成为所有简历模板共享的系统默认基准。</li>
                  <li>2. 当前模板的最终正文行高仍按 `bodyTextLineHeightPt × spacingScale` 计算，但基础行高来自全局公共参数。</li>
                  <li>3. 模板页当前保存的仅是字体、头部、标题、背景等模板专属样式，不再单独保存模板私有垂直间距。</li>
                  <li>4. 历史草稿里用户已保存的个性化样式仍会保留；新建草稿和模板切换则优先继承新的全局基准。</li>
                </ul>
              </Card>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
