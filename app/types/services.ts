import type { Article, Course, Document, ExerciseSet, ForumPost, InterviewQuestion, Topic, User } from "./domain";

export type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };
export type ArticleListParams = { query?: string; topicId?: string; tagId?: string; page?: number };
export type ContentListParams = { query?: string; topicId?: string; page?: number };

export interface ArticleService {
  list(params?: ArticleListParams): Promise<PageResult<Article>>;
  getBySlug(slug: string): Promise<Article | null>;
  save(articleId: string): Promise<void>;
  unsave(articleId: string): Promise<void>;
}

export interface DocumentService {
  list(params?: ContentListParams): Promise<PageResult<Document>>;
  getById(id: string): Promise<Document | null>;
  save(documentId: string): Promise<void>;
  unsave(documentId: string): Promise<void>;
}

export interface CourseService { list(params?: ContentListParams): Promise<PageResult<Course>>; getById(id: string): Promise<Course | null>; enroll(courseId: string): Promise<void>; }
export interface ExerciseService { list(): Promise<ExerciseSet[]>; getById(id: string): Promise<ExerciseSet | null>; submit(id: string, answers: Record<string, string>): Promise<{ correctCount: number; totalCount: number; explanations: Record<string, string> }>; }
export interface InterviewService { list(topicId?: string): Promise<InterviewQuestion[]>; }
export interface CommunityService { listQuestions(): Promise<ForumPost[]>; createQuestion(input: { title: string; content: string }): Promise<ForumPost>; }
export interface AuthService { getCurrentUser(): Promise<User | null>; signIn(email: string, password: string): Promise<User>; signOut(): Promise<void>; }
export interface TaxonomyService { listTopics(): Promise<Topic[]>; }
