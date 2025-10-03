import './globals.css';
import type { Metadata } from 'next';
import ConditionalLayout from '@/components/ConditionalLayout';
import { GlobalAcademicContextProvider } from '@/contexts/GlobalAcademicContext';
import { ToastProvider } from '@/components/ui/notifications';

export const metadata: Metadata = {
  title: 'Yano School',
  description: 'Official website for Yano School – Programs, Admissions, About, Contact, and more.',
  keywords: 'Yano School, Nigeria, Ikorodu, Lagos, Education, Programs, Admissions, Contact, Events',
  authors: [
    { name: 'David Obonyano', url: 'https://yanoschools.com' },
  ],
  metadataBase: new URL('https://yanoschools.com'),
  alternates: { canonical: 'https://yanoschools.com/' },
  openGraph: {
    title: 'Yano School',
    description: 'Empowering students through quality education and innovation.',
    url: 'https://yanoschools.com/',
    siteName: 'Yano School',
    images: [
      {
        url: 'https://yanoschools.com/images/heroo.jpg',
        width: 1200,
        height: 630,
        alt: 'Yano School Hero Image',
      },
    ],
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yano School',
    description: 'Empowering students through quality education and innovation.',
    images: ['https://yanoschools.com/images/heroo.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/images/yano-logo.png" type="image/png" />
        {/* JSON-LD to help Google select the hero image */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'EducationalOrganization',
              name: 'Yano School',
              url: 'https://yanoschools.com',
              logo: 'https://yanoschools.com/images/yano-logo.png',
              image: [
                'https://yanoschools.com/images/heroo.jpg',
              ],
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Peace Estate, Ikorodu',
                addressLocality: 'Ikorodu',
                addressRegion: 'Lagos',
                addressCountry: 'Nigeria',
              },
            }),
          }}
        />
      </head>
      <body>
        <GlobalAcademicContextProvider>
          <ToastProvider>
            <ConditionalLayout>{children}</ConditionalLayout>
          </ToastProvider>
        </GlobalAcademicContextProvider>
      </body>
    </html>
  );
}
