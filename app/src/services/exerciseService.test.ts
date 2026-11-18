import { expect, it } from 'vitest'
import { emptyQuestion, exerciseActions, infoErrors, questionBody, questionErrors } from './exerciseService'
import type { ExerciseQuestion } from '../types/exercises'

const quiz = (over: Partial<ExerciseQuestion> = {}): ExerciseQuestion => ({ ...emptyQuestion('MULTIPLE_CHOICE'), content: 'SELECT khác gì?', options: ['A', 'B'], correctIndex: 1, explanation: 'Vì thế.', ...over })
const card = (over: Partial<ExerciseQuestion> = {}): ExerciseQuestion => ({ ...emptyQuestion('FLASHCARD'), front: 'Trước', back: 'Sau', ...over })
const long = (n: number) => 'x'.repeat(n)

it('accepts a valid quiz question and card', () => {
  expect(questionErrors(quiz())).toEqual({})
  expect(questionErrors(card())).toEqual({})
})

it('checks content and explanation bounds (1–2.000) for a quiz', () => {
  expect(questionErrors(quiz({ content: '  ' })).content).toBe('required')
  expect(questionErrors(quiz({ content: long(2000) })).content).toBeUndefined()
  expect(questionErrors(quiz({ content: long(2001) })).content).toBe('tooLong')
  expect(questionErrors(quiz({ explanation: '' })).explanation).toBe('required')
  expect(questionErrors(quiz({ explanation: long(2001) })).explanation).toBe('tooLong')
})

it('checks 2–6 options of 1–500 characters, no duplicates, and a correct index in range', () => {
  expect(questionErrors(quiz({ options: ['A'], correctIndex: 0 })).options).toBe('optionCount')
  expect(questionErrors(quiz({ options: ['1', '2', '3', '4', '5', '6', '7'], correctIndex: 0 })).options).toBe('optionCount')
  expect(questionErrors(quiz({ options: ['1', '2', '3', '4', '5', '6'], correctIndex: 5 }))).toEqual({})
  expect(questionErrors(quiz({ options: ['A', ' '] }))['option-1']).toBe('required')
  expect(questionErrors(quiz({ options: ['A', long(501)] }))['option-1']).toBe('tooLong')
  expect(questionErrors(quiz({ options: ['Java', ' java '] }))['option-1']).toBe('optionDuplicate')
  expect(questionErrors(quiz({ correctIndex: null })).correct).toBe('correctRequired')
  expect(questionErrors(quiz({ correctIndex: 2 })).correct).toBe('correctRequired')
})

it('needs a language for a code snippet and caps the snippet at 5.000 and the language at 50', () => {
  expect(questionErrors(quiz({ codeSnippet: 'x = 1', codeLanguage: '' })).codeLanguage).toBe('languageRequired')
  expect(questionErrors(quiz({ codeSnippet: 'x = 1', codeLanguage: 'python' }))).toEqual({})
  expect(questionErrors(quiz({ codeSnippet: long(5001), codeLanguage: 'js' })).codeSnippet).toBe('tooLong')
  expect(questionErrors(quiz({ codeSnippet: 'x', codeLanguage: long(51) })).codeLanguage).toBe('tooLong')
  expect(questionErrors(quiz({ codeSnippet: '', codeLanguage: null }))).toEqual({}) // an empty snippet means no code
})

it('checks card faces 1–1.000 and an optional explanation up to 2.000', () => {
  expect(questionErrors(card({ front: '' })).front).toBe('required')
  expect(questionErrors(card({ back: long(1001) })).back).toBe('tooLong')
  expect(questionErrors(card({ back: long(1000) }))).toEqual({})
  expect(questionErrors(card({ explanation: '' }))).toEqual({})
  expect(questionErrors(card({ explanation: long(2001) })).explanation).toBe('tooLong')
})

it('refuses Markdown images and NUL (EXERCISE_CONTENT_INVALID) in every text', () => {
  expect(questionErrors(quiz({ content: 'xem ![sơ đồ](https://a.b/c.png)' })).content).toBe('contentInvalid')
  expect(questionErrors(quiz({ options: ['A', 'B\0'] }))['option-1']).toBe('contentInvalid')
  expect(questionErrors(card({ back: '![x](y)' })).back).toBe('contentInvalid')
  expect(questionErrors(quiz({ content: 'Đường dẫn [link](https://a.b) hợp lệ' }))).toEqual({})
})

it('validates the metadata like the 1a table', () => {
  const ok = { title: 'SQL cơ bản', description: '', topicId: 't1', difficulty: 'EASY' as const, type: 'MULTIPLE_CHOICE' as const }
  expect(infoErrors(ok)).toEqual({})
  expect(infoErrors({ ...ok, title: ' abcd ' }).title).toBe('titleLength')
  expect(infoErrors({ ...ok, title: long(256) }).title).toBe('titleLength')
  expect(infoErrors({ ...ok, description: long(2001) }).description).toBe('descriptionLength')
  expect(infoErrors({ ...ok, topicId: '' }).topicId).toBe('topicRequired')
})

it('sends only the fields of the set type', () => {
  expect(questionBody(card())).toEqual({ front: 'Trước', back: 'Sau', explanation: '' })
  expect(questionBody(quiz({ codeSnippet: null, codeLanguage: 'js' }))).toMatchObject({ codeSnippet: null, codeLanguage: null, correctIndex: 1 })
  expect(questionBody(quiz({ codeSnippet: 'x', codeLanguage: 'js' }))).toMatchObject({ codeSnippet: 'x', codeLanguage: 'js' })
})

it('offers each status only the actions the backend accepts', () => {
  const at = (status: Parameters<typeof exerciseActions>[0]['status'], publishedAt: string | null = null) => exerciseActions({ status, publishedAt })
  expect(at('DRAFT')).toEqual({ primary: 'edit', actions: ['copy', 'delete'], readOnly: false })
  expect(at('CHANGES_REQUESTED').actions).toEqual(['copy', 'delete'])
  expect(at('CHANGES_REQUESTED', '2026-11-01').actions).toEqual(['copy']) // once published it can never be deleted
  expect(at('PENDING')).toEqual({ primary: 'view', actions: ['withdraw', 'copy'], readOnly: true })
  expect(at('PUBLISHED', '2026-11-01').actions).toEqual(['copy', 'hide'])
  expect(at('AUTHOR_HIDDEN', '2026-11-01').actions).toEqual(['copy', 'unhide'])
  expect(at('HIDDEN').actions).toEqual(['copy'])
  expect(at('REMOVED').actions).toEqual(['copy'])
})
