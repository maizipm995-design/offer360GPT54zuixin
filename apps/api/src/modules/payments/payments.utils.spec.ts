import { describe, expect, it } from 'vitest';
import {
  detectWechatPayScene,
  pickWechatCallbackBaseUrl,
  resolveRequestedWechatPayScene,
} from './payments.utils';

describe('detectWechatPayScene', () => {
  it('优先尊重显式指定的支付场景', () => {
    expect(detectWechatPayScene('Mozilla/5.0', 'jsapi')).toBe('jsapi');
    expect(detectWechatPayScene('Mozilla/5.0', 'h5')).toBe('h5');
    expect(detectWechatPayScene('Mozilla/5.0', 'native')).toBe('native');
  });

  it('在移动端微信浏览器中返回 jsapi', () => {
    expect(
      detectWechatPayScene(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.55',
      ),
    ).toBe('jsapi');
  });

  it('在手机普通浏览器中返回 h5', () => {
    expect(
      detectWechatPayScene(
        'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('h5');
  });

  it('在桌面端微信或普通浏览器中保留 native 扫码支付', () => {
    expect(
      detectWechatPayScene(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 MicroMessenger/7.0.20',
      ),
    ).toBe('native');
    expect(
      detectWechatPayScene(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      ),
    ).toBe('native');
  });

  it('在缺少环境信息时不强制推断场景', () => {
    expect(resolveRequestedWechatPayScene()).toBeNull();
    expect(resolveRequestedWechatPayScene('', '')).toBeNull();
  });

  it('优先使用回调专用域名生成微信 OAuth 回调地址', () => {
    expect(
      pickWechatCallbackBaseUrl('https://pay.offer360.cn/', 'https://www.offer360.cn/'),
    ).toBe('https://pay.offer360.cn');
    expect(
      pickWechatCallbackBaseUrl('', 'https://www.offer360.cn/'),
    ).toBe('https://www.offer360.cn');
  });
});
