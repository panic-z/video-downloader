import type { NextConfig } from "next";

const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
const basePath = configuredBasePath === undefined ? "/video-downloader" : configuredBasePath;
const runtimeMode = process.env.NEXT_PUBLIC_RUNTIME_MODE === "vercel" || process.env.VERCEL ? "vercel" : "local";

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_RUNTIME_MODE: runtimeMode
  },
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/youtube-dl-exec/bin/**/*",
      "./node_modules/ffmpeg-static/ffmpeg"
    ]
  },
  async redirects() {
    if (!basePath) return [];

    return [
      {
        source: "/",
        destination: basePath,
        permanent: false,
        basePath: false
      }
    ];
  }
};

export default nextConfig;
