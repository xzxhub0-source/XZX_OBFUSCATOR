// web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output as standalone for better Docker deployment
  output: 'standalone',
  
  // Image optimization settings
  images: {
    unoptimized: true, // Since we're not using external images
  },
  
  // Enable React strict mode for better development
  reactStrictMode: true,
  
  // Configure allowed domains if using external images
  // images: {
  //   domains: ['example.com'],
  // },
  
  // Experimental features
  experimental: {
    // Optimize package imports for better performance
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-label',
      '@radix-ui/react-progress',
      '@radix-ui/react-select',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
    ],
  },
  
  // Webpack configuration (if needed)
  webpack: (config, { isServer }) => {
    // Handle any special webpack requirements
    
    // Return the modified config
    return config;
  },
  
  // Environment variables that should be available to the browser
  env: {
    // Add any public environment variables here
    // NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  
  // Headers configuration
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  
  // Redirects configuration (if needed)
  async redirects() {
    return [];
  },
  
  // Rewrites configuration (if needed)
  async rewrites() {
    return [];
  },
  
  // Compiler options
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Generate ETags for better caching
  generateEtags: true,
  
  // Compress responses
  compress: true,
  
  // Enable HTTP/2 server push
  poweredByHeader: false,
  
  // Disable x-powered-by header for security
  poweredByHeader: false,
  
  // Configure build output
  distDir: '.next',
  
  // Configure build ID
  generateBuildId: async () => {
    // Return a custom build ID
    return `build-${Date.now()}`;
  },
};

module.exports = nextConfig;
