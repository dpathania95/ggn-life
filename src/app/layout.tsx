import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ggn.life — places worth knowing about in Gurgaon",
  description:
    "A crowdsourced map of cafes, parks, and hangout spots across Gurgaon — pinned anonymously by people who've actually been there.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
