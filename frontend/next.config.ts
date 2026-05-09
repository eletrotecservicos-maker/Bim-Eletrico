import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  // Transpilar Three.js/R3F para evitar erros de SSR
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
}

export default nextConfig
