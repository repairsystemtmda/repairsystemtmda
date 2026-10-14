import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // เพิ่มบรรทัดนี้เพื่อข้ามการตรวจสอบ TypeScript ตอน Build
  typescript: {
    ignoreBuildErrors: true,
  },

  allowedDevOrigins: [
    '192.168.1.116',
    '192.168.1.57',
    '192.168.1.41',
    'doable-cornhusk-little.ngrok-free.dev'
  ],
  
  experimental: {
    proxyClientMaxBodySize: '50mb',
    
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

export default nextConfig;