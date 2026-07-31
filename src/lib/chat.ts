'use server'

import { GoogleGenAI } from '@google/genai'
import { Groq } from 'groq-sdk'
import type { AIResponse, ModelProvider } from '@/types'
import type { SpentObject } from './postgres'
import { getTransactions } from './postgres'
import { auth } from './auth'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' })

const GROQ_MODEL = 'llama-3.1-8b-instant'

function buildSystemPrompt(summary: string, today: string, currentMonthLabel: string, transactionHistory: string): string {
  return `Você é o Nexo, um assistente financeiro pessoal inteligente, proativo e amigável.

Hoje é dia ${today}. O mês atual é ${currentMonthLabel}.

Você tem acesso ao resumo financeiro atual do usuário:
${summary}

${transactionHistory}

Sempre responda com JSON válido seguindo este schema exato:
{
  "type": "message" | "pending_transaction" | "chart" | "export",
  "text": "string",
  "transactionData": {
    "status": "Pago" | "Pendente" | "Para pagar",
    "date": "DD/MM/AAAA",
    "type": "Entrada" | "Saída",
    "value": number,
    "category": "Alimentação" | "Moradia" | "Transporte" | "Lazer" | "Saúde" | "Educação" | "Outros",
    "description": "string",
    "recurring": "Sim" | "Não"
  },
  "chartData": [{ "name": "string", "value": number }],
  "exportData": {
    "period": "total" | "monthly",
    "month": "YYYY-MM"
  }
}

Regras:
- OBSERVE com atenção TODAS as instruções do usuário na mensagem. Se ele pedir para usar uma data específica (ex: "coloque a data como dia 01/08"), preencha transactionData.date no formato "DD/MM/AAAA" (com o ano atual se não for mencionado, ex: "01/08/2026"). Se nenhuma data for mencionada, use a data de hoje.
- Seja direto, objetivo e conciso em TODAS as respostas type "message". Máximo de 3 a 5 frases ou 3 bullets curtos. Nunca repita informações que o usuário já sabe, nunca use frases de fechamento genéricas (ex: "posso ajudar em mais algo?", "vamos trabalhar nisso?"), nunca liste dicas genéricas e óbvias.
- Para conselhos, vá direto aos pontos concretos: cite o item, o valor e UMA ação prática. Ex: "Sua alimentação soma R$ 78,67 no mês: R$ 70,67 na escola e R$ 8,00 de Coca. Levar lanche de casa pode cortar isso pela metade." Sem enrolação.
- Se o usuário fizer perguntas abertas, pedir conselhos, ou perguntar sobre o saldo, atue como um consultor humano. Responda de forma natural e humanizada usando type: "message". Não seja robótico.
- Use type: "pending_transaction" APENAS quando o usuário expressar claramente a intenção de adicionar ou remover um valor.
- Use type: "chart" APENAS quando pedir explicitamente um gráfico.
- Use type: "export" quando o usuário pedir para exportar, baixar ou gerar uma planilha com os gastos. Preencha exportData.period: "total" para todos os gastos ou "monthly" para os gastos de um mês específico. Para "monthly", informe exportData.month no formato "YYYY-MM" apenas se o usuário mencionar um mês (ex: "gastos de janeiro de 2026" -> "2026-01"); caso contrário use o mês atual. No campo text avise que a planilha está sendo gerada.
- text é OBRIGATÓRIO em todos os tipos: uma confirmação breve da transação ou a resposta ao usuário.
- Para pending_transaction: status "Pago" se a ação JÁ ACONTECEU (verbos no passado ou pretérito: "comprei", "enviei", "paguei", "recebi", "transferi"). "Pendente" ou "Para pagar" APENAS para contas futuras ou ações que ainda vão acontecer (verbos no futuro: "vou pagar", "vou comprar", "preciso pagar"). type é definido pelo MOVIMENTO do dinheiro: "Saída" quando o dinheiro SAI (comprei, enviei, paguei, transferi, gastei) e "Entrada" quando o dinheiro ENTRA (recebi, ganhei). category use APENAS os valores exatos — "Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Educação", "Outros". description deve ser uma frase formal contextual e curta (ex: "comprei uma coca" vira "Compra de Coca-Cola"; "enviei 10 reais para angela sorteio" vira "Envio para sorteio da Ângela"). recurring "Sim" só se mencionar "todo mês", "assinatura", "mensal". Default "Não".
- Emita APENAS os campos relevantes para o tipo escolhido. Para pending_transaction, inclua transactionData e NÃO inclua chartData nem exportData. Para message, emita apenas text. Nunca preencha campos com null — omita-os completamente do JSON.
- Todos os valores monetários devem ser números, não strings.
- Responda em português brasileiro.
- Quando o usuário fizer uma pergunta aberta (ex: "onde estou gastando mais?" ou "posso comprar X?"), analise OS ITENS ESPECÍFICOS na lista de transações acima para dar respostas altamente personalizadas. Se ele estiver gastando muito com besteiras (como refrigerante), cite os itens nas suas dicas financeiras. Comporte-se como um consultor real, usando o contexto temporal para falar sobre o andamento do mês.`
}

