import { supabase } from '@/lib/supabase'
import type { ExamQuestion } from '@/lib/types'

export interface BankQuestionRow {
  id: string
  institution_id: string | null
  creator_id: string | null
  subject: string | null
  topic: string | null
  difficulty: 'foundation' | 'standard' | 'challenge' | null
  question: ExamQuestion
  created_at: string
}

export async function listBankQuestions(params: {
  institutionId?: string | null
  creatorId: string
  subject?: string
  topic?: string
  difficulty?: string
}): Promise<BankQuestionRow[]> {
  let query = supabase
    .from('bank_questions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (params.institutionId) {
    query = query.or(`institution_id.eq.${params.institutionId},creator_id.eq.${params.creatorId}`)
  } else {
    query = query.eq('creator_id', params.creatorId)
  }

  if (params.subject) query = query.eq('subject', params.subject)
  if (params.topic) query = query.ilike('topic', `%${params.topic}%`)
  if (params.difficulty) query = query.eq('difficulty', params.difficulty)

  const { data } = await query
  return (data ?? []).map((row) => ({
    ...row,
    question: row.question as ExamQuestion,
  })) as BankQuestionRow[]
}

export async function saveToQuestionBank(input: {
  institutionId?: string | null
  creatorId: string
  subject?: string | null
  topic?: string | null
  difficulty?: 'foundation' | 'standard' | 'challenge' | null
  question: ExamQuestion
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const clone: ExamQuestion = {
    ...input.question,
    id: crypto.randomUUID(),
    options: input.question.options?.map((o) => ({ ...o })),
  }

  const { data, error } = await supabase
    .from('bank_questions')
    .insert({
      institution_id: input.institutionId ?? null,
      creator_id: input.creatorId,
      subject: input.subject ?? null,
      topic: input.topic ?? null,
      difficulty: input.difficulty ?? null,
      question: clone,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: 'We could not save that question to your bank. Try again.' }
  }
  return { ok: true, id: data.id as string }
}

export async function deleteBankQuestion(id: string): Promise<boolean> {
  const { error } = await supabase.from('bank_questions').delete().eq('id', id)
  return !error
}

export function cloneBankQuestionIntoExam(row: BankQuestionRow): ExamQuestion {
  const q = row.question
  return {
    ...q,
    id: crypto.randomUUID(),
    options: q.options?.map((o) => ({ ...o })),
  }
}
