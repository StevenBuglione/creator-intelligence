import type { Metadata } from "next";
import "./style.css";
export const metadata: Metadata = {
  title: "Creator Intelligence",
  description: "Local evidence and original production plans",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
