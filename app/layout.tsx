import './globals.css'
import { Inter } from 'next/font/google'

export const metadata = {
  title: '冷星授权中心',
  description: '兑换券使用与发行',
}

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  )
}
