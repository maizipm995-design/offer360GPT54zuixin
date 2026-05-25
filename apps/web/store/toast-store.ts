'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

const TOAST_DURATION_MS = 5000;
export type ToastType = 'success' | 'info' | 'warning' | 'error';

const TOAST_KEYWORDS = {
  error: [
    '失败',
    '错误',
    '异常',
    '无权限',
    '权限不足',
    '未授权',
    '已关闭',
    '已取消',
    '不存在',
    '失效',
    '超时',
    '拒绝',
    'unauthorized',
    'forbidden',
    'not found',
    'invalid',
    'failed',
    'error',
  ],
  warning: [
    '请输入',
    '请选择',
    '请先填写',
    '请先补充',
    '请补全',
    '请先选择',
    '最多',
    '至少',
    '不能',
    '不正确',
    '勾选',
    '超出',
    '格式',
    '建议',
  ],
  success: [
    '成功',
    '已保存',
    '已发送',
    '已复制',
    '已开通',
    '已完成',
    '完成',
    '已恢复',
    '已更新',
    '已同步',
    '已开始下载',
    '已支付',
    '已新建',
    '已上传',
    '已生效',
    '已为你适配',
    '自动保存',
  ],
  info: [
    '请先登录',
    '请登录后',
    '请稍候',
    '正在',
    '加载中',
    '保存中',
    '已发起',
    '无需重复',
    '已开启',
    '开发环境未接短信通道',
    '后台执行',
    '后台完成后会自动刷新结果',
  ],
} as const;

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
}

function createToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function includesKeyword(message: string, keywords: readonly string[]) {
  return keywords.some((keyword) => message.includes(keyword));
}

export function resolveToastType(message: string, type?: ToastType): ToastType {
  if (type) {
    return type;
  }

  const content = message.trim().toLowerCase();
  if (!content) {
    return 'info';
  }

  if (includesKeyword(content, TOAST_KEYWORDS.error)) {
    return 'error';
  }
  if (includesKeyword(content, TOAST_KEYWORDS.info)) {
    return 'info';
  }
  if (includesKeyword(content, TOAST_KEYWORDS.warning)) {
    return 'warning';
  }
  if (includesKeyword(content, TOAST_KEYWORDS.success)) {
    return 'success';
  }
  return 'info';
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, type) => {
    const content = message.trim();
    if (!content) return;

    const id = createToastId();
    set((state) => ({
      toasts: [...state.toasts, { id, message: content, type: resolveToastType(content, type) }],
    }));

    globalThis.setTimeout(() => {
      get().dismiss(id);
    }, TOAST_DURATION_MS);
  },
  dismiss: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((item) => item.id !== id),
    }));
  },
}));

export function showToast(message: string, type?: ToastType) {
  const content = message.trim();
  useToastStore.getState().push(content, resolveToastType(content, type));
}

export function showSuccessToast(message: string) {
  showToast(message, 'success');
}

export function showInfoToast(message: string) {
  showToast(message, 'info');
}

export function showWarningToast(message: string) {
  showToast(message, 'warning');
}

export function showErrorToast(message: string) {
  showToast(message, 'error');
}

export function useGlobalToast(
  message?: string | null,
  clear?: React.Dispatch<React.SetStateAction<string>>,
  type?: ToastType,
) {
  useEffect(() => {
    const content = message?.trim();
    if (!content) return;

    showToast(content, resolveToastType(content, type));
    clear?.('');
  }, [message, clear, type]);
}
