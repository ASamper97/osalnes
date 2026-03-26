/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,

  images: {
    unoptimized: true,
  },

  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
