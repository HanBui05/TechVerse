// Contract of /api/v1/author/ai (server/.../dto/request/Ai*Request.java, dto/response/Ai*Response.java, AiStreamEvent.java).
export type AiLength = 'SHORT' | 'MEDIUM' | 'LONG'
export type AiSection = { heading: string; subsections: string[] }
export type AiQuota = { limit: number | null; remaining: number }

export type AiOutlineRequest = { title?: string; topicId: string; tagIds: string[]; idea: string; length: AiLength; targetAudience: string }
export type AiOutline = { title: string; summary: string; topicId: string; tagIds: string[]; suggestedTagIds: string[]; sections: AiSection[] }
export type AiDraftRequest = Required<AiOutlineRequest> & { summary: string; sections: AiSection[] }

export type AiStreamEvent =
  | { type: 'metadata'; generationId: string; timeoutSeconds: number }
  | { type: 'delta'; text: string }
  | { type: 'completed'; generationId: string; validated: boolean; contentBytes: number; contentSha256: string; quotaRemaining: number | null }
  | { type: 'cancelled'; generationId: string; reason: string; quotaRemaining: number | null }
  | { type: 'error'; generationId: string; code: string; message: string; retryable: boolean; quotaRemaining: number | null }
