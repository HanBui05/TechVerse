// Contract of /api/v1/author/ai (server/.../dto/request/Ai*Request.java, dto/response/Ai*Response.java, AiStreamEvent.java).
export type AiLength = 'SHORT' | 'MEDIUM' | 'LONG'
export type AiSection = { heading: string; subsections: string[] }
export type AiQuota = { limit: number | null; remaining: number }

type AiInput = { idea: string; length: AiLength; targetAudience: string }
// ARTICLE (default) needs topicId + tagIds; LESSON needs courseId and must not send topicId/tagIds (the server takes the course's taxonomy).
export type AiOutlineRequest = AiInput & { title?: string } & ({ targetType?: 'ARTICLE'; topicId: string; tagIds: string[] } | { targetType: 'LESSON'; courseId: string })
export type AiOutline = { title: string; summary: string; topicId: string; tagIds: string[]; suggestedTagIds: string[]; sections: AiSection[] }
export type AiDraftRequest = AiInput & { title: string; summary: string; sections: AiSection[] } & ({ targetType?: 'ARTICLE'; topicId: string; tagIds: string[] } | { targetType: 'LESSON'; courseId: string })

export type AiStreamEvent =
  | { type: 'metadata'; generationId: string; timeoutSeconds: number }
  | { type: 'delta'; text: string }
  | { type: 'completed'; generationId: string; validated: boolean; contentBytes: number; contentSha256: string; quotaRemaining: number | null }
  | { type: 'cancelled'; generationId: string; reason: string; quotaRemaining: number | null }
  | { type: 'error'; generationId: string; code: string; message: string; retryable: boolean; quotaRemaining: number | null }
