/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // Change from 'standalone' to 'export'
  images: {
    unoptimized: true,
  },
  // Disable server-side features
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
};

module.exports = nextConfig;
