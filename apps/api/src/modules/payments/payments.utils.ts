import type { WechatPayScene } from './wechat-gateway.client';

const MOBILE_USER_AGENT_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|HarmonyOS/i;
const WECHAT_USER_AGENT_PATTERN = /MicroMessenger/i;

export function detectWechatPayScene(userAgent?: string, scene?: string | null): WechatPayScene {
  const normalizedScene = String(scene || '').trim().toLowerCase();
  if (normalizedScene === 'jsapi' || normalizedScene === 'h5' || normalizedScene === 'native') {
    return normalizedScene;
  }

  const ua = String(userAgent || '').trim();
  const isMobile = MOBILE_USER_AGENT_PATTERN.test(ua);
  const isWechat = WECHAT_USER_AGENT_PATTERN.test(ua);

  if (isWechat && isMobile) {
    return 'jsapi';
  }

  if (isMobile) {
    return 'h5';
  }

  return 'native';
}

export function resolveRequestedWechatPayScene(userAgent?: string, scene?: string | null) {
  const normalizedScene = String(scene || '').trim().toLowerCase();
  const normalizedUserAgent = String(userAgent || '').trim();

  if (!normalizedUserAgent && !normalizedScene) {
    return null;
  }

  return detectWechatPayScene(normalizedUserAgent, normalizedScene);
}

export function pickWechatCallbackBaseUrl(callbackBaseUrl?: string | null, publicBaseUrl?: string | null) {
  const callbackBase = String(callbackBaseUrl || '').trim().replace(/\/$/, '');
  if (callbackBase) {
    return callbackBase;
  }

  return String(publicBaseUrl || '').trim().replace(/\/$/, '');
}
