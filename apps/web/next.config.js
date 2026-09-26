/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@human-stamp/core'],
  serverComponentsExternalPackages: ['pdfkit', 'sharp'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('pdfkit');
    }
    return config;
  },
};

module.exports = nextConfig;
