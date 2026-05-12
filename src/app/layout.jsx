import React from "react";
import ReduxProvider from "../redux/ReduxProvider";
import "./globals.css";

export const metadata = {
  title: "WhatsApp Web",
  description: "Production-level WhatsApp Web inspired chat application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="h-full w-full overflow-hidden bg-[#e3e6e8] dark:bg-[#0c1317] font-sans text-[#111b21] dark:text-[#e9edef] select-none" suppressHydrationWarning>
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
