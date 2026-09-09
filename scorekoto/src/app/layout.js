import "./globals.css";
import AppLayout from "@/components/AppLayout";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";

// Root layout component providing global styles, auth provider, and favorites context
export default function RootLayout({ children }) {
  return (
    <html lang="en">
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