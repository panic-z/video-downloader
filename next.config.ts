import type { NextConfig } from "next";

const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
const basePath = configuredBasePath === undefined ? "/video-downloader" : configuredBasePath;

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
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
