import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "נייחא", description: "מערכת הזמנות דירות במירון" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
