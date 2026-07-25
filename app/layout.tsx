import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Logic Runner // Winter Mute",
  description: "Crack the code. Break the grid. Reach the singularity.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
