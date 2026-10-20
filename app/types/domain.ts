export type UUID = string;

export type User = {
  id: UUID;
  fullName: string;
  email: string;
  avatarUrl?: string;
  isActive: boolean;
  emailVerifiedAt?: string;
  roles: Array<"LEARNER" | "AUTHOR" | "MODERATOR" | "ADMIN">;
};

export type Topic = { id: UUID; name: string; description?: string; isActive: boolean };
export type Tag = { id: UUID; name: string; description?: string; isActive: boolean };

export type Article = {
  id: UUID;
  slug: string;
  authorId: UUID;
  authorName: string;
  topic: Topic;
  tags: Tag[];
  title: string;
  summary: string;
  content: string;
  coverImageUrl?: string;
  status: "PUBLISHED";
  publishedAt: string;
  isSaved: boolean;
};

export type Document = {
  id: UUID;
  authorId: UUID;
  authorName: string;
  title: string;
  summary: string;
  sourceType: "PDF" | "NOTION";
  resourceUrl: string;
  fileSizeBytes?: number;
  sourceNote: string;
  status: "PUBLISHED";
  publishedAt: string;
  isSaved: boolean;
};

export type Lesson = { id: UUID; courseId: UUID; title: string; content: string; videoUrl?: string; position: number; completed: boolean };
export type Course = {
  id: UUID;
  authorId: UUID;
  authorName: string;
  topic: Topic;
  title: string;
  summary: string;
  description: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  priceAmount: number;
  currency: "VND";
  status: "PUBLISHED";
  publishedAt: string;
  lessons: Lesson[];
  enrolled: boolean;
};

export type ExerciseQuestion = { id: UUID; content: string; codeSnippet?: string; codeLanguage?: string; options?: string[]; answer: string; explanation: string; position: number };
export type ExerciseSet = { id: UUID; authorId: UUID; topic: Topic; title: string; description: string; exerciseType: "MULTIPLE_CHOICE" | "FLASHCARD" | "CODE_BUG_FINDING" | "DEBUG_SCENARIO"; difficulty: "EASY" | "MEDIUM" | "HARD"; timeLimitSeconds?: number; questions: ExerciseQuestion[] };
export type InterviewQuestion = { id: UUID; topic: Topic; level: "EASY" | "MEDIUM" | "HARD"; question: string; sampleAnswer: string; hint?: string };
export type ForumPost = { id: UUID; userId: UUID; authorName: string; parentId?: UUID; title?: string; content: string; createdAt: string; status: "VISIBLE" };

