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
  
  // Compiler options
  compiler: {
    // Remove console logs in production (but keep errors and warnings)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Generate ETags for better caching
  generateEtags: true,
  
  // Compress responses
  compress: true,
  
  // Disable x-powered-by header for security
  poweredByHeader: false,
  
  // Configure build output directory
  distDir: '.next',
  
  // Configure build ID
  generateBuildId: async () => {
    // You can use a custom build ID here
    return `build-${Date.now()}`;
  },
  
  // Headers configuration for security
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
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // Webpack configuration (if needed)
  webpack: (config, { isServer }) => {
    // Handle any special webpack requirements here
    
    // Important: This ensures proper handling of CSS modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  },
  
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
};

module.exports = nextConfig;
