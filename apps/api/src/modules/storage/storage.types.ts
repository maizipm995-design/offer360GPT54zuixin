export const USER_OSS_UPLOAD_SCENES = ['resume-avatar', 'resume-school-logo'] as const;

export const ADMIN_OSS_UPLOAD_SCENES = [
  'service-product-order-image',
  'service-product-detail-image',
  'membership-content-image',
  'career-journey-content-image',
  'site-config-file',
] as const;

export const OSS_UPLOAD_SCENES = [...USER_OSS_UPLOAD_SCENES, ...ADMIN_OSS_UPLOAD_SCENES] as const;

export type UserOssUploadScene = (typeof USER_OSS_UPLOAD_SCENES)[number];
export type AdminOssUploadScene = (typeof ADMIN_OSS_UPLOAD_SCENES)[number];
export type OssUploadScene = (typeof OSS_UPLOAD_SCENES)[number];
export type OssUploadActorType = 'user' | 'admin';

export interface OssUploadSceneRule {
  scene: OssUploadScene;
  actorType: OssUploadActorType;
  maxSize: number;
  allowedMimeTypes: string[];
  pathSegments: string[];
  requiredPermission?: string;
}

export interface OssUploadSessionPayload {
  provider: 'aliyun-oss';
  uploadMode: 'browser-sts';
  scene: OssUploadScene;
  bucket: string;
  region: string;
  endpoint: string;
  objectKey: string;
  signedUrl: string | null;
  signedUrlExpiresAt: string | null;
  secure: true;
  expiration: string;
  maxSize: number;
  allowedMimeTypes: string[];
  credentials: {
    accessKeyId: string;
    accessKeySecret: string;
    securityToken: string;
  };
}
