import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-lib', '@anthropic-ai/sdk', '@google/generative-ai', 'openai'],
}

export default nextConfig
