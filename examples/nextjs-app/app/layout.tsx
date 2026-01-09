import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PII Compliance Tool - Example App',
  description: 'Development example for the PII Compliance Tool package',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
