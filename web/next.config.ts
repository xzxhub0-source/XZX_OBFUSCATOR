// web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove 'output: standalone' if you have it - let's use the simpler approach
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
