import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Configure primary application fonts
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Root document metadata
export const metadata = {
  title: "Scorekoto",
  description: "Football Data & Statistics Platform",
};

// Root layout component providing global styles and font variables
export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
