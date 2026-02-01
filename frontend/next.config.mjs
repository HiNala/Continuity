/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "backend",
      },
    ],
  },
  
  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  },
};

export default nextConfig;
