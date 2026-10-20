import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { AppProviders } from "@/components/providers";

export const metadata: Metadata = { title: "TechVerse — Học và chia sẻ kiến thức IT", description: "Nền tảng học tập và chia sẻ kiến thức Công nghệ Thông tin." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(() => { try { const theme = localStorage.getItem('techverse-theme'); const resolved = theme === 'dark' || (theme !== 'light' && theme !== 'system' && matchMedia('(prefers-color-scheme: dark)').matches) || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; document.documentElement.dataset.theme = resolved; } catch (_) {} })()` }} /></head><body><AppProviders><div className="site-shell"><Header /><main className="main">{children}</main><Footer /></div></AppProviders></body></html>;
}
