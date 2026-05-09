'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { clientFetch } from '@/lib/api';
import { requestAdminOssUploadSession, uploadFileToOss } from '@/lib/oss';
import { formatDate } from '@/lib/utils';
import { useGlobalToast } from '@/store/toast-store';
import { AdminCareerJourneyContentItem } from '@/types';

export default function AdminCareerJourneyContentPage() {
  const [content, setContent] = useState<AdminCareerJourneyContentItem | null>(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState('');

  useGlobalToast(message, setMessage);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await clientFetch<AdminCareerJourneyContentItem>('/admin/career-journey-content');
        setContent(result);
        setHtmlContent(result.htmlContent);
        setPreviewHtml(result.previewHtml || result.htmlContent);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '我的求职之路内容加载失败');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await clientFetch<AdminCareerJourneyContentItem>('/admin/career-journey-content', {
        method: 'PATCH',
        body: JSON.stringify({ htmlContent }),
      });
      setContent(result);
      setHtmlContent(result.htmlContent);
      setPreviewHtml(result.previewHtml || result.htmlContent);
      setMessage('我的求职之路内容已保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '我的求职之路内容保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      setUploadingImage(true);
      const session = await requestAdminOssUploadSession({
        scene: 'career-journey-content-image',
        file,
        bizId: content?.id || content?.slug || undefined,
      });
      const uploaded = await uploadFileToOss(session, file);
      setHtmlContent((prev) => appendHtmlImage(prev, uploaded.objectReference, file.name));
      setPreviewHtml((prev) => appendHtmlImage(prev || htmlContent, uploaded.signedUrl || uploaded.objectReference, file.name));
      setMessage('求职之路图片已上传并插入 HTML');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '求职之路图片上传失败');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin career journey content</p>
        <h2 className="mt-2 text-3xl font-bold text-ink">我的求职之路</h2>
        <p className="mt-2 text-sm text-muted">这里维护整篇文章的 HTML 富文本内容。前端页面不会写死标题、章节或段落结构，只会按你保存的 HTML 原样渲染。</p>
      </section>

      {loading && !content ? <Card className="p-8 text-sm text-muted">正在加载我的求职之路内容...</Card> : null}

      {content ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-ink">HTML 富文本编辑区</h3>
                <p className="mt-1 text-sm text-muted">支持直接粘贴完整 HTML，自由编排页面标题、章节、小标题、图片与正文结构。</p>
              </div>
              <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存内容'}</Button>
            </div>

            <Textarea
              placeholder="请输入完整 HTML 内容"
              value={htmlContent}
              onChange={(e) => {
                setHtmlContent(e.target.value);
                setPreviewHtml(e.target.value);
              }}
              className="mt-5 min-h-[520px] font-mono text-xs leading-6"
            />
            <label className="mt-4 inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-brand hover:bg-brand/10 hover:text-brand">
              {uploadingImage ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span>{uploadingImage ? '上传中...' : '上传图片并插入 HTML'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleUploadImage(event)} />
            </label>
          </Card>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card className="rounded-3xl p-5">
              <h3 className="text-lg font-semibold text-ink">页面信息</h3>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>固定标识：{content.slug}</p>
                <p>最后更新时间：{formatDate(content.updatedAt)}</p>
              </div>
            </Card>

            <Card className="rounded-3xl p-5">
              <h3 className="text-lg font-semibold text-ink">实时预览</h3>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="rich-html-content text-sm" dangerouslySetInnerHTML={{ __html: previewHtml || htmlContent || '<p>请输入 HTML 富文本内容</p>' }} />
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
