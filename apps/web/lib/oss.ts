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
    const hostname = new URL(endpoint).hostname.toLowerCase();
    return hostname === 'static.offer360.cn' || hostname === 'offer360.cn-beijing.taihangpfm.cn';
  } catch {
    return false;
  }
}
