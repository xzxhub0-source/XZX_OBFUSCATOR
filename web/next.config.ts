// web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove the invalid 'server' key
  images: {
    unoptimized: true,
  },
  // That's it! No server configuration needed
};

module.exports = nextConfig;
