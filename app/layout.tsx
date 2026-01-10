import './globals.css'

export const metadata = {
  title: 'AI Chat Assistant',
  description: 'Powered by Claude AI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}