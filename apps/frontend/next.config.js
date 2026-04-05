/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

let withPWA = (config) => config;
try {
  withPWA = require('next-pwa')({ dest: 'public', disable: process.env.NODE_ENV === 'development' });
} catch {
  console.warn('next-pwa unavailable, skipping PWA config');
}

module.exports = withPWA(nextConfig);
