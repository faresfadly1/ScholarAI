import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "ScholarAI — A clearer path to your next chapter", template: "%s · ScholarAI" },
  description:
    "Evidence-based scholarship eligibility, transparent fit scores, and a personal application roadmap.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
