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
