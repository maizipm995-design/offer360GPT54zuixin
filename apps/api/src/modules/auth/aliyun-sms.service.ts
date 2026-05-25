import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';
import * as $Util from '@alicloud/tea-util';
import { env } from '../../config/env';

interface SmsSendResult {
  requestId: string;
  bizId: string;
  code: string;
  deliveryMode: 'aliyun' | 'mock';
  debugCode?: string;
}

@Injectable()
export class AliyunSmsService {
  private client: Dysmsapi20170525 | null = null;

  private getClient() {
    if (this.client) {
      return this.client;
    }

    const config = new $OpenApi.Config({
      accessKeyId: env.aliyunSmsAccessKeyId,
      accessKeySecret: env.aliyunSmsAccessKeySecret,
      endpoint: env.aliyunSmsEndpoint,
    });

    this.client = new Dysmsapi20170525(config);
    return this.client;
  }

  async sendVerificationCode(phone: string, code: string) {
    const hasSmsConfig = Boolean(
      env.aliyunSmsAccessKeyId
      && env.aliyunSmsAccessKeySecret
      && env.aliyunSmsSignName
      && env.aliyunSmsTemplateCode
      && env.aliyunSmsTemplateParamName,
    );

    if (!hasSmsConfig) {
      if (env.nodeEnv !== 'development') {
        throw new ServiceUnavailableException('短信服务未配置');
      }
      console.log(`[Mock SMS] Sending verification code ${code} to ${phone}`);
      return {
        requestId: 'mock-request-id',
        bizId: 'mock-biz-id',
        code: 'OK',
        deliveryMode: 'mock',
        debugCode: code,
      } satisfies SmsSendResult;
    }

    const client = this.getClient();
    const templateParam = JSON.stringify({
      [env.aliyunSmsTemplateParamName]: code,
    });

    const request = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phone,
      signName: env.aliyunSmsSignName,
      templateCode: env.aliyunSmsTemplateCode,
      templateParam,
    });

    const runtime = new $Util.RuntimeOptions({});
    const response = await client.sendSmsWithOptions(request, runtime);
    const responseCode = response.body?.code?.trim();

    if (responseCode !== 'OK') {
      throw new ServiceUnavailableException(response.body?.message?.trim() || '阿里云短信发送失败');
    }

    return {
      requestId: response.body?.requestId ?? '',
      bizId: response.body?.bizId ?? '',
      code: responseCode,
      deliveryMode: 'aliyun',
    } satisfies SmsSendResult;
  }
}
