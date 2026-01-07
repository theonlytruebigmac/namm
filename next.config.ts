import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: 'standalone', // Enable standalone output for Docker

  // Externalize native modules that can't be bundled
  serverExternalPackages: ['serialport', '@serialport/bindings-cpp'],
};

export default nextConfig;
