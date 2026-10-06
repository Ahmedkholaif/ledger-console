import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cache Components: data is dynamic by default and opted into caching with
  // "use cache"; static parts of each page prerender into an instant shell
  // while data streams in behind <Suspense>.
  cacheComponents: true,
  output: 'standalone',
};

export default nextConfig;
