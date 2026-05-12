import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Offer360',
    short_name: 'Offer360',
    description: 'Offer360 校招信息汇总与大学生求职平台',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ff8002',
    lang: 'zh-CN',
    icons: [
      {
        src: 'https://i.postimg.cc/h4scGvF6/sun-lao-shilogo-64X64.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: 'https://i.postimg.cc/J05Dn45v/sun-lao-shilogo-192X192.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
  };
}
