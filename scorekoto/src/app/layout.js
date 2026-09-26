import "./globals.css";
import { Hind_Siliguri, Manrope } from "next/font/google";
import AppLayout from "@/components/AppLayout";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});

const hindSiliguri = Hind_Siliguri({
  weight: ["400", "500", "600", "700"],
  subsets: ["bengali", "latin"],
  display: "swap",
  variable: "--font-bengali",
  fallback: ["Nirmala UI", "sans-serif"],
});

export const metadata = {
  title: "Scoreকত?",
  description: "Live football scores, fixtures, teams, leagues, and player statistics.",
};

// Root layout component providing global styles, auth provider, and favorites context
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${manrope.variable} ${hindSiliguri.variable}`}>
      <body>
        <AuthProvider>
          <FavoritesProvider>
            <AppLayout>
              {children}
            </AppLayout>
          </FavoritesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
