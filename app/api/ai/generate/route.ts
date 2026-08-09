import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { extractJsonBlock, groqChat, MAX_OUTPUT_TOKENS } from '@/lib/groq'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkAndRecordGeneration } from '@/lib/ai-usage'
import {
  loadCreditAccount,
  creditCostForItems,
  spendCredits,
  type CreditOwner,
} from '@/lib/ai-credits'
import type { AddOnId } from '@/lib/types'

// Style floor for every generation. Kept short: the item-quality rules below
// carry the real weight, and long prohibition lists crowd them out.
const STYLE_RULES = `Write plainly and specifically. No em dashes. No filler openers
("In today's world", "In the digital age"), no marketing language, no praise of the topic.`

// Item-writing discipline. This is what separates a question that teaches from
// one that just looks like a question.
const ITEM_RULES = `ITEM QUALITY RULES
- Every wrong option must be a mistake a real student actually makes: a common
  misconception, a predictable calculation slip, a confused definition, or the
  right answer to a subtly different question. Never use filler, joke, or
  obviously absurd options.
- Exactly one option may be defensible as correct.
- Do not use "All of the above" or "None of the above".
- Do not write negative stems (avoid "Which is NOT...").
- Do not make the correct option noticeably longer or more detailed.
- Do not use trick wording. Test understanding, not carelessness.
- Do not repeat the same idea across two questions.

LANGUAGE
Many students read English as a second language. Use short sentences and
everyday vocabulary for the level. Test the subject, never the reading level.
Use Ghanaian names, places, and situations. Use GHS for money.`

// Cheap, high-yield accuracy guard: make the model do the work before it commits.
const VERIFY_RULE = `BEFORE YOU ANSWER
Work each question out yourself first. Confirm the key you record matches your
own working and that no second option is defensible. If it does not, rewrite
the question. Put your reasoning in the "working" field, one line, plain text.`

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

// Hints and explanations ship with the builders now, but the standalone
// ai_hints / ai_explanations add-ons were sold before that change. Anyone
// still subscribed to those keeps access, so hint and explanation tasks
// accept either the legacy add-on or the builder that now includes it.
const LEGACY_HINT_EXPLANATION_TASKS = new Set([
  'question_hint',
  'question_explanation',
  'bulk_explanations',
  'bulk_hints',
])

function acceptableAddOns(task: string, requested: AddOnId): AddOnId[] {
  const ids = new Set<AddOnId>([requested])
  if (LEGACY_HINT_EXPLANATION_TASKS.has(task)) {
    ids.add('ai_hints')
    ids.add('ai_explanations')
    ids.add('ai_assessment_builder')
    ids.add('ai_engagement_builder')
  }
  return Array.from(ids)
}

/** The plan whose monthly credit allowance applies to this generation. */
async function effectivePlanForCredits(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  owner: CreditOwner
): Promise<string> {
  if (!admin) return 'membership'
  if (owner.ownerType === 'institution') {
    const { data } = await admin
      .from('institutions')
      .select('subscription_plan')
      .eq('id', owner.ownerId)
      .maybeSingle()
    const plan = data?.subscription_plan as string | undefined
    return plan === 'trial' ? 'membership' : plan ?? 'membership'
  }
  const { data } = await admin.from('users').select('subscription_tier').eq('id', userId).maybeSingle()
  return (data?.subscription_tier as string | undefined) ?? 'membership'
}

