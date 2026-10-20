"use client";
import { useEffect, useState } from "react";
import { services } from "@/services";
import { Card, Loading, PageHeading } from "@/components/ui";
import type { User } from "@/types/domain";

export default function ProfilePage() { const [user, setUser] = useState<User | null>(null); useEffect(() => { services.auth.getCurrentUser().then(setUser); }, []); if (!user) return <div className="container"><Loading /></div>; return <div className="container"><PageHeading eyebrow="Personal area" title="Khu vực cá nhân" description="Thông tin tài khoản được tải từ endpoint /api/auth/me." /><div className="profile-grid"><Card><div className="avatar">{user.fullName.charAt(0)}</div><h3>{user.fullName}</h3><p>{user.email}</p><div className="card-meta">{user.roles.join(" · ")}</div></Card><Card><h2>Hồ sơ cá nhân</h2><div className="list-row"><span>Trạng thái</span><strong>{user.isActive ? "Đang hoạt động" : "Đã khóa"}</strong></div><div className="list-row"><span>Email xác thực</span><strong>{user.emailVerifiedAt ? "Đã xác thực" : "Chưa xác thực"}</strong></div><p className="helper">Các thao tác lưu bài, lưu tài liệu, đăng ký khóa học và nộp bài đều dùng token của tài khoản này.</p></Card></div></div>; }
