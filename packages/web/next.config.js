/** @type {import('next').NextConfig} */
const nextConfig = {
  // Imágenes remotas desde CDN/MinIO
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
      },
    ],
  },
};

export default nextConfig;
