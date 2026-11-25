import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sessão Solene de Homenagens · Câmara Municipal de Itapoá',
  description:
    'Sistema de Gestão de Sessões Solenes Mensais de Homenagens (SSMH), Cerimonial, Certificados e Projeção Ao Vivo — Câmara Municipal de Itapoá/SC.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#f4f6fa] text-[#151a22]">{children}</body>
    </html>
  );
}
