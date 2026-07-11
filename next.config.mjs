/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/admin/quotations/*": ["./src/assets/fonts/NotoSansCJKsc-Regular.otf"]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.huowu.org"
      },
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
