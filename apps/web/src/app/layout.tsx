import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })

export const metadata: Metadata = {
  title: 'PeopleGrid',
  description: 'Human Resources Management System',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/peoplegrid-icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon-180x180.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
