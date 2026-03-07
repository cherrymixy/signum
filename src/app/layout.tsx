import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Signum - Image Decoding Analysis',
  description: '노드링크 기반 이미지 디코딩 예측 웹서비스',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}



