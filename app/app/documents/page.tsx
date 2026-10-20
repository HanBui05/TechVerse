"use client";
import { useEffect, useState } from "react";
import { DocumentCard } from "@/components/content-cards";
import { EmptyState, ErrorState, Loading, PageHeading } from "@/components/ui";
import { services } from "@/services";
import type { Document } from "@/types/domain";

export default function DocumentsPage() { const [items, setItems] = useState<Document[]>([]); const [query, setQuery] = useState(""); const [loading, setLoading] = useState(true); useEffect(() => { services.documents.list({ query }).then((result) => setItems(result.items)).catch(() => setItems([])).finally(() => setLoading(false)); }, [query]); return <div className="container"><PageHeading eyebrow="Resources" title="Tài liệu" description="Mở các tài liệu PDF hoặc Notion được cung cấp bởi tác giả." /><div className="toolbar"><input className="input search-input" value={query} onChange={(event) => { setLoading(true); setQuery(event.target.value); }} placeholder="Tìm tài liệu…" aria-label="Tìm tài liệu" /></div>{loading ? <Loading /> : items.length ? <div className="grid grid-2">{items.map((item) => <DocumentCard key={item.id} document={item} />)}</div> : <EmptyState title="Không có tài liệu phù hợp" />}</div>; }
