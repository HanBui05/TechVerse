import type { ArticleOption } from './articles'

// Contract of /api/v1/author/exercise-sets (server/.../dto/{request,response}/ExerciseSet*.java, ExerciseAiService.Suggestions).
export type ExerciseType = 'MULTIPLE_CHOICE' | 'FLASHCARD'
export type ExerciseDifficulty = 'EASY' | 'MEDIUM' | 'HARD'
export type ExerciseStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'CHANGES_REQUESTED' | 'AUTHOR_HIDDEN' | 'HIDDEN' | 'REMOVED'

/** Quiz uses content/options/correctIndex/explanation, a card uses front/back/explanation; the other fields are null. */
export type ExerciseQuestion = {
  content: string | null; codeSnippet: string | null; codeLanguage: string | null; options: string[] | null; correctIndex: number | null
  explanation: string | null; front: string | null; back: string | null
}
export type ExerciseSummary = {
  id: string; title: string; description: string; topic: ArticleOption; type: ExerciseType; difficulty: ExerciseDifficulty; status: ExerciseStatus
  aiAssisted: boolean; version: number; moderationNote: string | null; questionCount: number; publishedAt: string | null; createdAt: string; updatedAt: string
}
export type ExerciseSet = ExerciseSummary & { questions: (ExerciseQuestion & { id: string; position: number })[] }
export type ExerciseFilter = { page: number; size: number; status?: ExerciseStatus | ''; type?: ExerciseType | ''; keyword?: string }
export type ExerciseInfo = { title: string; description: string; topicId: string; difficulty: ExerciseDifficulty; type: ExerciseType }
export type AiQuestionsRequest = { version: number; instruction: string; sourceText: string; count: number }
export type AiSuggestions = { questions: ExerciseQuestion[]; requested: number; version: number }
