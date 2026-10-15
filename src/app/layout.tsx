import type { Metadata } from 'next';
import { Space_Grotesk, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '@/lib/store';
import { ProctorProvider } from '@/components/proctor';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700'] });
const body = Inter({ subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600'] });
const mono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  title: 'Shell PTW & Competence Portal — Prototype',
  description: 'Prototype: Permit to Work, training, Safety Passport and HSSE reporting for Shell retail stations in Oman (Artelia).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-sans">
        <StoreProvider>
          <ProctorProvider>{children}</ProctorProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
