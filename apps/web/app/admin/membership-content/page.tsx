'use client';

import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Upload } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { clientFetch } from '@/lib/api';
import { requestAdminOssUploadSession, uploadFileToOss } from '@/lib/oss';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminHtmlContentItem, AdminHtmlContentPosition, HtmlContentLocationCode } from '@/types';

const DEFAULT_LOCATION: HtmlContentLocationCode = 'membership-benefits';

export default function AdminMembershipContentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [positions, setPositions] = useState<AdminHtmlContentPosition[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<HtmlContentLocationCode>(DEFAULT_LOCATION);
  const [content, setContent] = useState<AdminHtmlContentItem | null>(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [loadingContent, setLoadingContent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState('');

  useGlobalToast(message, setMessage);

  const selectedPosition = useMemo(
    () => positions.find((item) => item.code === selectedLocation) ?? null,
    [positions, selectedLocation],
  );

  useEffect(() => {
    const loadPositions = async () => {
      try {
        setLoadingPositions(true);
        const result = await clientFetch<AdminHtmlContentPosition[]>('/admin/html-content-positions');
        setPositions(result);
        const locationFromQuery = searchParams.get('location');
        const nextLocation =
          result.find((item) => item.code === locationFromQuery)?.code ??
          result[0]?.code ??
          DEFAULT_LOCATION;
        setSelectedLocation(nextLocation);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'HTML 内容位置加载失败');
      } finally {
        setLoadingPositions(false);
      }
    };

    void loadPositions();
  }, [searchParams, setMessage]);

  useEffect(() => {
    if (!selectedLocation) {
      return;
    }

    const loadContent = async () => {
      try {
        setLoadingContent(true);
        const result = await clientFetch<AdminHtmlContentItem>(`/admin/html-content-positions/${selectedLocation}`);
        setContent(result);
        setHtmlContent(result.htmlContent);
        setPreviewHtml(result.previewHtml || result.htmlContent);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'HTML 内容加载失败');
      } finally {
        setLoadingContent(false);
      }
    };

    void loadContent();
  }, [selectedLocation, setMessage]);

  const handleSelectLocation = (nextLocation: HtmlContentLocationCode) => {
    setSelectedLocation(nextLocation);
    router.replace(`/admin/membership-content?location=${encodeURIComponent(nextLocation)}`);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await clientFetch<AdminHtmlContentItem>(`/admin/html-content-positions/${selectedLocation}`, {
        method: 'PATCH',
        body: JSON.stringify({ htmlContent }),
      });
      setContent(result);
      setHtmlContent(result.htmlContent);
      setPreviewHtml(result.previewHtml || result.htmlContent);
      setMessage(`${result.locationLabel}已保存`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'HTML 内容保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedPosition) {
      return;
    }

    try {
      setUploadingImage(true);
      const session = await requestAdminOssUploadSession({
        scene: selectedPosition.uploadScene,
        file,
        bizId: content?.id || selectedLocation,
      });
      const uploaded = await uploadFileToOss(session, file);
      setHtmlContent((prev) => appendHtmlImage(prev, uploaded.objectReference, file.name));
      setPreviewHtml((prev) => appendHtmlImage(prev || htmlContent, uploaded.signedUrl || uploaded.objectReference, file.name));
      setMessage(`${selectedPosition.label}图片已上传并插入 HTML`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '图片上传失败');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin html content</p>
        <h2 className="mt-2 text-3xl font-bold text-ink">HTML 通用内容管理</h2>
        <p className="mt-2 text-sm text-muted">
          后台统一维护前端固定展示位置的 HTML 富文本内容。系统会根据展示位置自动绑定数据，不再手动填写 slug 或标题。
        </p>
      </section>

      {loadingPositions ? <Card className="p-8 text-sm text-muted">正在加载内容位置...</Card> : null}

      {!loadingPositions && selectedPosition ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="rounded-3xl p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-ink">HTML 富文本编辑区</h3>
                <p className="mt-1 text-sm text-muted">先选择前端展示位置，再维护该位置的 HTML 内容，保存后前端会按对应位置精准展示。</p>
              </div>
              <Button onClick={handleSave} disabled={saving || loadingContent}>
                {saving ? '保存中...' : '保存内容'}
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-ink">展示位置</p>
                <Select value={selectedLocation} onChange={(event) => handleSelectLocation(event.target.value as HtmlContentLocationCode)}>
                  {positions.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-2 text-xs text-slate-500">{selectedPosition.description}</p>
              </div>

              <Textarea
                placeholder="请输入完整 HTML 内容"
                value={htmlContent}
                onChange={(event) => {
                  setHtmlContent(event.target.value);
                  setPreviewHtml(event.target.value);
                }}
                className="min-h-[520px] font-mono text-xs leading-6"
                disabled={loadingContent}
              />

              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-brand hover:bg-brand/10 hover:text-brand">
                {uploadingImage ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span>{uploadingImage ? '上传中...' : '上传图片并插入 HTML'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleUploadImage(event)} />
              </label>
            </div>
          </Card>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card className="rounded-3xl p-5">
              <h3 className="text-lg font-semibold text-ink">位置说明</h3>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>展示位置：{selectedPosition.label}</p>
                <p>系统标识：{selectedPosition.slug}</p>
                <p>最后更新时间：{content ? formatDate(content.updatedAt) : loadingContent ? '加载中...' : '-'}</p>
              </div>
            </Card>

            <Card className="rounded-3xl p-5">
              <h3 className="text-lg font-semibold text-ink">实时预览</h3>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div
                  className="rich-html-content membership-rich-content text-sm"
                  dangerouslySetInnerHTML={{ __html: previewHtml || htmlContent || '<p>请输入 HTML 富文本内容</p>' }}
                />
              </div>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function appendHtmlImage(html: string, src: string, alt: string) {
  const imageBlock = `\n<p><img src="${src}" alt="${escapeHtmlAttribute(alt)}" /></p>`;
  return `${html.trim()}${imageBlock}`.trim();
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
