// web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove standalone output if present
  images: {
    unoptimized: true,
  },
  // Optional: Explicitly set server port
  server: {
    port: 80,
    host: '0.0.0.0',
  },
};

module.exports = nextConfig;
