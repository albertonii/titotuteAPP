/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  output: "standalone",
  webpack: (config, { isServer, webpack }) => {
    if (isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          self: "globalThis",
        })
      );
    }
    return config;
  },
};

export default nextConfig;
