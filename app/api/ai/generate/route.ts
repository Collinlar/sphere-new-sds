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
    system = `You write exam questions for Ghanaian schools. Return JSON only with key "questions" as an array. Each item: id (uuid string), type ("mcq"|"true_false"|"short"|"essay"), text, options (array of {label,text} for mcq), correct (label or boolean), marks (number). Use BECE/WASSCE style, Ghanaian examples, GHS where money appears. ${PROHIBITIONS}`
    userPrompt = `Subject: ${context?.subject ?? 'General'}. Level: ${context?.gradeLevel ?? 'JHS'}. Topic: ${prompt}. Generate ${context?.count ?? 5} questions.`
  } else if (task === 'course_modules') {
    system = `You write course modules for Ghanaian teachers. Return JSON only with key "modules" as array. Each: id (string), title, type ("video"|"reading"|"quiz"), duration_minutes (number), is_mandatory (boolean), content (object with body or questions array). ${PROHIBITIONS}`
    userPrompt = `Course topic: ${prompt}. Subject: ${context?.subject ?? 'General'}. Level: ${context?.gradeLevel ?? 'JHS'}. Create ${context?.count ?? 4} modules.`
  } else if (task === 'training_steps') {
    system = `You write corporate training steps for Ghanaian workplaces. Return JSON only with key "steps" as array. Each: id, title, type ("video"|"reading"|"quiz"|"sign_off"|"assessment"), duration_minutes, is_mandatory, content (object). ${PROHIBITIONS}`
    userPrompt = `Training brief: ${prompt}. Category: ${context?.category ?? 'Compliance'}. Create ${context?.count ?? 5} steps.`
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

  const result = await groqChat({ system, user: userPrompt })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  try {
    const parsed = extractJsonBlock(result.content) as Record<string, unknown>
    return NextResponse.json({ ok: true, data: parsed })
  } catch {
    return NextResponse.json({ error: 'AI response could not be parsed. Try a clearer prompt.' }, { status: 502 })
  }
}
