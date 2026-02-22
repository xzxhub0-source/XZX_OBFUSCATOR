/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',  // This enables the standalone build
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
