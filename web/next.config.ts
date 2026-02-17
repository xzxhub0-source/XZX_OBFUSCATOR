/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // This generates static HTML
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
}

module.exports = nextConfig
