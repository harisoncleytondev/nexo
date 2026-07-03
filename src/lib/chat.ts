'use server'

import { GoogleGenAI } from '@google/genai'
import type { AIResponse } from '@/types'
import { getTransactions } from './sheets'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

function buildSystemPrompt(summary: string, today: string, currentMonthLabel: string, transactionHistory: string): string {
  return `Você é o Nexo, um assistente financeiro pessoal inteligente, proativo e amigável.

Hoje é dia ${today}. O mês atual é ${currentMonthLabel}.

Você tem acesso ao resumo financeiro atual do usuário:
${summary}

${transactionHistory}

Sempre responda com JSON válido seguindo este schema exato:
{
  "type": "message" | "pending_transaction" | "chart",
  "text": "string",
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

Regras:
- Se o usuário fizer perguntas abertas, pedir conselhos, ou perguntar sobre o saldo, atue como um consultor humano. Responda de forma natural, analítica e humanizada usando type: "message". Não seja robótico.
- Use type: "pending_transaction" APENAS quando o usuário expressar claramente a intenção de adicionar ou remover um valor.
- Use type: "chart" APENAS quando pedir explicitamente um gráfico.
- Para pending_transaction: status "Pago" se já pagou (ex: "comprei", "recebi", "paguei"), "Pendente" ou "Para pagar" para contas futuras. type "Entrada" para receita, "Saída" para despesas. category use APENAS os valores exatos — "Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Educação", "Outros". description deve gerar uma frase formal contextual (ex: "comprei uma coca" vira "Compra de Coca-Cola"). recurring "Sim" só se mencionar "todo mês", "assinatura", "mensal". Default "Não".
- Todos os valores monetários devem ser números, não strings.
- Responda em português brasileiro.
- Quando o usuário fizer uma pergunta aberta (ex: "onde estou gastando mais?" ou "posso comprar X?"), analise OS ITENS ESPECÍFICOS na lista de transações acima para dar respostas altamente personalizadas. Se ele estiver gastando muito com besteiras (como refrigerante), cite os itens nas suas dicas financeiras. Comporte-se como um consultor real, usando o contexto temporal para falar sobre o andamento do mês.`
}

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

function parseBrDate(dateStr: string): Date | null {
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const [day, month, year] = parts.map(Number)
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null
  return new Date(year, month - 1, day)
}

export async function chat(messages: ChatInput[]): Promise<AIResponse> {
  const lastMessage = messages[messages.length - 1]?.content || ''

  const transactions = await getTransactions()

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const today = now.toLocaleDateString('pt-BR')
  const currentMonthLabel = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  const monthTransactions = transactions.filter((t) => {
    const date = parseBrDate(t.date)
    if (!date) return false
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  })

  const totalIncome = monthTransactions
    .filter((t) => t.type === 'Entrada')
    .reduce((sum, t) => sum + t.value, 0)

  const totalExpenses = monthTransactions
    .filter((t) => t.type === 'Saída')
    .reduce((sum, t) => sum + t.value, 0)

  const balance = totalIncome - totalExpenses

  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ]

  const summary = `Mês: ${monthNames[currentMonth]} de ${currentYear}
Total de Entradas: R$ ${totalIncome.toFixed(2)}
Total de Saídas: R$ ${totalExpenses.toFixed(2)}
Saldo Atual: R$ ${balance.toFixed(2)}`

  const sortedByDate = [...monthTransactions].sort((a, b) => {
    const da = parseBrDate(a.date)
    const db = parseBrDate(b.date)
    if (!da || !db) return 0
    return db.getTime() - da.getTime()
  })

  const recentTransactions = sortedByDate.slice(0, 15)

  const transactionHistory =
    recentTransactions.length > 0
      ? `Últimas transações de ${currentMonthLabel}:\n` +
        recentTransactions
          .map(
            (t) =>
              `- [${t.date}] ${t.type} | ${t.category} | R$ ${t.value.toFixed(2)} (Motivo: ${t.description || '—'})`,
          )
          .join('\n')
      : 'Nenhuma transação registrada neste mês.'

  console.log('Financial summary injected:', summary)
  console.log('Transaction history:', transactionHistory)

  const systemPrompt = buildSystemPrompt(summary, today, currentMonthLabel, transactionHistory)

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
      system_instruction: systemPrompt,
    })

    const text = cleanJsonResponse(interaction.output_text || '')

    try {
      const parsed = JSON.parse(text) as AIResponse

      if (parsed.type === 'chart') {
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
