"use client";
import { useI18n } from "@/components/providers";
export function Footer() { const { copy } = useI18n(); return <footer className="footer"><div className="container footer-inner"><span>© 2025 TechVerse</span><span>{copy.footer.mock}</span></div></footer>; }
