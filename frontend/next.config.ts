import type { NextConfig } from 'next';

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      // Proxy card view pages so share URLs use the Vercel domain
      {
        source: '/card/:slug*',
        destination: `${backendUrl}/card/:slug*`,
      },
      // card-view.html fetches from window.location.origin, so proxy its API call too
      {
        source: '/api/card/view/:slug*',
        destination: `${backendUrl}/api/card/view/:slug*`,
      },
      // Proxy leaderboard so LEADERBOARD buttons use the Vercel domain
      {
        source: '/leaderboard',
        destination: `${backendUrl}/leaderboard`,
      },
    ];
  },
};

export default nextConfig;
