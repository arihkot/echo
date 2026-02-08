import type { Metadata } from "next";
import "./globals.css";
import { ClientLayout } from "./ClientLayout";

export const metadata: Metadata = {
  title: "Echo - Anonymous Workplace Transparency",
  description:
    "Anonymous salary and workplace transparency platform powered by Midnight blockchain zero-knowledge proofs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-echo-bg min-h-screen">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
