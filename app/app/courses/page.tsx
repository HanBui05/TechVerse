"use client";
import { useEffect, useState } from "react";
import { CourseCard } from "@/components/content-cards";
import { EmptyState, Loading, PageHeading } from "@/components/ui";
import { services } from "@/services";
import type { Course } from "@/types/domain";

export default function CoursesPage() { const [items, setItems] = useState<Course[]>([]); const [loading, setLoading] = useState(true); useEffect(() => { services.courses.list().then((result) => setItems(result.items)).finally(() => setLoading(false)); }, []); return <div className="container"><PageHeading eyebrow="Learning" title="Khóa học" description="Các khóa học đã xuất bản, với cấp độ và nội dung được mô tả rõ ràng." />{loading ? <Loading /> : items.length ? <div className="grid grid-2">{items.map((course) => <CourseCard key={course.id} course={course} />)}</div> : <EmptyState title="Chưa có khóa học" />}</div>; }
