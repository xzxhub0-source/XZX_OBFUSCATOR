/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Add worker loader
    config.module.rules.push({
      test: /\.worker\.(ts|js)$/,
      loader: 'worker-loader',
      options: {
        filename: 'static/[hash].worker.js',
        publicPath: '/_next/',
      },
    });

    // Fix for worker in Next.js
    if (!isServer) {
      config.output.globalObject = 'self';
    }

    return config;
  },
};

module.exports = nextConfig;
