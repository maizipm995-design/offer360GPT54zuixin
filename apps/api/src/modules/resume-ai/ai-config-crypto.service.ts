import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '../../config/env';

@Injectable()
export class AiConfigCryptoService {
  encryptApiKey(apiKey: string) {
    const normalized = apiKey.trim();
    if (!normalized) {
      throw new InternalServerErrorException('AI API Key 为空，无法加密');
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.getSecretKey(), iv);
    const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
    return `${iv.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decryptApiKey(encryptedValue: string) {
    if (!encryptedValue.trim()) {
      throw new InternalServerErrorException('AI API Key 缺失，无法解密');
    }

    const [ivBase64, payloadBase64] = encryptedValue.split(':');
    if (!ivBase64 || !payloadBase64) {
      throw new InternalServerErrorException('AI API Key 加密格式无效');
    }

    const decipher = createDecipheriv(
      'aes-256-cbc',
      this.getSecretKey(),
      Buffer.from(ivBase64, 'base64'),
    );
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadBase64, 'base64')),
      decipher.final(),
    ]).toString('utf8');

    if (!decrypted.trim()) {
      throw new InternalServerErrorException('AI API Key 解密结果为空');
    }

    return decrypted;
  }

  maskApiKey(apiKey: string) {
    const normalized = apiKey.trim();
    if (normalized.length <= 8) {
      return `${normalized.slice(0, 2)}****${normalized.slice(-2)}`;
    }
    return `${normalized.slice(0, 4)}****${normalized.slice(-4)}`;
  }

  private getSecretKey() {
    const secret = env.aiConfigSecret.trim();
    if (!secret) {
      throw new InternalServerErrorException('AI_CONFIG_SECRET 未配置，无法处理 AI 配置密钥');
    }
    return createHash('sha256').update(secret).digest();
  }
}
