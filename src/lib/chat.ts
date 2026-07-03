'use server'

import { GoogleGenAI } from '@google/genai'
import type { AIResponse } from '@/types'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

const SYSTEM_PROMPT = `You are a personal finance assistant in Brazil. Always respond with valid JSON matching this schema:
{
  "type": "message" | "pending_transaction" | "chart",
  "text": "string - message to display",
  "transactionData": {
    "action": "add" | "remove",
    "value": number,
    "category": "string",
    "description": "string | null"
  },
  "chartData": [{ "name": "string", "value": number }]
}

Rules:
- For questions/financial tips, return type "message".
- For transaction requests (expense/income), return type "pending_transaction" with filled transactionData. Identify value, category, and optionally description (motivo). Use category in Portuguese (e.g. "alimentação", "transporte", "salário"). If the user only provides value and category (e.g. "gastei 50 no mercado"), extract the value (50) and category ("Mercado") and leave description as null. Do NOT invent a description. Do NOT execute the action.
- For visual summary requests like "gráfico" or "resumo", return type "chart" with chartData array.
- All monetary values must be numbers, not strings.
- Respond in Brazilian Portuguese.`

interface ChatInput {
  role: string
  content: string
}

function cleanJsonResponse(raw: string): string {
  return raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

export async function chat(messages: ChatInput[]): Promise<AIResponse> {
  const lastMessage = messages[messages.length - 1]?.content || ''

  const historyStr = messages
    .slice(0, -1)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  const prompt = historyStr
    ? `History:\n${historyStr}\n\nUser: ${lastMessage}\n\nJSON:`
    : `User: ${lastMessage}\n\nJSON:`

  try {
    const interaction = await ai.interactions.create({
      model: 'gemini-3.5-flash',
      input: prompt,
      system_instruction: SYSTEM_PROMPT,
    })

    const text = cleanJsonResponse(interaction.output_text || '')

    try {
      const parsed = JSON.parse(text) as AIResponse
      return parsed
    } catch {
      return {
        type: 'message',
        text: text || 'Desculpe, não consegui processar sua solicitação.',
      }
    }
  } catch {
    return {
      type: 'message',
      text: 'Desculpe, ocorreu um erro ao processar sua solicitação.',
    }
  }
}
