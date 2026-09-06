// Next.js configuration enabling React Compiler
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "r2.thesportsdb.com",
      },
    ],
  },
};

export default nextConfig;