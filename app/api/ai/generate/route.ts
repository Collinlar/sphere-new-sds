import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { extractJsonBlock, groqChat } from '@/lib/groq'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { AddOnId } from '@/lib/types'

const PROHIBITIONS =
  'Your output must not contain em dashes. Your output must not contain any of the following phrases: In today\'s fast-paced world, Leverage your full potential, Unlock the power of, Take your business to the next level, Seamlessly integrate, Best-in-class, Cutting-edge, Robust solution, Streamlined, Game-changing, Innovative approach, Transformative experience, Empowering businesses to, In the digital age, In an increasingly competitive landscape, It\'s never been easier to.'

async function getAuthedUserId() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function assertAddOn(userId: string, addOnId: AddOnId): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'AI access check is not configured.' }

  const { data: user } = await admin.from('users').select('subscription_tier').eq('id', userId).single()
  const planId = user?.subscription_tier ?? 'membership'

  const { data: addOn } = await admin.from('add_ons').select('eligible_plans').eq('id', addOnId).single()
  const eligible: string[] = addOn?.eligible_plans ?? []
  if (!eligible.includes(planId)) {
    return { ok: false, error: 'Upgrade to Creator or Institution before using this AI add-on.' }
  }

  const { data: active } = await admin
    .from('user_add_ons')
    .select('id')
    .eq('user_id', userId)
    .eq('add_on_id', addOnId)
    .eq('status', 'active')
    .maybeSingle()

  if (!active) {
    return { ok: false, error: 'Add this AI feature from Plan and billing first.' }
  }

  return { ok: true }
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to use AI features.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const addOnId = body?.addOnId as AddOnId | undefined
  const task = body?.task as string | undefined
  const prompt = (body?.prompt as string | undefined)?.trim()
  const context = body?.context as Record<string, unknown> | undefined

  if (!addOnId || !task) {
    return NextResponse.json({ error: 'Missing AI request details.' }, { status: 400 })
  }

  const needsPrompt = !['bulk_explanations'].includes(task)
  if (needsPrompt && !prompt) {
    return NextResponse.json({ error: 'Missing AI request details.' }, { status: 400 })
  }

  const gate = await assertAddOn(userId, addOnId)
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 })
  }

  let system = ''
  let userPrompt = prompt ?? ''

  if (task === 'assessment_questions') {
    const typeMix = (context?.typeMix as Record<string, number> | undefined) ?? {}
    const mcq = typeMix.mcq ?? 0
    const trueFalse = typeMix.true_false ?? 0
    const short = typeMix.short ?? 0
    const essay = typeMix.essay ?? 0
    const total = context?.count ?? mcq + trueFalse + short + essay
    const difficulty = (context?.difficulty as string | undefined) ?? 'standard'
    const detail = (context?.detail as string | undefined)?.trim()
    const marks = (context?.marksPerType as Record<string, number> | undefined) ?? {
      mcq: 2,
      true_false: 1,
      short: 4,
      essay: 10,
    }

    system = `You write exam questions for Ghanaian schools. Return JSON only with key "questions" as an array of exactly ${total} items.
Each item: id (uuid string), type ("mcq"|"true_false"|"short"|"essay"), text, options (array of {label,text} for mcq and true_false only), correct (option label for mcq/true_false), marks (number).
You MUST generate exactly this type distribution and no other types:
- mcq: ${mcq}
- true_false: ${trueFalse}
- short: ${short}
- essay: ${essay}
Default marks if omitted: mcq ${marks.mcq}, true_false ${marks.true_false}, short ${marks.short}, essay ${marks.essay}.
Use BECE/WASSCE style, Ghanaian examples, GHS where money appears. Difficulty: ${difficulty}.
${PROHIBITIONS}`

    userPrompt = [
      `Subject: ${context?.subject ?? 'General'}.`,
      `Level: ${context?.gradeLevel ?? 'JHS'}.`,
      `Topic: ${prompt}.`,
      detail ? `Syllabus notes: ${detail}` : null,
      `Generate exactly ${total} questions with the type counts above.`,
    ].filter(Boolean).join(' ')
  } else if (task === 'course_modules') {
    const typeMix = (context?.typeMix as Record<string, number> | undefined) ?? {}
    const reading = typeMix.reading ?? 0
    const video = typeMix.video ?? 0
    const quiz = typeMix.quiz ?? 0
    const assignment = typeMix.assignment ?? 0
    const flashcards = typeMix.flashcards ?? 0
    const total = context?.count ?? reading + video + quiz + assignment + flashcards
    const depth = (context?.depth as string | undefined) ?? (context?.difficulty as string | undefined) ?? 'standard'
    const detail = (context?.detail as string | undefined)?.trim()
    const minutes = (context?.durationPerType as Record<string, number> | undefined) ?? (context?.minutesPerType as Record<string, number> | undefined) ?? {
      reading: 15,
      video: 12,
      quiz: 10,
      assignment: 25,
      flashcards: 8,
    }

    const readingParas = depth === 'deep' ? '3 short paragraphs' : depth === 'overview' ? '1-2 short paragraphs' : '2-3 short paragraphs'
    const quizCount = depth === 'deep' ? '4' : depth === 'overview' ? '3' : '3-4'
    const cardCount = depth === 'deep' ? '6' : '4'

    system = `You write course modules for Ghanaian teachers and trainers.
Return ONLY valid JSON (no markdown fences, no commentary) with key "modules" as an array of exactly ${total} items in a sensible learning order.
Each item keys: id (string), title (string), type ("reading"|"video"|"quiz"|"assignment"|"flashcards"), duration_minutes (number), is_mandatory (boolean), content (object).
You MUST generate exactly this type distribution and no other types:
- reading: ${reading}
- video: ${video}
- quiz: ${quiz}
- assignment: ${assignment}
- flashcards: ${flashcards}
Content rules by type (keep strings compact, no newlines inside option text):
- reading: content.body with ${readingParas}, Ghanaian classroom examples
- video: content.video_url as "", content.body as a short lesson outline (max 80 words)
- quiz: content.questions as array of exactly ${quizCount} items, each { "question": string, "options": [string,string,string,string], "correct": number 0-3 }
- assignment: content.instructions as one clear student task (max 60 words)
- flashcards: content.cards as array of exactly ${cardCount} items, each { "front": string, "back": string }
Default duration_minutes: reading ${minutes.reading}, video ${minutes.video}, quiz ${minutes.quiz}, assignment ${minutes.assignment}, flashcards ${minutes.flashcards}.
Depth: ${depth}. Use Ghanaian examples and GHS where money appears.
${PROHIBITIONS}`

    userPrompt = [
      `Course topic: ${prompt}.`,
      `Subject: ${context?.subject ?? 'General'}.`,
      `Level: ${context?.gradeLevel ?? 'JHS'}.`,
      detail ? `Syllabus notes: ${detail}` : null,
      `Create exactly ${total} modules with the type counts above. Reply with JSON only.`,
    ].filter(Boolean).join(' ')
  } else if (task === 'engage_questions') {
    const typeMix = (context?.typeMix as Record<string, number> | undefined) ?? {}
    const mcq = typeMix.mcq ?? 0
    const trueFalse = typeMix.true_false ?? 0
    const multiSelect = typeMix.multi_select ?? 0
    const shortAnswer = typeMix.short_answer ?? 0
    const poll = typeMix.poll ?? 0
    const total = context?.count ?? mcq + trueFalse + multiSelect + shortAnswer + poll
    const timeSeconds = (context?.timeSeconds as number | undefined) ?? 20
    const detail = (context?.detail as string | undefined)?.trim()

    system = `You write fast-paced live quiz questions for Ghanaian classrooms (Kahoot-style).
Return ONLY valid JSON (no markdown fences) with key "questions" as an array of exactly ${total} items.
Each item: id (uuid string), type ("mcq"|"true_false"|"multi_select"|"short_answer"|"poll"), text, options (array of {label,text}), correct (single option label for mcq/true_false), correct_multiple (array of labels for multi_select, else []), correct_text (string for short_answer, else ""), time_seconds (number, use ${timeSeconds}), points (number, default 100).
You MUST generate exactly this type distribution:
- mcq: ${mcq}
- true_false: ${trueFalse}
- multi_select: ${multiSelect}
- short_answer: ${shortAnswer}
- poll: ${poll}
Option rules: mcq/multi_select/poll/short_answer use exactly 4 options labelled A-D. true_false uses A=True, B=False.
Keep questions punchy and answerable in under ${timeSeconds} seconds. Use Ghanaian examples and GHS where money appears.
${PROHIBITIONS}`

    userPrompt = [
      `Subject: ${context?.subject ?? 'General'}.`,
      `Level: ${context?.gradeLevel ?? 'JHS'}.`,
      `Topic: ${prompt}.`,
      detail ? `Notes: ${detail}` : null,
      `Generate exactly ${total} live quiz questions with the type counts above. Reply with JSON only.`,
    ].filter(Boolean).join(' ')
  } else if (task === 'training_steps') {
    const typeMix = (context?.typeMix as Record<string, number> | undefined) ?? {}
    const video = typeMix.video ?? 0
    const reading = typeMix.reading ?? 0
    const quiz = typeMix.quiz ?? 0
    const signOff = typeMix.sign_off ?? 0
    const assessment = typeMix.assessment ?? 0
    const total = context?.count ?? video + reading + quiz + signOff + assessment
    const depth = (context?.depth as string | undefined) ?? 'standard'
    const detail = (context?.detail as string | undefined)?.trim()
    const minutes = (context?.durationPerType as Record<string, number> | undefined) ?? {
      video: 12,
      reading: 15,
      quiz: 10,
      sign_off: 5,
      assessment: 20,
    }

    system = `You write corporate training steps for Ghanaian workplaces.
Return ONLY valid JSON (no markdown fences) with key "steps" as an array of exactly ${total} items in a sensible learning order.
Each item: id (string), title, type ("video"|"reading"|"quiz"|"sign_off"|"assessment"), duration_minutes (number), is_mandatory (boolean), content (object).
You MUST generate exactly this type distribution:
- video: ${video}
- reading: ${reading}
- quiz: ${quiz}
- sign_off: ${signOff}
- assessment: ${assessment}
Content rules by type (keep compact):
- video: content.video_url as "", content.body as a short lesson outline (max 60 words)
- reading: content.body as ${depth === 'deep' ? '3' : depth === 'overview' ? '1-2' : '2'} short workplace paragraphs
- quiz: content.questions as 3 items, each { question, options (4 strings), correct (0-based index) }
- sign_off: content.statement as the acknowledgement text the employee must confirm
- assessment: content.instructions as a short practical task (max 50 words)
Default duration_minutes: video ${minutes.video}, reading ${minutes.reading}, quiz ${minutes.quiz}, sign_off ${minutes.sign_off}, assessment ${minutes.assessment}.
Depth: ${depth}. Use Ghanaian workplace examples and GHS where money appears.
${PROHIBITIONS}`

    userPrompt = [
      `Training brief: ${prompt}.`,
      `Category: ${context?.category ?? 'Compliance'}.`,
      detail ? `Notes: ${detail}` : null,
      `Create exactly ${total} steps with the type counts above. Reply with JSON only.`,
    ].filter(Boolean).join(' ')
  } else if (task === 'question_hint') {
    system = `You write short exam hints for Ghanaian students. Return JSON only with key "hint" as a single string. The hint nudges without giving the answer. Max 2 sentences. ${PROHIBITIONS}`
    userPrompt = `Subject: ${context?.subject ?? 'General'}. Level: ${context?.gradeLevel ?? 'JHS'}. Question: ${context?.questionText ?? prompt}. Write a contextual hint.`
  } else if (task === 'question_explanation') {
    system = `You write exam answer explanations for Ghanaian students. Return JSON only with key "explanation" as a single string. Explain why the correct answer is right. Max 3 sentences. ${PROHIBITIONS}`
    userPrompt = `Subject: ${context?.subject ?? 'General'}. Level: ${context?.gradeLevel ?? 'JHS'}. Question: ${context?.questionText ?? prompt}. Correct answer: ${context?.correctAnswer ?? 'see question'}. Write the explanation.`
  } else if (task === 'bulk_explanations') {
    system = `You write exam answer explanations for Ghanaian students. Return JSON only with key "explanations" as array of strings, one per question in order. Max 3 sentences each. ${PROHIBITIONS}`
    userPrompt = `Subject: ${context?.subject ?? 'General'}. Level: ${context?.gradeLevel ?? 'JHS'}. Questions JSON: ${JSON.stringify(context?.questions ?? [])}. Write explanations for each.`
  } else {
    return NextResponse.json({ error: 'That AI task is not supported yet.' }, { status: 400 })
  }

  const result = await groqChat({
    system,
    user: userPrompt,
    temperature: task === 'course_modules' || task === 'training_steps' || task === 'engage_questions' ? 0.25 : 0.4,
    jsonMode: true,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  try {
    const parsed = extractJsonBlock(result.content) as Record<string, unknown>
    return NextResponse.json({ ok: true, data: parsed })
  } catch {
    return NextResponse.json({
      error: 'The draft came back in a format we could not read. Tap draft again.',
    }, { status: 502 })
  }
}
