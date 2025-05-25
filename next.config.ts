
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export', // Added this line for static export
  /* config options here */
  typescript: {
    ignoreBuildErrors: false, // Changed to false for stricter type checking
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
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

export default nextConfig;