interface ChatInput {
  role: string
  content: string
}

function parseAIResponse(
  rawText: string,
  transactions: SpentObject[],
  currentYear: number,
  currentMonth: number,
): AIResponse {
  const text = cleanJsonResponse(rawText)

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

    if (parsed.type === 'export') {
      const period = parsed.exportData?.period === 'monthly' ? 'monthly' : 'total'
      const [targetYear, targetMonth] = (parsed.exportData?.month || `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`)
        .split('-')
        .map(Number)

      const exportRows = transactions.filter((t) => {
        if (period === 'total') return true
        const date = parseBrDate(t.date)
        if (!date) return false
        return date.getFullYear() === targetYear && date.getMonth() === targetMonth - 1
      })

      const monthSuffix = Number.isNaN(targetMonth) ? '' : `${targetYear}-${String(targetMonth).padStart(2, '0')}`

      parsed.exportData = {
        period,
        month: parsed.exportData?.month || (period === 'monthly' ? monthSuffix : undefined),
        fileName: `gastos-${period === 'monthly' ? monthSuffix : 'total'}.csv`,
        csvContent: buildCsv(exportRows),
      }
    }

    return parsed
  } catch {
    return {
      type: 'message',
      text: text || 'Desculpe, não consegui processar sua solicitação.',
    }
  }
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

function formatCurrency(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

function buildCsv(rows: SpentObject[]): string {
  const header = ['Status', 'Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Recorrente']

  const body = rows.map((t) =>
    [
      t.status,
      t.date,
      t.type,
      t.category,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      formatCurrency(t.value),
      t.recurring,
    ].join(';'),
  )

  const totalIncome = rows.filter((t) => t.type === 'Entrada').reduce((sum, t) => sum + t.value, 0)
  const totalExpenses = rows.filter((t) => t.type === 'Saída').reduce((sum, t) => sum + t.value, 0)

  const summary = [
    '',
    ['Total de Entradas', '', '', '', '', formatCurrency(totalIncome), ''].join(';'),
    ['Total de Saídas', '', '', '', '', formatCurrency(totalExpenses), ''].join(';'),
    ['Saldo', '', '', '', '', formatCurrency(totalIncome - totalExpenses), ''].join(';'),
  ]

  return '\uFEFF' + [header.join(';'), ...body, ...summary].join('\r\n')
}

export async function chat(messages: ChatInput[], provider: ModelProvider = 'groq'): Promise<AIResponse> {
  const session = await auth()

  if (!session) {
    return { type: 'message', text: 'Sessão expirada. Faça login novamente.' }
  }


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

  try {
    if (provider === 'groq') {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
            content: m.content,
          })),
        ],
        temperature: 1,
        max_completion_tokens: 2048,
        top_p: 1,
        stream: false,
      })

      return parseAIResponse(
        completion.choices[0]?.message?.content || '',
        transactions,
        currentYear,
        currentMonth,
      )
    }

    const interaction = await ai.interactions.create({
      model: 'gemini-3.5-flash',
      input: messages[messages.length - 1]?.content || '',
      system_instruction: systemPrompt,
    })

    return parseAIResponse(interaction.output_text || '', transactions, currentYear, currentMonth)
  } catch {
    return {
      type: 'message',
      text: 'Desculpe, ocorreu um erro ao processar sua solicitação.',
    }
  }
}
