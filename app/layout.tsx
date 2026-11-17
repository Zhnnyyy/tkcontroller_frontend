import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SocketProvider } from '@/components/SocketProvider';
import { AuthGate } from '@/components/AuthGate';

export const metadata: Metadata = {
  title: 'Device Controller',
  description: 'Web control interface for managing devices',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <AuthGate>
          <SocketProvider>{children}</SocketProvider>
        </AuthGate>
      </body>
    </html>
  );
}
