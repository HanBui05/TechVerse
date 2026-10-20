import { articles, courses, currentUser, documents, exerciseSets, forumPosts, interviewQuestions, topics } from "@/mocks/data";
import type { ArticleService, AuthService, CommunityService, ContentListParams, CourseService, DocumentService, ExerciseService, InterviewService, PageResult, TaxonomyService } from "@/types/services";
import type { Article, Course, Document, ExerciseSet, ForumPost } from "@/types/domain";
import { PAGE_SIZE } from "@/lib/constants";

const wait = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));
const page = <T>(items: T[], requestedPage = 1): PageResult<T> => ({ items, total: items.length, page: requestedPage, pageSize: PAGE_SIZE });

export const mockArticleService: ArticleService = {
  async list(params = {}) { await wait(); let result = [...articles]; if (params.query) result = result.filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(params.query!.toLowerCase())); if (params.topicId) result = result.filter((item) => item.topic.id === params.topicId); if (params.tagId) result = result.filter((item) => item.tags.some((tag) => tag.id === params.tagId)); return page(result, params.page); },
  async getBySlug(slug) { await wait(); return articles.find((item) => item.slug === slug) ?? null; },
  async save(id) { const item = articles.find((article) => article.id === id); if (item) item.isSaved = true; await wait(80); },
  async unsave(id) { const item = articles.find((article) => article.id === id); if (item) item.isSaved = false; await wait(80); }
};

export const mockDocumentService: DocumentService = {
  async list(params = {}) { await wait(); let result = [...documents]; if (params.query) result = result.filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(params.query!.toLowerCase())); return page(result, params.page); },
  async getById(id) { await wait(); return documents.find((item) => item.id === id) ?? null; },
  async save(id) { const item = documents.find((document) => document.id === id); if (item) item.isSaved = true; await wait(80); },
  async unsave(id) { const item = documents.find((document) => document.id === id); if (item) item.isSaved = false; await wait(80); }
};

export const mockCourseService: CourseService = {
  async list(params: ContentListParams = {}) { await wait(); let result = [...courses]; if (params.query) result = result.filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(params.query!.toLowerCase())); return page(result, params.page); },
  async getById(id) { await wait(); return courses.find((item) => item.id === id) ?? null; },
  async enroll(id) { const item = courses.find((course) => course.id === id); if (item) item.enrolled = true; await wait(80); }
};

export const mockExerciseService: ExerciseService = {
  async list() { await wait(); return exerciseSets; },
  async getById(id) { await wait(); return exerciseSets.find((item) => item.id === id) ?? null; },
  async submit(id, answers) { await wait(240); const set = exerciseSets.find((item) => item.id === id); const questions = set?.questions ?? []; const correctCount = questions.filter((question) => answers[question.id] === question.answer).length; return { correctCount, totalCount: questions.length, explanations: Object.fromEntries(questions.map((question) => [question.id, question.explanation])) }; }
};

export const mockInterviewService: InterviewService = { async list(topicId) { await wait(); return topicId ? interviewQuestions.filter((item) => item.topic.id === topicId) : interviewQuestions; } };
export const mockCommunityService: CommunityService = { async listQuestions() { await wait(); return forumPosts.filter((post) => !post.parentId); }, async createQuestion(input) { await wait(80); const item: ForumPost = { id: `post-${Date.now()}`, userId: currentUser.id, authorName: currentUser.fullName, ...input, createdAt: new Date().toISOString(), status: "VISIBLE" }; forumPosts.push(item); return item; } };
export const mockAuthService: AuthService = { async getCurrentUser() { await wait(80); return currentUser; }, async signIn() { await wait(180); return currentUser; }, async signOut() { await wait(80); } };
export const mockTaxonomyService: TaxonomyService = { async listTopics() { await wait(80); return topics; } };

// API seam: replace these exports with HTTP-backed services when backend contracts exist.
export const services = { articles: mockArticleService, documents: mockDocumentService, courses: mockCourseService, exercises: mockExerciseService, interviews: mockInterviewService, community: mockCommunityService, auth: mockAuthService, taxonomy: mockTaxonomyService };
export type ServiceRegistry = typeof services;
export type SupportedEntity = Article | Document | Course | ExerciseSet;
