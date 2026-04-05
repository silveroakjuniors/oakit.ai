/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

let withPWA = (config) => config;

try {
  const nextPWA = require('next-pwa');

  withPWA = nextPWA({
    dest: 'public',
    disable: true, // 🔥 FORCE DISABLE (fixes your build)
  });
} catch (e) {
  console.warn('next-pwa not installed, skipping PWA setup');
}

const nextConfig = {
  reactStrictMode: true,
};

module.exports = withPWA(nextConfig);
