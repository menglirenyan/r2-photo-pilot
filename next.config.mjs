/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-c2998b4880a44149ac568bcda9f8b3a7.r2.dev"
      },
      {
        protocol: "https",
        hostname: "*.r2.dev"
      }
    ]
  }
};

export default nextConfig;
