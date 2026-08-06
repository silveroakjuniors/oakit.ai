/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Required for @ffmpeg/ffmpeg WebAssembly — needs SharedArrayBuffer
  // which requires Cross-Origin Isolation headers.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy',  value: 'require-corp' },
        ],
      },
    ];
  },

  // Allow FFmpeg WASM files to be served
  webpack(config) {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

module.exports = nextConfig;
