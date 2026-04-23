/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@monaco-editor/react"],
  output: "standalone",
};

module.exports = nextConfig;
