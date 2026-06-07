'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MemberAccessDialog } from '@/components/membership/member-access-dialog';
import { useAuthStore } from '@/store/auth-store';

type PracticeAccessCopy = {
  guestMessage?: string;
  memberMessage?: string;
};

type AccessDialogState = {
  title: string;
  message: string;
  confirmText: string;
  action: 'login' | 'membership';
};

export function useCampusExamAccess(redirectPath?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [dialog, setDialog] = useState<AccessDialogState | null>(null);

  const resolvedRedirectPath = useMemo(() => {
    if (redirectPath) {
      return redirectPath;
    }
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, redirectPath, searchParams]);

  const openLoginDialog = useCallback((message: string) => {
    setDialog({
      title: '登录后可用',
      message,
      confirmText: '去登录/注册',
      action: 'login',
    });
  }, []);

  const openMembershipDialog = useCallback((message: string) => {
    setDialog({
      title: '会员权限提醒',
      message,
      confirmText: '去开通会员',
      action: 'membership',
    });
  }, []);

  const ensureLoginAccess = useCallback((message?: string) => {
    if (token) {
      return true;
    }
    openLoginDialog(message ?? '该功能需登录或注册后使用，请先完成账号登录。');
    return false;
  }, [openLoginDialog, token]);

  const ensurePracticeAccess = useCallback((copy?: PracticeAccessCopy) => {
    if (!token) {
      openLoginDialog(copy?.guestMessage ?? '该功能需登录或注册后使用，请先完成账号登录。');
      return false;
    }
    if (!user || !user.isMember || user.memberRoleCode === 'FREE_USER') {
      openMembershipDialog(copy?.memberMessage ?? '该功能需开通标准会员或超级会员后使用。');
      return false;
    }
    return true;
  }, [openLoginDialog, openMembershipDialog, token, user]);

  const accessDialog = (
    <MemberAccessDialog
      open={Boolean(dialog)}
      title={dialog?.title}
      message={dialog?.message ?? ''}
      confirmText={dialog?.confirmText}
      onClose={() => setDialog(null)}
      onConfirm={() => {
        const currentDialog = dialog;
        setDialog(null);
        if (!currentDialog) {
          return;
        }
        if (currentDialog.action === 'login') {
          router.push(`/login?redirect=${encodeURIComponent(resolvedRedirectPath)}`);
          return;
        }
        router.push('/membership');
      }}
    />
  );

  return {
    token,
    user,
    ensureLoginAccess,
    ensurePracticeAccess,
    accessDialog,
  };
}
