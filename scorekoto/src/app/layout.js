import "./globals.css";
import AppLayout from "@/components/AppLayout";
import { FavoritesProvider } from "@/context/FavoritesContext";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <FavoritesProvider>
          <AppLayout>
            {children}
          </AppLayout>
        </FavoritesProvider>
      </body>
    </html>
  );
}