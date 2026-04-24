/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // PWA is handled via manifest.json + meta tags in layout.tsx
  // No next-pwa dependency needed for basic "Add to Home Screen" support
};

module.exports = nextConfig;
