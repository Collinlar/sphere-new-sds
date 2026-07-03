const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

export function getGroqApiKey(): string | null {
  return process.env.GROQ_API_KEY ?? null
}

export async function groqChat(params: {
  system: string
  user: string
  temperature?: number
}): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const apiKey = getGroqApiKey()
  if (!apiKey) {
    return { ok: false, error: 'AI is not configured on this server yet.' }
  }

  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: params.temperature ?? 0.4,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
    }),
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

export function extractJsonBlock(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced?.[1]?.trim() ?? text.trim()
  return JSON.parse(raw)
}
