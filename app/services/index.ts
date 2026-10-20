/** HTTP adapter của frontend. Chuyển sang backend Spring Boot khi có NEXT_PUBLIC_API_URL.
 * Token được giữ trong localStorage sau login; các request protected tự gắn Bearer token. */
export type { ArticleService, AuthService, CommunityService, CourseService, DocumentService, ExerciseService, InterviewService, TaxonomyService } from "@/types/services";
import type { ArticleService, AuthService, CommunityService, CourseService, DocumentService, ExerciseService, InterviewService, PageResult, TaxonomyService } from "@/types/services";
import type { Article, Course, Document, ExerciseSet, ForumPost, InterviewQuestion, Topic, User } from "@/types/domain";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";
const token = () => typeof window === "undefined" ? "" : localStorage.getItem("techverse-token") ?? "";
/** Chuẩn hóa response profile vì PostgreSQL có thể serialize array thành PGobject khi driver trả về metadata. */
const normalizeUser = (raw: any): User => {
  const source = raw?.user ?? raw;
  const scalar = (value: unknown) => value && typeof value === "object" && "value" in value ? (value as { value: unknown }).value : value;
  let roles: unknown = source?.roles;
  const roleObject = roles as { value?: unknown } | null | undefined;
  if (!Array.isArray(roles) && roleObject?.value) roles = roleObject.value;
  if (typeof roles === "string") roles = roles.replace(/^\{|\}$/g, "").split(",").filter(Boolean);
  return {
    ...source,
    id: String(scalar(source?.id) ?? ""),
    fullName: String(scalar(source?.fullName) ?? ""),
    email: String(scalar(source?.email) ?? ""),
    avatarUrl: scalar(source?.avatarUrl) as string | undefined,
    roles: Array.isArray(roles) ? roles.map((role) => String(scalar(role) ?? "")).filter(Boolean) : []
  } as User;
};
/** PostgreSQL citext/jsonb đôi khi đi qua JDBC thành {null,type,value}; unwrap đệ quy cho mọi API response. */
const normalizeApiValue = (value: any): any => {
  if (Array.isArray(value)) return value.map(normalizeApiValue);
  if (value && typeof value === "object") {
    if ("value" in value && "type" in value) return normalizeApiValue(value.value);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeApiValue(item)]));
  }
  return value;
};
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers); headers.set("Content-Type", "application/json");
  if (token()) headers.set("Authorization", `Bearer ${token()}`);
  const response = await fetch(`${API}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || `API ${response.status}`);
  return response.status === 204 ? undefined as T : response.json().then(normalizeApiValue) as Promise<T>;
}
const qs = (params: Record<string, string | undefined>) => { const value = new URLSearchParams(); Object.entries(params).forEach(([k,v]) => v && value.set(k,v)); const text=value.toString(); return text ? `?${text}` : ""; };

const articles: ArticleService = { list: p => request<PageResult<Article>>(`/articles${qs({query:p?.query, topicId:p?.topicId, tagId:p?.tagId, page:String(p?.page ?? 1)})}`), getBySlug: async slug => { try { return await request<Article>(`/articles/${encodeURIComponent(slug)}`); } catch { return null; } }, save: id => request(`/articles/${id}/save`, {method:"POST"}), unsave: id => request(`/articles/${id}/save`, {method:"DELETE"}) };
const documents: DocumentService = { list: p => request<PageResult<Document>>(`/documents${qs({query:p?.query, topicId:p?.topicId, page:String(p?.page ?? 1)})}`), getById: async id => { try{return await request<Document>(`/documents/${id}`);}catch{return null;} }, save:id=>request(`/documents/${id}/save`,{method:"POST"}), unsave:id=>request(`/documents/${id}/save`,{method:"DELETE"}) };
const courses: CourseService = { list:p=>request<PageResult<Course>>(`/courses${qs({query:p?.query,topicId:p?.topicId,page:String(p?.page ?? 1)})}`), getById:async id=>{try{return await request<Course>(`/courses/${id}`);}catch{return null;}}, enroll:id=>request(`/courses/${id}/enroll`,{method:"POST"}) };
const exercises: ExerciseService = { list:()=>request<ExerciseSet[]>("/exercises"), getById:async id=>{try{return await request<ExerciseSet>(`/exercises/${id}`);}catch{return null;}}, submit:(id,answers)=>request(`/exercises/${id}/submit`,{method:"POST",body:JSON.stringify({answers})}) };
const interviews: InterviewService = { list: topicId=>request<InterviewQuestion[]>(`/interviews${qs({topicId})}`) };
const community: CommunityService = { listQuestions:()=>request<ForumPost[]>("/community/questions"), createQuestion:input=>request<ForumPost>("/community/questions",{method:"POST",body:JSON.stringify(input)}) };
const auth: AuthService = { getCurrentUser:async()=>{try{return normalizeUser(await request<User>("/auth/me"));}catch{return null;}}, signIn:async(email,password)=>{const data=await request<{token:string,user:User}>("/auth/login",{method:"POST",body:JSON.stringify({email,password})});localStorage.setItem("techverse-token",data.token);return normalizeUser(data.user);}, signOut:async()=>{try{await request("/auth/logout",{method:"POST"});}finally{localStorage.removeItem("techverse-token");}} };
const taxonomy: TaxonomyService = { listTopics:()=>request<Topic[]>("/topics") };
export const services = { articles, documents, courses, exercises, interviews, community, auth, taxonomy };
