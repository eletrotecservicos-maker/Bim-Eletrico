import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'BIM Elétrico — Analisador de Malhas de Aterramento',
  description: 'Sistema profissional de análise, dimensionamento e visualização de malhas de aterramento. IEEE 80, ABNT NBR 15751.',
  keywords: ['aterramento', 'malha', 'IEEE 80', 'ABNT NBR 15751', 'subestação', 'SPDA', 'engenharia elétrica'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="h-screen overflow-hidden bg-background-primary text-text-primary">
        {children}
      </body>
    </html>
  );
}
