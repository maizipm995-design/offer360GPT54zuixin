'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth-store';

interface ServicePurchaseActionsProps {
  serviceId: string;
}

export function ServicePurchaseActions({ serviceId }: ServicePurchaseActionsProps) {
  const router = useRouter();
  const { token } = useAuthStore();
  const [jumpingToCheckout, setJumpingToCheckout] = useState(false);

  useEffect(() => {
    router.prefetch('/checkout');
    router.prefetch('/login');
    router.prefetch('/services');
  }, [router]);

  const handleBuy = async () => {
    setJumpingToCheckout(true);
    const nextPath = token
      ? `/checkout?productId=${encodeURIComponent(serviceId)}`
      : `/login?redirect=${encodeURIComponent(`/services/${encodeURIComponent(serviceId)}`)}`;
    router.push(nextPath);
  };

  return (
    <div className="flex flex-wrap gap-3 lg:justify-end">
      <Button onClick={() => void handleBuy()} disabled={jumpingToCheckout}>
        {jumpingToCheckout ? '跳转中...' : '立即支付'}
      </Button>
      <Button variant="secondary" onClick={() => router.push('/services')}>
        返回服务列表
      </Button>
    </div>
  );
}
