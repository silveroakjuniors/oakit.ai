/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Note: Cross-Origin-Embedder-Policy headers were removed because they block
  // all cross-origin fetch requests (to our Render API gateway) unless the server
  // sends Cross-Origin-Resource-Policy headers — which it doesn't.
  // FFmpeg WASM compression falls back to MediaRecorder on browsers without
  // SharedArrayBuffer, which covers Safari iOS and most Android devices.

  webpack(config) {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

module.exports = nextConfig;
