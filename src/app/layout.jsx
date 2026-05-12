import React from "react";
import ReduxProvider from "../redux/ReduxProvider";
import { ThemeProvider } from "../components/ui/ThemeProvider";
import "./globals.css";

export const metadata = {
  title: "WhatsApp Web",
  description: "Production-level WhatsApp Web inspired chat application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="h-full w-full overflow-hidden bg-wa-app-bg text-wa-text font-sans select-none transition-colors duration-200" suppressHydrationWarning>
        <ReduxProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
