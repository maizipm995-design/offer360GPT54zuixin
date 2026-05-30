import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import Sts20150401, * as $Sts20150401 from '@alicloud/sts20150401';
import * as $OpenApi from '@alicloud/openapi-client';
import * as $Util from '@alicloud/tea-util';
import OSS from 'ali-oss';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { env } from '../../config/env';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import type { CurrentAdminPayload } from '../admin/decorators/current-admin.decorator';
import { CreateOssSignedObjectUrlDto } from './dto/create-oss-signed-object-url.dto';
import { CreateOssUploadSessionDto } from './dto/create-oss-upload-session.dto';
import {
  ADMIN_OSS_UPLOAD_SCENES,
  type OssUploadActorType,
  type OssUploadScene,
  type OssUploadSceneRule,
  type OssUploadSessionPayload,
  USER_OSS_UPLOAD_SCENES,
} from './storage.types';

const TWO_MB = 2 * 1024 * 1024;
const FIVE_MB = 5 * 1024 * 1024;

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

const EXTENSION_MIME_MAP: Record<string, string> = {
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const SCENE_RULES: Record<OssUploadScene, OssUploadSceneRule> = {
  'resume-avatar': {
    scene: 'resume-avatar',
    actorType: 'user',
    maxSize: TWO_MB,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    pathSegments: ['avatar'],
  },
  'resume-school-logo': {
    scene: 'resume-school-logo',
    actorType: 'user',
    maxSize: TWO_MB,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    pathSegments: ['images', 'school-logos'],
  },
  'service-product-order-image': {
    scene: 'service-product-order-image',
    actorType: 'admin',
    maxSize: FIVE_MB,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    pathSegments: ['images', 'service-products-order'],
    requiredPermission: 'admin:service:manage',
  },
  'service-product-detail-image': {
    scene: 'service-product-detail-image',
    actorType: 'admin',
    maxSize: FIVE_MB,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    pathSegments: ['images', 'service-products-detail'],
    requiredPermission: 'admin:service:manage',
  },
  'membership-content-image': {
    scene: 'membership-content-image',
    actorType: 'admin',
    maxSize: FIVE_MB,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    pathSegments: ['images', 'membership'],
    requiredPermission: 'admin:membership:manage',
  },
  'career-journey-content-image': {
    scene: 'career-journey-content-image',
    actorType: 'admin',
    maxSize: FIVE_MB,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    pathSegments: ['images', 'career-journey'],
    requiredPermission: 'admin:membership:manage',
  },
  'site-config-file': {
    scene: 'site-config-file',
    actorType: 'admin',
    maxSize: FIVE_MB,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/json', 'text/plain'],
    pathSegments: ['images', 'site-config'],
    requiredPermission: 'admin:service:manage',
  },
};

@Injectable()
export class StorageService {
  private stsClient: Sts20150401 | null = null;
  private ossClient: any = null;
  private ossAccessClient: any = null;

  async createUserUploadSession(user: CurrentUserPayload, dto: CreateOssUploadSessionDto): Promise<OssUploadSessionPayload> {
    if (!USER_OSS_UPLOAD_SCENES.includes(dto.scene as (typeof USER_OSS_UPLOAD_SCENES)[number])) {
      throw new ForbiddenException('当前上传场景不允许用户侧调用');
    }

    return this.createUploadSession({
      actorType: 'user',
      actorId: user.userId,
      dto,
    });
  }

  async createAdminUploadSession(admin: CurrentAdminPayload, dto: CreateOssUploadSessionDto): Promise<OssUploadSessionPayload> {
    if (!ADMIN_OSS_UPLOAD_SCENES.includes(dto.scene as (typeof ADMIN_OSS_UPLOAD_SCENES)[number])) {
      throw new ForbiddenException('当前上传场景不允许后台侧调用');
    }

    const rule = SCENE_RULES[dto.scene];
    if (!admin.isSuperAdmin && rule.requiredPermission && !admin.permissions.includes(rule.requiredPermission)) {
      throw new ForbiddenException('当前后台账号没有对应上传场景权限');
    }

    return this.createUploadSession({
      actorType: 'admin',
      actorId: admin.adminId,
      dto,
    });
  }

  async createUserSignedObjectUrl(user: CurrentUserPayload, dto: CreateOssSignedObjectUrlDto) {
    if (!USER_OSS_UPLOAD_SCENES.includes(dto.scene as (typeof USER_OSS_UPLOAD_SCENES)[number])) {
      throw new ForbiddenException('当前签名场景不允许用户侧调用');
    }

    const rule = SCENE_RULES[dto.scene];
    this.assertObjectKeyMatchesScene(rule, dto.objectKey);
    this.assertUserOwnsObjectKey(user.userId, dto.objectKey);
    return this.buildSignedObjectUrlPayload(dto);
  }

  async createAdminSignedObjectUrl(admin: CurrentAdminPayload, dto: CreateOssSignedObjectUrlDto) {
    if (!ADMIN_OSS_UPLOAD_SCENES.includes(dto.scene as (typeof ADMIN_OSS_UPLOAD_SCENES)[number])) {
      throw new ForbiddenException('当前签名场景不允许后台侧调用');
    }

    const rule = SCENE_RULES[dto.scene];
    if (!admin.isSuperAdmin && rule.requiredPermission && !admin.permissions.includes(rule.requiredPermission)) {
      throw new ForbiddenException('当前后台账号没有对应资源访问权限');
    }

    this.assertObjectKeyMatchesScene(rule, dto.objectKey);
    return this.buildSignedObjectUrlPayload(dto);
  }

  async resolveAssetAccessUrl(value: string | null | undefined) {
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      return '';
    }

    const objectKey = this.extractObjectKeyFromValue(normalized);
    if (!objectKey) {
      return normalized;
    }
    try {
      return await this.createSignedReadUrl(objectKey);
    } catch {
      // In dev, placeholder OSS config should not block core business pages.
      return '';
    }
  }

  async buildHtmlPreviewPayload(html: string | null | undefined) {
    const normalizedHtml = html?.trim() ?? '';
    if (!normalizedHtml) {
      return {
        html: normalizedHtml,
        previewHtml: normalizedHtml,
        assetUrls: {} as Record<string, string>,
      };
    }

    const assetUrls = await this.buildHtmlAssetUrlMap(normalizedHtml);
    const previewHtml = this.upgradeBareImageUrlsToImgTags(
      this.replaceHtmlAssetReferences(normalizedHtml, assetUrls),
    );
    return {
      html: normalizedHtml,
      previewHtml,
      assetUrls,
    };
  }

  async createSignedReadUrl(objectKey: string, expiresSeconds = env.ossSignExpireSeconds) {
    const normalizedObjectKey = this.extractObjectKeyFromValue(objectKey);
    if (!normalizedObjectKey) {
      return '';
    }

    this.assertStorageConfigured();
    const url = this.getOssAccessClient().signatureUrl(normalizedObjectKey, {
      method: 'GET',
      expires: this.normalizeExpireSeconds(expiresSeconds),
    });

    return url;
  }

  isConfigured() {
    return Boolean(env.ossRegion && env.ossBucket && env.ossAccessKeyId && env.ossAccessKeySecret);
  }

  async createSignedDownloadUrl(
    objectKey: string,
    fileName: string,
    _mimeType = 'application/octet-stream',
    expiresSeconds = env.ossSignExpireSeconds,
  ) {
    const normalizedObjectKey = this.extractObjectKeyFromValue(objectKey);
    if (!normalizedObjectKey) {
      throw new BadRequestException('缺少文件对象标识，无法生成下载链接');
    }

    this.assertStorageConfigured();
    const url = this.getOssAccessClient().signatureUrl(normalizedObjectKey, {
      method: 'GET',
      expires: this.normalizeExpireSeconds(expiresSeconds),
      response: {
        'content-disposition': this.buildAttachmentDisposition(fileName),
      },
    });

    return url;
  }

  async uploadBuffer({
    pathSegments,
    actorType,
    actorId,
    bizId,
    fileName,
    contentType,
    buffer,
  }: {
    pathSegments: string[];
    actorType: OssUploadActorType;
    actorId: string;
    bizId?: string;
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }) {
    this.assertStorageConfigured();

    const extension = this.resolveExtension(fileName, contentType);
    const objectKey = this.buildObjectKey({
      pathSegments,
      actorType,
      actorId,
      bizId,
      extension,
    });

    await this.getOssClient().put(objectKey, buffer, {
      headers: {
        'Content-Type': contentType,
      },
    });

    return {
      bucket: env.ossBucket,
      objectKey,
    };
  }

  async deleteObject(objectKey: string) {
    const normalizedObjectKey = this.extractObjectKeyFromValue(objectKey);
    if (!normalizedObjectKey || !this.isConfigured()) {
      return;
    }
    await this.getOssClient().delete(normalizedObjectKey);
  }

  private async buildSignedObjectUrlPayload(dto: CreateOssSignedObjectUrlDto) {
    const expiresSeconds = dto.expiresSeconds ?? env.ossSignExpireSeconds;
    const url = dto.fileName
      ? await this.createSignedDownloadUrl(dto.objectKey, dto.fileName, dto.mimeType ?? 'application/octet-stream', expiresSeconds)
      : await this.createSignedReadUrl(dto.objectKey, expiresSeconds);

    return {
      objectKey: dto.objectKey.trim(),
      objectReference: this.toStoredObjectReference(dto.objectKey),
      url,
      expiresAt: this.buildExpirationTimestamp(expiresSeconds),
      fileName: dto.fileName?.trim() || null,
      mimeType: dto.mimeType?.trim() || null,
      mode: dto.fileName ? 'download' : 'read',
    };
  }

  private async createUploadSession({
    actorType,
    actorId,
    dto,
  }: {
    actorType: OssUploadActorType;
    actorId: string;
    dto: CreateOssUploadSessionDto;
  }): Promise<OssUploadSessionPayload> {
    const rule = SCENE_RULES[dto.scene];
    if (!rule || rule.actorType !== actorType) {
      throw new ForbiddenException('上传场景与当前调用身份不匹配');
    }

    this.assertStorageConfigured();
    this.assertUploadSessionConfigured();
    this.assertFileRule(rule, dto);

    const extension = this.resolveExtension(dto.fileName, dto.contentType);
    const objectKey = this.buildObjectKey({
      pathSegments: rule.pathSegments,
      actorType,
      actorId,
      bizId: dto.bizId,
      extension,
    });
    const { expiration, credentials } = await this.assumeUploadRole({
      actorType,
      actorId,
      objectKey,
    });
    const signedUrlExpiresAt = this.buildExpirationTimestamp(env.ossSignExpireSeconds);

    return {
      provider: 'aliyun-oss',
      uploadMode: 'browser-sts',
      scene: rule.scene,
      bucket: env.ossBucket,
      region: env.ossRegion,
      endpoint: this.resolveOssUploadEndpoint(),
      objectKey,
      signedUrl: await this.createSignedReadUrl(objectKey),
      signedUrlExpiresAt,
      secure: true,
      expiration,
      maxSize: rule.maxSize,
      allowedMimeTypes: rule.allowedMimeTypes,
      credentials,
    };
  }

  private getStsClient() {
    if (this.stsClient) {
      return this.stsClient;
    }

    this.stsClient = new Sts20150401(
      new $OpenApi.Config({
        accessKeyId: env.ossAccessKeyId,
        accessKeySecret: env.ossAccessKeySecret,
        endpoint: env.ossStsEndpoint,
      }),
    );
    return this.stsClient;
  }

  private getOssClient() {
    if (this.ossClient) {
      return this.ossClient;
    }

    this.ossClient = this.createOssClient({
      endpoint: this.resolveOssEndpoint(),
      cname: false,
    });
    return this.ossClient;
  }

  private getOssAccessClient() {
    if (this.ossAccessClient) {
      return this.ossAccessClient;
    }

    this.ossAccessClient = this.createOssClient({
      endpoint: this.resolveOssAccessEndpoint(),
      cname: this.shouldUseCustomDomainAccess(),
    });
    return this.ossAccessClient;
  }

  private createOssClient({
    endpoint,
    cname,
  }: {
    endpoint: string;
    cname: boolean;
  }) {
    return new OSS({
      region: env.ossRegion,
      bucket: env.ossBucket,
      endpoint,
      accessKeyId: env.ossAccessKeyId,
      accessKeySecret: env.ossAccessKeySecret,
      cname,
      secure: true,
    });
  }

  private async assumeUploadRole({
    actorType,
    actorId,
    objectKey,
  }: {
    actorType: OssUploadActorType;
    actorId: string;
    objectKey: string;
  }) {
    const client = this.getStsClient();
    const request = new $Sts20150401.AssumeRoleRequest({
      roleArn: env.ossStsRoleArn,
      roleSessionName: this.buildRoleSessionName(actorType, actorId),
      durationSeconds: env.ossUploadExpireSeconds,
      policy: JSON.stringify({
        Version: '1',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'oss:PutObject',
              'oss:InitiateMultipartUpload',
              'oss:UploadPart',
              'oss:CompleteMultipartUpload',
              'oss:AbortMultipartUpload',
              'oss:ListParts',
            ],
            Resource: [`acs:oss:*:*:${env.ossBucket}/${objectKey}`],
          },
        ],
      }),
    });

    const response = await client.assumeRoleWithOptions(request, new $Util.RuntimeOptions({}));
    const credentials = response.body?.credentials;
    if (!credentials?.accessKeyId || !credentials.accessKeySecret || !credentials.securityToken || !credentials.expiration) {
      throw new ServiceUnavailableException('阿里云 OSS 临时凭证签发失败');
    }

    return {
      expiration: credentials.expiration,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        accessKeySecret: credentials.accessKeySecret,
        securityToken: credentials.securityToken,
      },
    };
  }

  private assertStorageConfigured() {
    const requiredVars: Array<[string, string]> = [
      ['OSS_REGION', env.ossRegion],
      ['OSS_BUCKET', env.ossBucket],
      ['OSS_ACCESS_KEY_ID', env.ossAccessKeyId],
      ['OSS_ACCESS_KEY_SECRET', env.ossAccessKeySecret],
    ];

    const missing = requiredVars.filter(([, value]) => !value).map(([key]) => key);
    if (missing.length) {
      throw new ServiceUnavailableException(`OSS 暂未完成环境配置，请补齐：${missing.join('、')}`);
    }
  }

  private assertUploadSessionConfigured() {
    if (!env.ossStsRoleArn.trim()) {
      throw new ServiceUnavailableException('OSS 暂未完成环境配置，请补齐：OSS_STS_ROLE_ARN');
    }
  }

  private assertFileRule(rule: OssUploadSceneRule, dto: CreateOssUploadSessionDto) {
    if (!rule.allowedMimeTypes.includes(dto.contentType)) {
      throw new BadRequestException(`当前场景仅支持上传：${rule.allowedMimeTypes.join('、')}`);
    }
    if (dto.fileSize > rule.maxSize) {
      throw new BadRequestException(`文件大小超出限制，当前场景最大支持 ${Math.floor(rule.maxSize / 1024 / 1024)}MB`);
    }
    if (rule.scene === 'resume-avatar') {
      const imageWidth = dto.imageWidth ?? 0;
      const imageHeight = dto.imageHeight ?? 0;
      if (!imageWidth || !imageHeight) {
        throw new BadRequestException('缺少头像尺寸信息，请重新选择图片后上传');
      }
      if (imageWidth < 295 || imageHeight < 413) {
        throw new BadRequestException('头像尺寸过小，请上传不低于 295×413 像素的一寸证件照');
      }
      const portraitRatio = imageHeight / imageWidth;
      if (portraitRatio < 1.3 || portraitRatio > 1.5) {
        throw new BadRequestException('头像比例不符合要求，请上传接近一寸照比例（295×413，约 1:1.4）的竖版照片');
      }
    }
  }

  private assertObjectKeyMatchesScene(rule: OssUploadSceneRule, objectKey: string) {
    const normalizedObjectKey = this.extractObjectKeyFromValue(objectKey);
    const prefix = `${rule.pathSegments.join('/')}/`;
    if (!normalizedObjectKey.startsWith(prefix)) {
      throw new ForbiddenException('当前对象不属于指定业务场景，无法签名访问');
    }
  }

  private assertUserOwnsObjectKey(userId: string, objectKey: string) {
    const normalizedObjectKey = this.extractObjectKeyFromValue(objectKey);
    const actorSegment = this.sanitizePathSegment(userId);
    if (!normalizedObjectKey.includes(`/user-${actorSegment}-`)) {
      throw new ForbiddenException('当前对象不属于当前用户，无法签名访问');
    }
  }

  private resolveExtension(fileName: string, contentType: string) {
    const normalizedExt = extname(fileName).replace('.', '').trim().toLowerCase();
    const normalizedMime = contentType.trim().toLowerCase();

    if (normalizedExt) {
      const mappedMime = EXTENSION_MIME_MAP[normalizedExt];
      if (!mappedMime) {
        throw new BadRequestException('当前文件扩展名不在允许范围内');
      }
      const mimeProvided = normalizedMime && normalizedMime !== 'application/octet-stream';
      if (mimeProvided && mappedMime !== normalizedMime) {
        throw new BadRequestException('文件扩展名与 MIME 类型不匹配');
      }
      return normalizedExt === 'jpeg' ? 'jpg' : normalizedExt;
    }

    const extension = MIME_EXTENSION_MAP[normalizedMime];
    if (!extension) {
      throw new BadRequestException('无法识别当前文件类型');
    }
    return extension;
  }

  private buildObjectKey({
    pathSegments,
    actorType,
    actorId,
    bizId,
    extension,
  }: {
    pathSegments: string[];
    actorType: OssUploadActorType;
    actorId: string;
    bizId?: string;
    extension: string;
  }) {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const actorSegment = this.sanitizePathSegment(actorId);
    const bizSegment = this.sanitizePathSegment(bizId || 'general');
    return [
      ...pathSegments,
      bizSegment,
      year,
      month,
      `${actorType}-${actorSegment}-${randomUUID()}.${extension}`,
    ].join('/');
  }

  private buildRoleSessionName(actorType: OssUploadActorType, actorId: string) {
    const normalizedActorId = this.sanitizePathSegment(actorId).slice(0, 24);
    return `${actorType}-${normalizedActorId}-${Date.now()}`.slice(0, 64);
  }

  private sanitizePathSegment(value: string) {
    const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
    return normalized || 'general';
  }

  private resolveOssEndpoint() {
    const endpoint = env.ossEndpoint.trim().replace(/\/+$/, '');
    if (endpoint) {
      return /^https?:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`;
    }
    return `https://${env.ossRegion}.aliyuncs.com`;
  }

  private resolveOssAccessEndpoint() {
    const customDomain = env.ossCustomDomain.trim().replace(/\/+$/, '');
    if (customDomain) {
      return /^https?:\/\//i.test(customDomain) ? customDomain : `https://${customDomain}`;
    }
    return this.resolveOssEndpoint();
  }

  private resolveOssUploadEndpoint() {
    return this.resolveOssAccessEndpoint();
  }

  private shouldUseCustomDomainAccess() {
    return Boolean(env.ossCustomDomain.trim());
  }

  private buildExpirationTimestamp(expiresSeconds: number) {
    return new Date(Date.now() + this.normalizeExpireSeconds(expiresSeconds) * 1000).toISOString();
  }

  private normalizeExpireSeconds(expiresSeconds: number) {
    return Math.max(60, Math.floor(expiresSeconds || env.ossSignExpireSeconds || 1800));
  }

  toStoredObjectReference(objectKey: string) {
    const normalizedObjectKey = this.extractObjectKeyFromValue(objectKey);
    return normalizedObjectKey ? `oss://${normalizedObjectKey}` : '';
  }

  private extractObjectKeyFromValue(value: string) {
    const normalized = value.trim();
    if (!normalized || normalized.startsWith('data:')) {
      return '';
    }
    if (normalized.startsWith('oss://')) {
      return normalized.slice('oss://'.length).replace(/^\/+/, '');
    }
    if (/^https?:\/\//i.test(normalized)) {
      return this.extractObjectKeyFromUrl(normalized);
    }
    return normalized;
  }

  private extractObjectKeyFromUrl(value: string) {
    try {
      const url = new URL(value);
      if (!this.isKnownOssAccessHost(url.hostname)) {
        return '';
      }
      return decodeURIComponent(url.pathname).replace(/^\/+/, '');
    } catch {
      return '';
    }
  }

  private isKnownOssAccessHost(hostname: string) {
    const normalizedHost = hostname.trim().toLowerCase();
    if (!normalizedHost) {
      return false;
    }

    const configuredEndpointHost = this.extractHostname(this.resolveOssEndpoint());
    const configuredAccessHost = this.extractHostname(this.resolveOssAccessEndpoint());
    const officialBucketHost =
      configuredEndpointHost && env.ossBucket.trim()
        ? `${env.ossBucket.trim().toLowerCase()}.${configuredEndpointHost}`
        : '';

    return new Set(
      [
        configuredAccessHost,
        configuredEndpointHost,
        officialBucketHost,
        'static.offer360.cn',
        'offer360.cn',
        'www.offer360.cn',
        'offer360.cn-beijing.taihangpfm.cn',
        'offer360.oss-cn-beijing.aliyuncs.com',
      ].filter(Boolean),
    ).has(normalizedHost);
  }

  private extractHostname(value: string) {
    try {
      return new URL(value).hostname.trim().toLowerCase();
    } catch {
      return '';
    }
  }

  private async buildHtmlAssetUrlMap(html: string) {
    const objectKeys = Array.from(
      new Set(
        this.collectHtmlAssetReferences(html)
          .map((reference) => this.extractObjectKeyFromValue(reference))
          .filter(Boolean),
      ),
    );

    const entries = await Promise.all(
      objectKeys.map(async (objectKey) => [objectKey, await this.createSignedReadUrl(objectKey)] as const),
    );

    return Object.fromEntries(entries);
  }

  private replaceHtmlAssetReferences(html: string, assetUrls: Record<string, string>) {
    return html.replace(/(<img\b[^>]*\bsrc=)(["'])([^"']+)\2/gi, (full, prefix: string, quote: string, rawSrc: string) => {
      const objectKey = this.extractObjectKeyFromValue(rawSrc);
      const signedUrl = objectKey ? assetUrls[objectKey] : '';
      return signedUrl ? `${prefix}${quote}${signedUrl}${quote}` : full;
    });
  }

  private upgradeBareImageUrlsToImgTags(html: string) {
    return html.replace(
      /(^|>|\s)(https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?[^\s<>"']*)?)(?=\s|<|$)/gi,
      (_match, prefix: string, url: string) => `${prefix}<img src="${url}" alt="图片" />`,
    );
  }

  private collectHtmlAssetReferences(html: string) {
    const references: string[] = [];
    const matcher = /<img\b[^>]*\bsrc=(["'])([^"']+)\1/gi;
    for (const match of html.matchAll(matcher)) {
      const rawSrc = match[2]?.trim();
      if (rawSrc) {
        references.push(rawSrc);
      }
    }
    return references;
  }

  private buildAttachmentDisposition(fileName: string) {
    const asciiFallback = fileName
      .trim()
      .replace(/[^\x20-\x7E]+/g, '_')
      .replace(/[\\"]/g, '_')
      || 'download';

    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName || 'download')}`;
  }
}
