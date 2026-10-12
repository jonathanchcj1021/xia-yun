import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * Inlined at build time. GitHub Actions already sets GITHUB_SHA for the deploy
 * build, which is the commit being deployed. Local builds leave this empty.
 */
const deployedSha = (process.env.NEXT_PUBLIC_APP_SHA || process.env.GITHUB_SHA || "").trim();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_SHA: deployedSha,
  },
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    proxyClientMaxBodySize: "33mb",
  },
  async headers() {
    return [
      {
        source: "/download/apk",
        headers: [
          {
            key: "Content-Type",
            value: "application/vnd.android.package-archive",
          },
          {
            key: "Content-Disposition",
            value: 'attachment; filename="xia-yun.apk"',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
