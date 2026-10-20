import Link from "next/link";
import { notFound } from "next/navigation";
import { services } from "@/services";
import { Badge } from "@/components/ui";
import { formatDate } from "@/lib/constants";

export default async function ArticleDetailPage({ params }: { params: { slug: string } }) { const article = await services.articles.getBySlug(params.slug); if (!article) notFound(); return <div className="container"><div className="article-layout"><article><div className="detail-header"><div className="eyebrow">{article.topic.name}</div><h1 className="detail-title">{article.title}</h1><p className="lead">{article.summary}</p><div className="card-meta"><span>{article.authorName}</span><span>{formatDate(article.publishedAt)}</span>{article.tags.map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)}</div></div><div className="article-body">{article.content}</div></article><aside className="article-side"><strong>Trong bài viết</strong><p className="helper">Nội dung được hiển thị theo dữ liệu bài viết từ adapter hiện tại.</p><Link className="button button-secondary" href="/articles">← Tất cả bài viết</Link></aside></div></div>; }
