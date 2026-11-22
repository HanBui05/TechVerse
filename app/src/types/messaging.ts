import type { ArticleAuthor } from './articles'

export type ConversationRole = 'LEARNER' | 'AUTHOR'

export type ContextCourse = {
  id: string | null
  title: string
  available: boolean
}

export type ConversationSummary = {
  id: string
  other: ArticleAuthor
  role: ConversationRole
  contextCourse: ContextCourse
  contextEnrolled: boolean | null
  lastMessageExcerpt: string | null
  lastMessageAt: string | null
  unread: boolean
  blockedByMe: boolean
  blockedByOther: boolean
  locked: boolean
}

export type ConversationDetail = ConversationSummary & {
  canSend: boolean
  remainingBeforeReply: number | null
}

export type ConversationMessage = {
  id: string
  seq: number
  senderId: string
  mine: boolean
  content: string
  createdAt: string
  clientId?: string
  deliveryState?: 'sending' | 'failed' | 'sent'
  errorText?: string
}

export type ConversationMessagesPage = {
  messages: ConversationMessage[]
  hasMore: boolean
}

export type UnreadCountResponse = {
  count: number
}

export type SocketTicketResponse = {
  ticket: string
  expiresAt: string
}

export type LockedConversationItem = {
  id: string
  learner: ArticleAuthor
  author: ArticleAuthor
  blocked?: boolean
  locked?: boolean
  lockedBy: ArticleAuthor | null
  lockedAt: string | null
  lockNote: string | null
}

export type MessagingPage<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
}

export type MessagingSocketEvent =
  | { type: 'message'; conversationId: string; seq: number }
  | { type: 'unread' }
  | { type: 'state'; conversationId: string }
  | { type: 'reconnected' }
  | { type: 'poll-active' }
  | { type: 'poll-list' }
  | { type: 'connection'; status: 'connected' | 'reconnecting' | 'polling' | 'idle' }
