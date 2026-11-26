/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ndqywjgosioxsdhujubm.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};
