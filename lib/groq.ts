const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

export function getGroqApiKey(): string | null {
  return process.env.GROQ_API_KEY ?? null
}

export async function groqChat(params: {
  system: string
  user: string
  temperature?: number
  jsonMode?: boolean
}): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const apiKey = getGroqApiKey()
  if (!apiKey) {
    return { ok: false, error: 'AI is not configured on this server yet.' }
  }

  const payload: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    temperature: params.temperature ?? 0.4,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
  }

  if (params.jsonMode !== false) {
    payload.response_format = { type: 'json_object' }
  }

  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    return {
      ok: false,
      error: body?.error?.message ?? 'The AI service did not respond. Try again in a moment.',
    }
  }

  const content = body?.choices?.[0]?.message?.content as string | undefined
  if (!content?.trim()) {
    return { ok: false, error: 'The AI returned an empty response. Try a more specific prompt.' }
  }

  return { ok: true, content: content.trim() }
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
