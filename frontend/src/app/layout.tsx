import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Starlink Billing Assistance - Admin Dashboard',
  description: 'Independent third-party Starlink billing assistance service admin dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
