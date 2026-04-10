/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'iugopkhkmrjvgwajtqqg.supabase.co' },
      { protocol: 'https', hostname: 'scontent.cdninstagram.com' },
      { protocol: 'https', hostname: '*.cdninstagram.com' },
    ],
  },
}

module.exports = nextConfig
