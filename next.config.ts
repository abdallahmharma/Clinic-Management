/** @type {import('next').NextConfig} */
module.exports = {
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
        hostname: 'vqvqnwpqxzhyiyhddjmy.supabase.co', // Added Supabase hostname
        port: '',
        pathname: '/**',
      },
    ],
  },
};
