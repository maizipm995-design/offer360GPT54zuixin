'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CampusExamAdminNav } from '@/components/admin/campus-exam-admin-nav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { downloadFilePayload } from '@/lib/admin';
import type {
  CampusExamAdminImportConfirmResult,
  CampusExamAdminImportPreviewResult,
  CampusExamAdminSpecialDetail,
} from '@/lib/campus-exam';
import { clientFetch, clientUpload } from '@/lib/api';
import type { AdminFileDownloadPayload } from '@/types';
import { formatDate } from '@/lib/utils';

const MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024;
const richPreviewClassName = '[&_img]:my-3 [&_img]:max-h-64 [&_img]:rounded-2xl [&_img]:border [&_img]:border-slate-200 [&_img]:object-contain [&_p]:leading-7 [&_p+_p]:mt-3';

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function CampusExamAdminSpecialDetailPage() {
  const params = useParams<{ specialId: string }>();
  const [detail, setDetail] = useState<CampusExamAdminSpecialDetail | null>(null);
  const [previewResult, setPreviewResult] = useState<CampusExamAdminImportPreviewResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<CampusExamAdminImportConfirmResult | null>(null);
  const [overwritePolicy, setOverwritePolicy] = useState('skip_existing');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const specialId = Number(params.specialId);

  const loadDetail = async () => {
    try {
      setLoading(true);
      const result = await clientFetch<CampusExamAdminSpecialDetail>(`/admin/campus-exam/specials/${specialId}`);
      setDetail(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '专项详情加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!specialId) return;
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialId]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setMessage('请上传 .xlsx 或 .xls 格式的 Excel 文件');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      setMessage(`Excel 文件不能超过 ${formatFileSize(MAX_IMPORT_FILE_SIZE)}`);
      event.target.value = '';
      return;
    }
    setSelectedFile(file);
    setPreviewResult(null);
    setConfirmResult(null);
    setMessage(`已选择 ${file.name}`);
  };

  const handleTemplateDownload = async () => {
    try {
      setDownloadingTemplate(true);
      const payload = await clientFetch<AdminFileDownloadPayload>('/admin/campus-exam/specials/import/template');
      downloadFilePayload(payload);
      setMessage('模板下载完成，请严格按 12 个标准字段填写');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '模板下载失败');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const openFilePicker = () => {
    const input = inputRef.current;
    if (!input) {
      setMessage('文件选择器初始化失败，请刷新页面后重试');
      return;
    }
    input.value = '';
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      // 回退到 click，兼容不支持或受限的浏览器环境
    }
    input.click();
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      setMessage('请先选择 Excel 文件');
      return;
    }
    try {
      setUploading(true);
      setMessage('正在上传并执行预览校验...');
      const formData = new FormData();
      formData.append('file', selectedFile);
      const result = await clientUpload<CampusExamAdminImportPreviewResult>(
        `/admin/campus-exam/specials/${specialId}/import/preview`,
        formData,
      );
      setPreviewResult(result);
      setConfirmResult(null);
      setMessage('预览完成，可以继续正式导入');
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Excel 预览失败');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!previewResult?.batchId) {
      setMessage('请先完成 Excel 预览');
      return;
    }
    try {
      setConfirming(true);
      const result = await clientFetch<CampusExamAdminImportConfirmResult>(
        `/admin/campus-exam/specials/${specialId}/import/confirm`,
        {
          method: 'POST',
          body: JSON.stringify({
            batchId: previewResult.batchId,
            overwritePolicy,
          }),
        },
      );
      setConfirmResult(result);
      setMessage('正式导入完成');
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '正式导入失败');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Campus exam admin</p>
        <div className="mt-2">
          <h2 className="text-3xl font-bold text-ink">二级分类详情与题库导入</h2>
          <p className="mt-2 text-sm text-muted">这一页承接专项上下文、导入规则说明、Excel 预览和正式导入主流程。</p>
        </div>
        <div className="mt-4">
          <CampusExamAdminNav />
        </div>
      </section>

      {message ? <Card className="p-4 text-sm text-slate-600">{message}</Card> : null}

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-brand">专项上下文</p>
              <h3 className="mt-2 text-2xl font-semibold text-ink">{detail?.name ?? '专项详情'}</h3>
              <p className="mt-1 text-sm text-slate-500">{detail?.categoryName}</p>
            </div>
            <Link href="/admin/campus-exam/specials">
              <Button variant="secondary">返回专项列表</Button>
            </Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">专项 ID</p>
              <p className="mt-2 text-xl font-semibold text-ink">{detail?.id ?? '-'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">当前题量</p>
              <p className="mt-2 text-xl font-semibold text-ink">{detail?.questionCount ?? 0}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">导入规则提醒</p>
            <p className="mt-2">1. Excel 需严格使用 12 列标准模板，列名与顺序必须一致。</p>
            <p className="mt-1">2. 当前上传上下文的 `分类专项id` 必须严格等于 {detail?.id ?? specialId}。</p>
            <p className="mt-1">3. 题目、选项、解析支持富文本 HTML，若内容里直接出现图片 URL，展示时会自动转成图片。</p>
            <p className="mt-1">4. 预览只校验不正式落库，确认导入时会执行资源转存并写入题库。</p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold text-ink">上传 Excel 预览</h3>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-ink">当前文件</p>
            <p className="mt-2 break-all">{selectedFile ? `${selectedFile.name} (${formatFileSize(selectedFile.size)})` : '尚未选择文件'}</p>
            <p className="mt-2 text-xs text-slate-500">支持 `.xlsx / .xls`，单文件上限 {formatFileSize(MAX_IMPORT_FILE_SIZE)}。</p>
            <p className="mt-2 text-xs text-slate-500">模板列顺序：题目、题型、题目类型、分类专项id、难度、是否高频错题、选项、选项类型、答案、题目解析、题目图片链接、解析图片链接。</p>
            <p className="mt-1 text-xs text-slate-500">富文本选项支持模板里的 `|||` 分隔写法，也兼容英文分号分隔。</p>
          </div>
          <input
            id="campus-exam-import-file"
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            onChange={handleFileChange}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void handleTemplateDownload()} disabled={downloadingTemplate || uploading || confirming}>
              {downloadingTemplate ? '模板下载中...' : '下载导入模板'}
            </Button>
            <Button variant="secondary" onClick={openFilePicker} disabled={downloadingTemplate || uploading || confirming}>
              {selectedFile ? '重新选择文件' : '选择 Excel 文件'}
            </Button>
            <Button onClick={() => void handlePreview()} disabled={!selectedFile || uploading || confirming}>
              {uploading ? '预览中...' : '开始预览'}
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">正式导入覆盖策略</span>
              <Select value={overwritePolicy} onChange={(event) => setOverwritePolicy(event.target.value)}>
                <option value="skip_existing">跳过已存在题目</option>
                <option value="replace_existing">覆盖已存在题目</option>
                <option value="fail_on_duplicate">遇到重复立即失败</option>
              </Select>
            </label>
            <Button className="w-full" onClick={() => void handleConfirm()} disabled={!previewResult?.batchId || confirming || uploading}>
              {confirming ? '正式导入中...' : '确认正式导入'}
            </Button>
          </div>
        </Card>
      </section>

      {previewResult ? (
        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="p-6">
            <h3 className="text-xl font-semibold text-ink">预览结果</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">总行数</p>
                <p className="mt-2 text-xl font-semibold text-ink">{previewResult.totalCount}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">成功 / 失败</p>
                <p className="mt-2 text-xl font-semibold text-ink">{previewResult.successCount} / {previewResult.failCount}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">图片校验错误</p>
                <p className="mt-2 text-xl font-semibold text-ink">{previewResult.summary.imageValidationErrors}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">答案格式错误</p>
                <p className="mt-2 text-xl font-semibold text-ink">{previewResult.summary.answerFormatErrors}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-xl font-semibold text-ink">正式导入结果</h3>
            {confirmResult ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">导入成功</p>
                  <p className="mt-2 text-xl font-semibold text-ink">{confirmResult.importedCount}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">跳过 / 失败</p>
                  <p className="mt-2 text-xl font-semibold text-ink">{confirmResult.skippedCount} / {confirmResult.failedCount}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                  <p className="text-xs text-slate-500">状态</p>
                  <p className="mt-2 text-xl font-semibold text-ink">{confirmResult.status}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">完成预览后，这里展示正式导入与 OSS 转存的执行结果。</p>
            )}
          </Card>
        </section>
      ) : null}

      {previewResult?.previewRows?.length ? (
        <section>
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-ink">字段预览样例</h3>
                <p className="mt-2 text-sm text-slate-500">
                  已按导入规则标准化展示 {previewResult.previewRows.length} 条
                  {previewResult.previewRowsTruncated ? ` / ${previewResult.previewRowCount} 条样例` : '预览记录'}
                  ，用于核对题型、答案、富文本和图片字段是否与模板一致。
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {previewResult.previewRows.map((row) => (
                <div key={row.sourceRowNo} className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-brand/10 px-3 py-1 text-brand">第 {row.sourceRowNo} 行</span>
                    <span>{row.questionTypeLabel}</span>
                    <span>专项 ID {row.specialId}</span>
                    <span>难度 {row.difficulty}</span>
                    <span>{row.isHighFrequencyWrong ? '高频错题' : '非高频错题'}</span>
                    <span>题目类型 {row.stemContentType}</span>
                    <span>选项类型 {row.optionContentType}</span>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">题目正文</p>
                      <div className={`mt-3 text-sm text-ink ${richPreviewClassName}`} dangerouslySetInnerHTML={{ __html: row.stemHtml }} />
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">标准答案</p>
                      <p className="mt-3 text-sm text-ink">{row.answerJson.values.join(' / ') || '-'}</p>
                      <p className="mt-4 text-xs font-medium text-slate-500">解析</p>
                      {row.analysisHtml ? (
                        <div className={`mt-3 text-sm text-ink ${richPreviewClassName}`} dangerouslySetInnerHTML={{ __html: row.analysisHtml }} />
                      ) : (
                        <p className="mt-3 text-sm text-slate-400">未填写解析</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">选项内容</p>
                      {row.optionsJson?.length ? (
                        <div className="mt-3 space-y-3">
                          {row.optionsJson.map((option) => (
                            <div key={`${row.sourceRowNo}-${option.key}`} className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="text-xs font-medium text-slate-500">{option.label}</p>
                              <div className={`mt-2 text-sm text-ink ${richPreviewClassName}`} dangerouslySetInnerHTML={{ __html: option.value }} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-400">当前题型无选项字段</p>
                      )}
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                      <p className="text-xs font-medium text-slate-500">独立图片链接字段</p>
                      <p className="mt-3 break-all">题目图片：{row.questionImageUrl || '未填写'}</p>
                      <p className="mt-2 break-all">解析图片：{row.analysisImageUrl || '未填写'}</p>
                      <p className="mt-4 text-xs font-medium text-slate-500">导入状态</p>
                      <p className="mt-2">{row.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-ink">预览错误明细</h3>
            {previewResult?.batchId ? (
              <Link href={`/admin/campus-exam/import-batches?batchId=${previewResult.batchId}`} className="text-sm font-medium text-brand hover:underline">
                查看批次页
              </Link>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {(previewResult?.errors ?? []).map((item) => (
              <div key={`${item.rowNo}-${item.errorCode}-${item.fieldName}`} className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                <p className="font-medium">第 {item.rowNo} 行 · {item.fieldName}</p>
                <p className="mt-2">{item.errorMessage}</p>
                <p className="mt-1 text-xs text-rose-500">{item.errorCode}</p>
              </div>
            ))}
            {!previewResult?.errors?.length ? (
              <p className="text-sm text-slate-500">预览后未发现字段级错误。</p>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold text-ink">最近导入批次</h3>
          <div className="mt-4 space-y-3">
            {(detail?.latestImportBatches ?? []).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-ink">{item.fileName}</p>
                  <span className="text-xs text-slate-500">{item.status}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">总 {item.totalCount} / 成功 {item.successCount} / 失败 {item.failCount}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDate(item.createdAt)}</p>
              </div>
            ))}
            {!detail?.latestImportBatches?.length ? (
              <p className="text-sm text-slate-500">当前专项还没有导入记录。</p>
            ) : null}
          </div>
        </Card>
      </section>

      {loading ? <Card className="p-6 text-sm text-slate-500">专项详情加载中...</Card> : null}
    </div>
  );
}
