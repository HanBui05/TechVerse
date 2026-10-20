"use client";
import { useEffect, useState } from "react";
import { services } from "@/services";
import { Badge, Card, EmptyState, Loading, PageHeading } from "@/components/ui";
import type { InterviewQuestion } from "@/types/domain";

export default function InterviewPage() { const [items, setItems] = useState<InterviewQuestion[]>([]); const [active, setActive] = useState<string | null>(null); useEffect(() => { services.interviews.list().then(setItems); }, []); if (!items.length) return <div className="container"><Loading /></div>; return <div className="container"><PageHeading eyebrow="Interview practice" title="Ôn tập phỏng vấn" description="Xem câu hỏi, gợi ý và đáp án mẫu được backend mô hình hóa." /><div className="stack">{items.map((item) => <Card key={item.id}><div className="card-meta"><Badge>{item.level}</Badge><span>{item.topic.name}</span></div><h3>{item.question}</h3><p>{item.hint}</p><button className="button button-secondary" onClick={() => setActive(active === item.id ? null : item.id)}>{active === item.id ? "Ẩn đáp án mẫu" : "Xem đáp án mẫu"}</button>{active === item.id && <p>{item.sampleAnswer}</p>}</Card>)}</div></div>; }
