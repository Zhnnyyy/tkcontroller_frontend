import type { Metadata } from 'next';
import './globals.css';
import { SocketProvider } from '@/components/SocketProvider';

export const metadata: Metadata = {
  title: 'Device Controller',
  description: 'Web control interface for managing devices',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <SocketProvider>{children}</SocketProvider>
      </body>
    </html>
  );
}