/** Passes when the user holds ANY of the acceptable add-ons on an eligible plan. */
async function assertAnyAddOn(
  userId: string,
  addOnIds: AddOnId[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin()
  if (!admin) return { ok: false, error: 'AI access check is not configured.' }

  const { data: user } = await admin.from('users').select('subscription_tier').eq('id', userId).single()
  const planId = user?.subscription_tier ?? 'membership'

  const { data: addOnRows } = await admin
    .from('add_ons')
    .select('id, eligible_plans')
    .in('id', addOnIds)

  const planEligible = (addOnRows ?? [])
    .filter(row => ((row.eligible_plans as string[] | null) ?? []).includes(planId))
    .map(row => row.id as string)

  if (planEligible.length === 0) {
    return { ok: false, error: 'Upgrade to Creator or Institution before using this AI add-on.' }
  }

  const { data: active } = await admin
    .from('user_add_ons')
    .select('add_on_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('add_on_id', planEligible)
    .limit(1)

  if (!active?.length) {
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

  const needsPrompt = !['bulk_explanations', 'bulk_hints'].includes(task)
  if (needsPrompt && !prompt) {
    return NextResponse.json({ error: 'Missing AI request details.' }, { status: 400 })
  }

  // Usage tally, kept for admin visibility. Credits do the actual gating.
  const admin = getSupabaseAdmin()
  let usage: Awaited<ReturnType<typeof checkAndRecordGeneration>> | null = null
  if (admin) {
    usage = await checkAndRecordGeneration(admin, userId)
    if (!usage.allowed) {
      return NextResponse.json({ error: usage.error }, { status: 429 })
    }
  }

  // Whose credits pay for this? Institution work draws on the institution's
  // pooled balance; personal work draws on the creator's own. The claimed
  // institution is verified here, never trusted from the client.
  let creditOwner: CreditOwner = { ownerType: 'user', ownerId: userId }
  const claimedInstitution = (context?.institutionId as string | undefined) ?? undefined
  if (admin && claimedInstitution) {
    const { data: membership } = await admin
      .from('institution_members')
      .select('id')
      .eq('institution_id', claimedInstitution)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    if (membership) {
      creditOwner = { ownerType: 'institution', ownerId: claimedInstitution }
    }
  }

  const planId = admin ? await effectivePlanForCredits(admin, userId, creditOwner) : 'membership'

  // Credits are the gate. AI builders are open to every plan, and running
  // out of credits is the only thing that stops a generation.
  //
  // The add-on check survives only as a fallback: if credits are not
  // provisioned yet (migration pending), fall back to the old entitlement
  // so a half-migrated deploy cannot hand out unlimited free AI.
  const account = admin ? await loadCreditAccount(admin, creditOwner, planId) : null
  if (!account) {
    const gate = await assertAnyAddOn(userId, acceptableAddOns(task, addOnId))
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: 403 })
    }
  }

  let system = ''
  let userPrompt = prompt ?? ''
  // For list-producing tasks: the JSON key holding the array, and how many
  // items the user asked for. Used to budget tokens and detect short delivery.
  let expectedKey: string | null = null
  let expectedCount = 0

  // Creator preferences, not paywalls: hints and explanations ship with the
  // builders, but a teacher preparing a sealed exam can turn them off and
  // save the tokens and the wait. Default on.
  const includeHints = context?.includeHints !== false
  const includeExplanations = context?.includeExplanations !== false

  if (task === 'assessment_questions') {
    expectedKey = 'questions'
    const typeMix = (context?.typeMix as Record<string, number> | undefined) ?? {}
    const mcq = typeMix.mcq ?? 0
    const trueFalse = typeMix.true_false ?? 0
    const short = typeMix.short ?? 0
    const essay = typeMix.essay ?? 0
    const total = Number(context?.count ?? mcq + trueFalse + short + essay)
    expectedCount = total
    const difficulty = (context?.difficulty as string | undefined) ?? 'standard'
    const detail = (context?.detail as string | undefined)?.trim()
    const marks = (context?.marksPerType as Record<string, number> | undefined) ?? {
      mcq: 2,
      true_false: 1,
      short: 4,
      essay: 10,
    }

    system = `You write examination items for Ghanaian schools. A teacher will put these
in front of real students and mark with your answer key, so a wrong key is a
serious failure. Accuracy matters more than speed.

CURRICULUM ANCHOR
Target what the Ghanaian curriculum (NaCCA) expects at this level for this
subject and topic. Match BECE and WASSCE phrasing conventions. Difficulty:
${difficulty} (foundation = recall and single-step, standard = apply and
explain, challenge = multi-step reasoning and transfer).

${ITEM_RULES}

${VERIFY_RULE}

OUTPUT
Return JSON only, key "questions", an array of exactly ${total} items.
Each item:
  id: string
  type: "mcq" | "true_false" | "short" | "essay"
  text: the question
  options: [{label,text,why_wrong}] for mcq and true_false only. Labels A,B,C,D
           (true_false uses A=True, B=False). why_wrong states the misconception
           that option catches, and is "" for the correct option.
  correct: the LABEL of the correct option, for mcq and true_false only
  marks: number
  working: one line showing how you reached the answer
${includeExplanations ? `  explanation: why the answer is right, and why the tempting wrong option is
               wrong, in 2 to 3 sentences a student can read
` : ''}${includeHints ? `  hint: one sentence that nudges without giving the answer
` : ''}  rubric: REQUIRED for short and essay. Mark bands that add up to the marks,
          e.g. "3 marks: names both causes. 2 marks: explains one with an
          example. 1 mark: states a conclusion." Omit for mcq and true_false.

You MUST produce exactly this type distribution and no other types:
- mcq: ${mcq}
- true_false: ${trueFalse}
- short: ${short}
- essay: ${essay}
Default marks: mcq ${marks.mcq}, true_false ${marks.true_false}, short ${marks.short}, essay ${marks.essay}.

EXAMPLE of one good mcq item (JHS Mathematics, note the misconception-based options):
{"id":"q1","type":"mcq","text":"A trader buys a bag of rice for GHS 240 and sells it for GHS 300. What is the percentage profit?","options":[{"label":"A","text":"20%","why_wrong":"Divides the profit by the selling price instead of the cost price."},{"label":"B","text":"25%","why_wrong":""},{"label":"C","text":"60%","why_wrong":"Gives the cash profit, not a percentage."},{"label":"D","text":"80%","why_wrong":"Divides cost by selling price."}],"correct":"B","marks":${marks.mcq},"working":"Profit = 300 - 240 = 60. 60/240 = 0.25 = 25%.","explanation":"Profit is GHS 60, and percentage profit is measured against the cost price, so 60 divided by 240 gives 25%. Option A uses the selling price as the base, which is the most common slip.","hint":"Percentage profit is always measured against what you paid, not what you sold for."}

${STYLE_RULES}`

    userPrompt = [
      `Subject: ${context?.subject ?? 'General'}.`,
      `Level: ${context?.gradeLevel ?? 'JHS'}.`,
      `Topic: ${prompt}.`,
      detail ? `Syllabus notes: ${detail}` : null,
      `Generate exactly ${total} questions with the type counts above.`,
    ].filter(Boolean).join(' ')
  } else if (task === 'course_modules') {
    expectedKey = 'modules'
    const typeMix = (context?.typeMix as Record<string, number> | undefined) ?? {}
    const reading = typeMix.reading ?? 0
    const video = typeMix.video ?? 0
    const quiz = typeMix.quiz ?? 0
    const assignment = typeMix.assignment ?? 0
    const flashcards = typeMix.flashcards ?? 0
    const total = Number(context?.count ?? reading + video + quiz + assignment + flashcards)
    expectedCount = total
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

    system = `You write course modules for Ghanaian teachers and trainers. The teacher
should be able to teach from this with little rewriting, so every module must
carry real substance, never a placeholder.

Order the modules so each one builds on the last. Start from what a learner at
this level already knows. Depth: ${depth}.

${ITEM_RULES}

OUTPUT
Return ONLY valid JSON (no markdown fences, no commentary), key "modules", an
array of exactly ${total} items in teaching order.
Each item: id (string), title (string), type, duration_minutes (number),
is_mandatory (boolean), content (object), objective (one line stating what the
learner can do after this module).

You MUST produce exactly this type distribution and no other types:
- reading: ${reading}
- video: ${video}
- quiz: ${quiz}
- assignment: ${assignment}
- flashcards: ${flashcards}

Content rules by type (compact strings, no newlines inside option text):
- reading: content.body with ${readingParas}, built around a concrete Ghanaian
  classroom or market example, not a definition dump.
- video: content.video_url as "", content.script_outline as 4 to 6 beats the
  teacher can film or narrate, and content.search_query as the phrase to find an
  existing video for this topic. Never leave video content empty.
- quiz: content.questions as exactly ${quizCount} items, each
  { "question": string, "options": [4 strings], "correct": 0-3 index,
    "explanation": one sentence on why that answer is right }.
  Apply the item quality rules above to these options.
- assignment: content.instructions as one clear student task (max 60 words) and
  content.success_criteria as 3 bullet strings the teacher marks against.
- flashcards: content.cards as exactly ${cardCount} items, each
  { "front": string, "back": string }. Fronts are questions or terms, never
  whole sentences copied from the reading.

Default duration_minutes: reading ${minutes.reading}, video ${minutes.video}, quiz ${minutes.quiz}, assignment ${minutes.assignment}, flashcards ${minutes.flashcards}.

${STYLE_RULES}`

    userPrompt = [
      `Course topic: ${prompt}.`,
      `Subject: ${context?.subject ?? 'General'}.`,
      `Level: ${context?.gradeLevel ?? 'JHS'}.`,
      detail ? `Syllabus notes: ${detail}` : null,
      `Create exactly ${total} modules with the type counts above. Reply with JSON only.`,
    ].filter(Boolean).join(' ')
  } else if (task === 'engage_questions') {
    expectedKey = 'questions'
    const typeMix = (context?.typeMix as Record<string, number> | undefined) ?? {}
    const mcq = typeMix.mcq ?? 0
    const trueFalse = typeMix.true_false ?? 0
    const multiSelect = typeMix.multi_select ?? 0
    const shortAnswer = typeMix.short_answer ?? 0
    const poll = typeMix.poll ?? 0
    const numeric = typeMix.numeric ?? 0
    const ordering = typeMix.ordering ?? 0
    const total = Number(
      context?.count ?? mcq + trueFalse + multiSelect + shortAnswer + poll + numeric + ordering
    )
    expectedCount = total
    const timeSeconds = (context?.timeSeconds as number | undefined) ?? 20
    const detail = (context?.detail as string | undefined)?.trim()

    system = `You write fast-paced live quiz questions for Ghanaian classrooms, played on
phones with the whole class watching. Questions must be readable and answerable
in under ${timeSeconds} seconds, so keep stems to one short sentence and options
to a few words each.

${ITEM_RULES}

${VERIFY_RULE}

Live-play notes: a poll has no right answer, so it asks for an opinion or a
prediction and every option is reasonable. Ramp difficulty upward across the
set so the game opens easy and ends hard.

OUTPUT
Return ONLY valid JSON (no markdown fences), key "questions", an array of
exactly ${total} items.
Each item: id (string), type, text, options ([{label,text,why_wrong}] where
why_wrong names the misconception that option catches and is "" for the correct
one, and "" for every option of a poll),
correct (single option label for mcq/true_false), correct_multiple (array of
labels for multi_select, else []), correct_text (string for short_answer, else ""),
correct_number and tolerance and unit (for numeric, else omit),
correct_order (array of option labels in the right sequence, for ordering, else []),
time_seconds (${timeSeconds}), points (100), working (one line, how you reached
the answer, "" for poll)${includeExplanations ? `, explanation (one sentence the teacher reads out
after the reveal, "" for poll)` : ''}.

You MUST produce exactly this type distribution:
- mcq: ${mcq}
- true_false: ${trueFalse}
- multi_select: ${multiSelect}
- short_answer: ${shortAnswer}
- poll: ${poll}
- numeric: ${numeric}
- ordering: ${ordering}

numeric: the answer is a single number the learner types. Set correct_number,
a tolerance wide enough that sensible estimation counts, and a unit such as
"GHS" or "cm" when one applies. options must be [].
ordering: options are the items to arrange, labelled A onward in SCRAMBLED
order, and correct_order lists those labels in the correct sequence. Use 4 or 5
items. Good for processes, timelines, and steps of a method.

Option rules: mcq, multi_select, poll and short_answer use exactly 4 options
labelled A to D. true_false uses A=True, B=False. For short_answer the options
are accepted spellings or phrasings, and correct_text is the canonical one.

${STYLE_RULES}`

    userPrompt = [
      `Subject: ${context?.subject ?? 'General'}.`,
      `Level: ${context?.gradeLevel ?? 'JHS'}.`,
      `Topic: ${prompt}.`,
      detail ? `Notes: ${detail}` : null,
      `Generate exactly ${total} live quiz questions with the type counts above. Reply with JSON only.`,
    ].filter(Boolean).join(' ')
  } else if (task === 'training_steps') {
    expectedKey = 'steps'
    const typeMix = (context?.typeMix as Record<string, number> | undefined) ?? {}
    const video = typeMix.video ?? 0
    const reading = typeMix.reading ?? 0
    const quiz = typeMix.quiz ?? 0
    const signOff = typeMix.sign_off ?? 0
    const assessment = typeMix.assessment ?? 0
    const total = Number(context?.count ?? video + reading + quiz + signOff + assessment)
    expectedCount = total
    const depth = (context?.depth as string | undefined) ?? 'standard'
    const detail = (context?.detail as string | undefined)?.trim()
    const minutes = (context?.durationPerType as Record<string, number> | undefined) ?? {
      video: 12,
      reading: 15,
      quiz: 10,
      sign_off: 5,
      assessment: 20,
    }

    system = `You write workplace training steps for Ghanaian organisations. This is often
compliance material, so it must be specific enough to change what an employee
actually does, and a sign-off must be something a person can honestly attest to.

Order the steps so understanding comes before assessment and before sign-off.
Depth: ${depth}.

${ITEM_RULES}

OUTPUT
Return ONLY valid JSON (no markdown fences), key "steps", an array of exactly
${total} items in order.
Each item: id (string), title, type, duration_minutes (number),
is_mandatory (boolean), content (object), objective (one line stating what the
employee can do after this step).

You MUST produce exactly this type distribution:
- video: ${video}
- reading: ${reading}
- quiz: ${quiz}
- sign_off: ${signOff}
- assessment: ${assessment}

Content rules by type (compact):
- video: content.video_url as "", content.script_outline as 4 to 5 beats to film
  or narrate, content.search_query as the phrase to find an existing video.
  Never leave video content empty.
- reading: content.body as ${depth === 'deep' ? '3' : depth === 'overview' ? '1-2' : '2'} short paragraphs built on a realistic
  Ghanaian workplace scenario, naming the specific behaviour expected.
- quiz: content.questions as 3 items, each { question, options (4 strings),
  correct (0-based index), explanation (one sentence) }. Apply the item quality
  rules above. Test judgement in real situations, not memory of policy wording.
- sign_off: content.statement as a first-person acknowledgement naming the
  specific obligations being accepted, not a vague promise.
- assessment: content.instructions as a short practical task (max 50 words) and
  content.success_criteria as 3 bullet strings a supervisor marks against.

Default duration_minutes: video ${minutes.video}, reading ${minutes.reading}, quiz ${minutes.quiz}, sign_off ${minutes.sign_off}, assessment ${minutes.assessment}.

${STYLE_RULES}`

    userPrompt = [
      `Training brief: ${prompt}.`,
      `Category: ${context?.category ?? 'Compliance'}.`,
      detail ? `Notes: ${detail}` : null,
      `Create exactly ${total} steps with the type counts above. Reply with JSON only.`,
    ].filter(Boolean).join(' ')
  } else if (task === 'question_hint') {
    system = `You write hints for Ghanaian students sitting an exam. A hint points at
the method or the idea to reach for. It never names the answer, never rules an
option in or out, and never restates the question.
Return JSON only, key "hint", a single string of at most 2 sentences.
${STYLE_RULES}`
    userPrompt = `Subject: ${context?.subject ?? 'General'}. Level: ${context?.gradeLevel ?? 'JHS'}. Question: ${context?.questionText ?? prompt}. Write the hint.`
  } else if (task === 'question_explanation') {
    system = `You write answer explanations Ghanaian students read after submitting.
Do two things: show why the correct answer is right, then name the most tempting
wrong option and say what misunderstanding leads there. If working is involved,
show the steps briefly.
Return JSON only, key "explanation", a single string of at most 3 sentences.
${STYLE_RULES}`
    userPrompt = [
      `Subject: ${context?.subject ?? 'General'}.`,
      `Level: ${context?.gradeLevel ?? 'JHS'}.`,
      `Question: ${context?.questionText ?? prompt}.`,
      context?.options ? `Options: ${JSON.stringify(context.options)}.` : null,
      `Correct answer: ${context?.correctAnswer ?? 'see question'}.`,
      'Write the explanation.',
    ].filter(Boolean).join(' ')
  } else if (task === 'bulk_hints') {
    const items = (context?.questions as unknown[] | undefined) ?? []
    expectedKey = 'hints'
    expectedCount = items.length
    system = `You write hints for Ghanaian students sitting an exam. A hint points at
the method or the idea to reach for. It never names the answer, never rules an
option in or out, and never restates the question.
Return JSON only, key "hints", an array of strings, one per question in the
order given, at most 1 sentence each. The array length must match the number of
questions exactly. Never return an empty string.
${STYLE_RULES}`
    userPrompt = `Subject: ${context?.subject ?? 'General'}. Level: ${context?.gradeLevel ?? 'JHS'}. Questions JSON: ${JSON.stringify(items)}. Write one hint per question, in order.`
  } else if (task === 'bulk_explanations') {
    expectedKey = 'explanations'
    expectedCount = ((context?.questions as unknown[] | undefined) ?? []).length
    system = `You write answer explanations Ghanaian students read after submitting.

For a question with options (mcq, true_false): say why the correct option is
right, then name the most tempting wrong option and the misunderstanding that
leads there.
For a written question (short, essay): give the key points a full-mark answer
must contain, in the order a marker would look for them.

Return JSON only, key "explanations", an array of strings, one per question in
the order given, at most 3 sentences each. The array length must match the
number of questions exactly. Never return an empty string; if a question is
unclear, explain what a correct answer would need to show.
${STYLE_RULES}`
    userPrompt = `Subject: ${context?.subject ?? 'General'}. Level: ${context?.gradeLevel ?? 'JHS'}. Questions JSON: ${JSON.stringify(context?.questions ?? [])}. Write one explanation per question, in order.`
  } else {
    return NextResponse.json({ error: 'That AI task is not supported yet.' }, { status: 400 })
  }

  // Budget the response to the work actually asked for. A full item (options
  // with misconception notes, working, explanation, hint, rubric) runs about
  // 300 output tokens; dropping explanations or hints takes real weight off,
  // so price the request rather than assuming the maximum.
  const itemCount = Number(expectedCount ?? 0)
  const perItemTokens =
    180 + (includeExplanations ? 70 : 0) + (includeHints ? 30 : 0)
  const maxTokens = expectedKey
    ? Math.min(MAX_OUTPUT_TOKENS, 900 + itemCount * perItemTokens)
    : 1500

  // Credit pre-flight. Degrades open: if credits are not provisioned yet the
  // generation proceeds, so a pending migration never blocks a paying user.
  const billableItems = expectedKey ? itemCount : 1
  if (admin && account) {
    const estimate = await creditCostForItems(admin, billableItems)
    if (account.total < estimate) {
      const isPooled = creditOwner.ownerType === 'institution'
      return NextResponse.json(
        {
          error: `This draft needs ${estimate} credit${estimate === 1 ? '' : 's'} and ${isPooled ? 'your institution has' : 'you have'} ${account.total} left. Top up from Plan and billing, or ask for fewer items.`,
          creditsNeeded: estimate,
          creditsAvailable: account.total,
        },
        { status: 402 }
      )
    }
  }

  const result = await groqChat({
    system,
    user: userPrompt,
    temperature: task === 'course_modules' || task === 'training_steps' || task === 'engage_questions' ? 0.25 : 0.4,
    jsonMode: true,
    maxTokens,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  try {
    const parsed = extractJsonBlock(result.content) as Record<string, unknown>

    // Report short deliveries instead of silently serving a partial set.
    let delivered: number | undefined
    if (expectedKey && Array.isArray(parsed[expectedKey])) {
      delivered = (parsed[expectedKey] as unknown[]).length
    }
    const shortfall =
      expectedKey && delivered !== undefined && itemCount > 0
        ? Math.max(0, itemCount - delivered)
        : 0

    // Charge for what was actually delivered, never for what was asked. A
    // short or truncated draft costs the creator only what they received.
    let creditsRemaining: number | undefined
    let creditsCharged: number | undefined
    if (admin && account) {
      const chargeableItems = expectedKey ? (delivered ?? 0) : 1
      creditsCharged = await creditCostForItems(admin, chargeableItems)
      if (creditsCharged > 0) {
        const spend = await spendCredits(admin, creditOwner, creditsCharged, {
          task,
          actorUserId: userId,
        })
        creditsRemaining = spend.remaining
      } else {
        creditsRemaining = account.total
      }
    }

    return NextResponse.json({
      ok: true,
      data: parsed,
      meta: {
        requested: expectedKey ? itemCount : undefined,
        delivered,
        shortfall,
        truncated: result.truncated || shortfall > 0,
        generationsUsed: usage?.used,
        generationsLimit: usage?.limit,
        creditsCharged,
        creditsRemaining,
      },
    })
  } catch {
    return NextResponse.json({
      error: 'The draft came back in a format we could not read. Tap draft again.',
    }, { status: 502 })
  }
}
