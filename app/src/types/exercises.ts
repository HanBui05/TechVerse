import type { ArticleAuthor, ArticleOption } from './articles'

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

// Moderator shapes (ExercisePracticeResponse.Moderated): `set.questions` only comes with the detail.
export type ModeratorExerciseSummary = { set: ExerciseSummary; author: ArticleAuthor; authorEligible: boolean; reviewToken: string }
export type ModeratorExerciseDetail = Omit<ModeratorExerciseSummary, 'set'> & { set: ExerciseSet }
export type ModeratorExerciseFilter = { page: number; size: number; status: ExerciseStatus | ''; type?: ExerciseType | ''; topicId?: string; keyword?: string }
export type ExerciseModeration = 'APPROVE' | 'REQUEST_CHANGES' | 'HIDE' | 'RESTORE' | 'REMOVE'

// Learner side (ExercisePracticeResponse): a quiz question never carries the answer before the attempt is graded.
export type PracticeViewer = { canAttempt: boolean; reason: 'LOGIN_REQUIRED' | 'OWNER' | 'STAFF' | null }
export type QuizItem = { questionId: string; position: number; content: string; codeSnippet: string | null; codeLanguage: string | null; options: string[]; correctIndex: number; selectedIndex: number | null; correct: boolean; explanation: string }
export type CardItem = { questionId: string; position: number; front: string; back: string; explanation: string; remembered: boolean }
export type AttemptItem = QuizItem | CardItem
export type PracticeAttempt = { id: string; exerciseSetId: string; title: string; type: ExerciseType; correctCount: number; totalCount: number; percent: number; durationSeconds: number; completedAt: string; items: AttemptItem[] | null }
export type PracticeSet = {
  id: string; title: string; description: string; topic: ArticleOption; type: ExerciseType; difficulty: ExerciseDifficulty; questionCount: number
  author: ArticleAuthor; publishedAt: string; lastAttempt: PracticeAttempt | null; viewer: PracticeViewer | null
}
export type QuizQuestion = { id: string; position: number; content: string; codeSnippet: string | null; codeLanguage: string | null; options: string[] }
export type CardQuestion = { id: string; position: number; front: string; back: string; explanation: string }
export type PracticeQuestions = { setId: string; type: ExerciseType; questions: (QuizQuestion | CardQuestion)[] }
export type PracticeFilter = { topicId: string; difficulty: ExerciseDifficulty | ''; type: ExerciseType | ''; keyword: string; page: number }
export type AttemptBody = { answers: { questionId: string; selectedIndex: number | null }[]; durationSeconds: number } | { results: { questionId: string; remembered: boolean }[]; durationSeconds: number }
