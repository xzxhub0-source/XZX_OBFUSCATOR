// web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',  // This enables the standalone output
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
