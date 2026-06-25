import type { Metadata } from "next";
import { UI_TEXT } from "@/content/ui-text";
import "./globals.css";

export const metadata: Metadata = {
  title: UI_TEXT.metadataTitle,
  description: UI_TEXT.metadataDescription,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  );
}
