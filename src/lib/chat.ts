'use server'

import { GoogleGenAI } from '@google/genai'
import type { AIResponse } from '@/types'
import { getTransactions } from './sheets'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

const SYSTEM_PROMPT = `You are a personal finance assistant in Brazil. Always respond with valid JSON matching this schema:
{
  "type": "message" | "pending_transaction" | "chart",
  "text": "string - message to display",
  "transactionData": {
    "status": "Pago" | "Pendente" | "Para pagar",
    "type": "Entrada" | "Saída",
    "value": number,
    "category": "Alimentação" | "Moradia" | "Transporte" | "Lazer" | "Saúde" | "Educação" | "Outros",
    "description": "string | null",
    "recurring": "Sim" | "Não"
  },
  "chartData": [{ "name": "string", "value": number }]
}

Rules:
- For questions/financial tips, return type "message".
- For transaction requests (expense/income), return type "pending_transaction" with filled transactionData following these enum rules:
  - status: "Pago" if the user already paid (e.g. "comprei", "recebi", "paguei"), "Pendente" or "Para pagar" for future bills.
  - type: "Entrada" for income, "Saída" for expenses.
  - category: ONLY use these exact values — "Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Educação", "Outros".
  - description: generate a short, contextual, formal financial phrase. Example: for "comprei uma coca", use "Compra de Coca-Cola" or "Gasto com refrigerante". Do NOT copy the user's raw words literally. Use null only if no description makes sense.
  - recurring: "Sim" only if the user mentions "todo mês", "assinatura", "mensal", "recorrente". Default "Não".
- For visual summary requests like "gráfico" or "resumo", return type "chart". The chartData will be replaced server-side with real data, so return an empty array or placeholder.
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

      if (parsed.type === 'chart') {
        const transactions = await getTransactions()
        const expenses = transactions.filter((t) => t.type === 'Saída')

        const grouped = expenses.reduce<Record<string, number>>((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + t.value
          return acc
        }, {})

        parsed.chartData = Object.entries(grouped).map(([name, value]) => ({
          name,
          value,
        }))
      }

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
