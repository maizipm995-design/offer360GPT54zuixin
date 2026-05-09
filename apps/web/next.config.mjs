import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const configDir = fileURLToPath(new URL('.', import.meta.url));
const rootEnvPath = resolve(configDir, '../../.env');
loadEnv({ path: rootEnvPath });

const nextConfig = {
  output: 'standalone',
  transpilePackages: ['zustand'],
  experimental: {
    serverActions: {
      allowedOrigins: (process.env.NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.postimg.cc',
      },
    ],
  },
};

export default nextConfig;
