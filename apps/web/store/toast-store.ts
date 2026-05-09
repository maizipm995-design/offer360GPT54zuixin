'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';
import { create } from 'zustand';

const TOAST_DURATION_MS = 5000;
export type ToastType = 'success' | 'error';

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

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, type = 'error') => {
    const content = message.trim();
    if (!content) return;

    const id = createToastId();
    set((state) => ({
      toasts: [...state.toasts, { id, message: content, type }],
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
  const resolvedType = type || (
    (content.includes('成功') || content.includes('完成') || content.includes('已发送') || content.includes('开始下载') || content.includes('已保存'))
      ? 'success'
      : 'error'
  );
  useToastStore.getState().push(content, resolvedType);
}

export function useGlobalToast(
  message?: string | null,
  clear?: React.Dispatch<React.SetStateAction<string>>,
  type?: ToastType,
) {
  useEffect(() => {
    const content = message?.trim();
    if (!content) return;

    // 如果未显式传入 type，则根据文案关键词智能判定类型
    const resolvedType = type || (
      (content.includes('成功') || content.includes('完成') || content.includes('已发送') || content.includes('开始下载'))
        ? 'success'
        : 'error'
    );

    showToast(content, resolvedType);
    clear?.('');
  }, [message, clear, type]);
}
