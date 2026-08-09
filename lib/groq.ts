const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

/**
 * Ceiling for a single generation. A full 30-question exam with working,
 * explanations, hints and mark schemes needs roughly 9,500 output tokens, so
 * this clears the product's largest request with headroom. Override with
 * GROQ_MAX_OUTPUT_TOKENS if the model's own completion limit is lower.
 */
export const MAX_OUTPUT_TOKENS = Number(process.env.GROQ_MAX_OUTPUT_TOKENS ?? 12000)

/** Fallback when a provider rejects the requested budget outright. */
const SAFE_OUTPUT_TOKENS = 8000

export function getGroqApiKey(): string | null {
  return process.env.GROQ_API_KEY ?? null
}

export async function groqChat(params: {
  system: string
  user: string
  temperature?: number
  jsonMode?: boolean
  maxTokens?: number
}): Promise<{ ok: true; content: string; truncated: boolean } | { ok: false; error: string }> {
  const apiKey = getGroqApiKey()
  if (!apiKey) {
    return { ok: false, error: 'AI is not configured on this server yet.' }
  }

  const payload: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    temperature: params.temperature ?? 0.4,
    // Explicit budget. Without this the default cuts long generations off
    // mid-JSON, which used to be silently repaired into a short result.
    max_tokens: params.maxTokens ?? 4000,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
  }

  if (params.jsonMode !== false) {
    payload.response_format = { type: 'json_object' }
  }

  async function send(): Promise<{ res: Response; body: Record<string, unknown> | null }> {
    const res = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    return { res, body: await res.json().catch(() => null) }
  }

  let { res, body } = await send()

  // If the provider rejects the token budget (its completion limit is lower
  // than we asked for), retry once at a conservative budget rather than
  // failing the user's generation outright.
  const rejectedBudget =
    !res.ok &&
    typeof (body as { error?: { message?: string } } | null)?.error?.message === 'string' &&
    /max_tokens|max_completion_tokens|too large|exceed/i.test(
      (body as { error?: { message?: string } }).error!.message!
    )

  if (rejectedBudget && Number(payload.max_tokens) > SAFE_OUTPUT_TOKENS) {
    payload.max_tokens = SAFE_OUTPUT_TOKENS
    ;({ res, body } = await send())
  }

  if (!res.ok) {
    return {
      ok: false,
      error:
        (body as { error?: { message?: string } } | null)?.error?.message ??
        'The AI service did not respond. Try again in a moment.',
    }
  }

  const choice = (body as { choices?: { message?: { content?: string }; finish_reason?: string }[] } | null)
    ?.choices?.[0]
  const content = choice?.message?.content
  if (!content?.trim()) {
    return { ok: false, error: 'The AI returned an empty response. Try a more specific prompt.' }
  }

  // finish_reason 'length' means the model ran out of budget mid-answer, so
  // the caller must warn instead of quietly serving a partial result.
  const truncated = choice?.finish_reason === 'length'

  return { ok: true, content: content.trim(), truncated }
}

/** Strip common LLM JSON noise before parse. */
function sanitizeJsonCandidate(raw: string): string {
  let text = raw.trim()

  // Remove BOM / zero-width chars
  text = text.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '')

  // Prefer fenced block if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) text = fenced[1].trim()

  // Slice to outermost object or array
  const objStart = text.indexOf('{')
  const arrStart = text.indexOf('[')
  let start = -1
  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) start = objStart
  else if (arrStart >= 0) start = arrStart

  if (start > 0) text = text.slice(start)

  const objEnd = text.lastIndexOf('}')
  const arrEnd = text.lastIndexOf(']')
  const end = Math.max(objEnd, arrEnd)
  if (end >= 0 && end < text.length - 1) text = text.slice(0, end + 1)

  // Trailing commas before } or ]
  text = text.replace(/,\s*([}\]])/g, '$1')

  // Smart quotes → straight quotes
  text = text.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'")

  return text.trim()
}

export function extractJsonBlock(text: string): unknown {
  const candidates = [sanitizeJsonCandidate(text), text.trim()]

  let lastError: unknown
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch (err) {
      lastError = err
    }
  }

  // Last resort: try to close truncated object/array
  const repaired = tryRepairTruncatedJson(sanitizeJsonCandidate(text))
  if (repaired) {
    try {
      return JSON.parse(repaired)
    } catch (err) {
      lastError = err
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not parse AI JSON')
}

function tryRepairTruncatedJson(text: string): string | null {
  if (!text.startsWith('{') && !text.startsWith('[')) return null

  let inString = false
  let escape = false
  const stack: string[] = []

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']')
    else if (ch === '}' || ch === ']') {
      if (stack.length && stack[stack.length - 1] === ch) stack.pop()
    }
  }

  // Unclosed string: drop the incomplete trailing string value
  let repaired = text
  if (inString) {
    const lastQuote = repaired.lastIndexOf('"')
    if (lastQuote > 0) {
      // Cut back to before the incomplete string started
      const cut = repaired.lastIndexOf(',', lastQuote)
      if (cut > 0) repaired = repaired.slice(0, cut)
      else return null
    }
  }

  // Remove trailing comma
  repaired = repaired.replace(/,\s*$/, '')

  while (stack.length) {
    repaired += stack.pop()
  }

  return repaired
}
