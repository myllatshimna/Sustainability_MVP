import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'ReLoop — Circular Item Assessment & Local Action',
  description: 'AI-assisted circular assessment combining Gemini on Vertex AI with verified local recycling, reuse, repair, and donation information.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-warm-50 text-gray-900 antialiased selection:bg-forest-100 selection:text-forest-900">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-12">
            {children}
          </main>
          <footer className="border-t border-warm-200 bg-white/50 text-gray-500 py-6 text-xs text-center">
            <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
              <p>© 2026 ReLoop Sustainability. Google AI Builder Challenge Pilot.</p>
              <p>Powered by Gemini on Vertex AI, Cloud Storage, Firestore & BigQuery.</p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
