import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "חרות בלב- מחולל תאריכים",
  description: "יצירת לוח תאריכים משפחתי בקלות",
  icons: {
    icon: [
      {
        url: "/favicon.svg?v=2", // ה-v=2 משלה את הדפדפן שמדובר בקובץ חדש ומכריח אותו לטעון אותו מחדש
        type: "image/svg+xml",   // הגדרה מפורשת של סוג הקובץ עבור הדפדפן
      }
    ]
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
