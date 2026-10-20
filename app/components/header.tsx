"use client";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/providers";

export function Header() { const [open, setOpen] = useState(false); const { copy } = useI18n(); const links = [[copy.nav.articles, "/articles"], [copy.nav.documents, "/documents"], [copy.nav.courses, "/courses"], [copy.nav.practice, "/practice"], [copy.nav.community, "/community"], [copy.nav.settings, "/settings"]]; return <header className="topbar"><div className="container nav"><Link className="brand" href="/"><span className="brand-mark">T</span>TechVerse</Link><nav className={`nav-links ${open ? "open" : ""}`}>{links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}</nav><div className="nav-actions"><Link className="button button-secondary" href="/auth/sign-in">{copy.nav.signIn}</Link><Link className="button button-primary" href="/profile">{copy.nav.profile}</Link><button className="menu-button" onClick={() => setOpen((value) => !value)} aria-label={copy.nav.openMenu}>☰</button></div></div></header>; }
