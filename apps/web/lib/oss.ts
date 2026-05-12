'use client';

import OSS from 'ali-oss';
import type { OssUploadSessionPayload } from '@/components/resume/resume-types';
import { clientFetch } from './api';

export async function requestAdminOssUploadSession({
  token,
  scene,
  file,
  bizId,
}: {
  token?: string;
  scene: string;
  file: File;
  bizId?: string;
}) {
  return clientFetch<OssUploadSessionPayload>(
    '/admin/storage/oss-upload-sessions',
    {
      method: 'POST',
      body: JSON.stringify({
        scene,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        bizId,
      }),
    },
    token,
  );
}

export async function uploadFileToOss(session: OssUploadSessionPayload, file: File) {
  const endpoint = session.endpoint.trim();
  const client = new OSS({
    region: session.region,
    bucket: session.bucket,
    endpoint: endpoint || undefined,
    accessKeyId: session.credentials.accessKeyId,
    accessKeySecret: session.credentials.accessKeySecret,
    stsToken: session.credentials.securityToken,
    cname: shouldUseOssCname(endpoint),
    secure: true,
  });

  await client.put(session.objectKey, file, {
    headers: {
      'Content-Type': file.type,
    },
  });

  return {
    objectKey: session.objectKey,
    objectReference: `oss://${session.objectKey}`,
    signedUrl: session.signedUrl || '',
  };
}

function shouldUseOssCname(endpoint: string) {
  if (!endpoint) {
    return false;
  }

  try {
    const url = endpoint.includes('://') ? new URL(endpoint) : new URL(`https://${endpoint}`);
    const hostname = url.hostname.toLowerCase();

    // 明确已知的自定义域名
    if (hostname === 'static.offer360.cn' || hostname === 'offer360.cn-beijing.taihangpfm.cn') {
      return true;
    }

    // 如果不是阿里云原生的 endpoint (oss-*.aliyuncs.com)，通常都是自定义域名 CNAME
    if (!hostname.endsWith('.aliyuncs.com')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
