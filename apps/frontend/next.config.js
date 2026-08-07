/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Cross-Origin Isolation headers required for SharedArrayBuffer (FFmpeg WASM).
  // 'credentialless' COEP allows public CDN resources (images, fonts) to load
  // without needing Cross-Origin-Resource-Policy headers on those servers.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy',  value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ];
  },

  webpack(config) {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

module.exports = nextConfig;
