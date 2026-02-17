/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip the manifest route
  exportPathMap: async function (defaultPathMap) {
    delete defaultPathMap['/manifest.webmanifest'];
    return defaultPathMap;
  },
}

module.exports = nextConfig
