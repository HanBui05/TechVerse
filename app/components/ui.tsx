import type { ReactNode } from "react";
import Link from "next/link";

export function Loading() { return <p className="loading" role="status">Đang tải dữ liệu…</p>; }
export function EmptyState({ title = "Chưa có dữ liệu", description = "Khi có dữ liệu phù hợp, nội dung sẽ xuất hiện ở đây." }: { title?: string; description?: string }) { return <div className="empty"><strong>{title}</strong><p>{description}</p></div>; }
export function ErrorState() { return <div className="notice" role="alert">Không thể tải dữ liệu mock. Vui lòng thử lại.</div>; }
export function PageHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) { return <div className="page-heading">{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p className="lead">{description}</p>}</div>; }
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <div className={`card ${className}`}>{children}</div>; }
export function Badge({ children }: { children: ReactNode }) { return <span className="tag">{children}</span>; }
export function SectionHead({ title, description, href, label = "Xem tất cả" }: { title: string; description?: string; href?: string; label?: string }) { return <div className="section-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{href && <Link className="button button-quiet" href={href}>{label} →</Link>}</div>; }
