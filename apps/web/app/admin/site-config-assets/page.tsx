'use client';

import { useState } from 'react';
import { LoaderCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { requestAdminOssUploadSession, uploadFileToOss } from '@/lib/oss';
import { useGlobalToast } from '@/store/toast-store';

interface UploadedSiteConfigAsset {
  fileName: string;
  contentType: string;
  objectReference: string;
  signedUrl: string;
}

export default function AdminSiteConfigAssetsPage() {
  const [bizId, setBizId] = useState('site-config');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploaded, setUploaded] = useState<UploadedSiteConfigAsset | null>(null);

  useGlobalToast(message, setMessage);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      setUploading(true);
      const session = await requestAdminOssUploadSession({
        scene: 'site-config-file',
        file,
        bizId: bizId.trim() || undefined,
      });
      const result = await uploadFileToOss(session, file);
      setUploaded({
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        objectReference: result.objectReference,
        signedUrl: result.signedUrl,
      });
      setMessage('网站运营配置文件已上传');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '网站运营配置文件上传失败');
    } finally {
      setUploading(false);
    }
  };

  const isImage = uploaded?.contentType.startsWith('image/');

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Admin site config assets</p>
        <div className="mt-2">
          <h2 className="text-3xl font-bold text-ink">网站运营配置文件上传</h2>
          <p className="mt-2 text-sm text-muted">用于上传站点运营配置素材、默认展示图、活动配置文件等私有 OSS 文件，上传后可复制 `oss://` 引用到业务配置中使用。</p>
        </div>
      </section>

      <Card className="rounded-3xl p-6">
        <div className="space-y-4">
          <Input
            value={bizId}
            onChange={(event) => setBizId(event.target.value)}
            placeholder="业务标识，例如：homepage-banner / default-assets"
          />
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-brand hover:bg-brand/10 hover:text-brand">
            {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{uploading ? '上传中...' : '上传网站运营配置文件'}</span>
            <input
              type="file"
              accept="image/*,.pdf,.json,.txt"
              className="hidden"
              onChange={(event) => void handleUpload(event)}
            />
          </label>
        </div>
      </Card>

      {uploaded ? (
        <Card className="rounded-3xl p-6">
          <h3 className="text-lg font-semibold text-ink">上传结果</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>文件名：{uploaded.fileName}</p>
            <p>对象引用：{uploaded.objectReference}</p>
            <p className="break-all">临时访问地址：{uploaded.signedUrl}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={() => navigator.clipboard.writeText(uploaded.objectReference)}>复制对象引用</Button>
            <Button type="button" variant="secondary" onClick={() => window.open(uploaded.signedUrl, '_blank', 'noopener,noreferrer')}>打开临时链接</Button>
          </div>
          {isImage ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploaded.signedUrl} alt={uploaded.fileName} className="h-auto max-w-full rounded-2xl" />
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
