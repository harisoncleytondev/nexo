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

function buildSystemPrompt(
  summary: string,
  today: string,
  currentMonthLabel: string,
  transactionHistory: string,
  dynamicBreakdown?: string,
): string {
  return `Você é o Nexo, um assistente financeiro pessoal inteligente, proativo e amigável.

Hoje é dia ${today}. O mês atual é ${currentMonthLabel}.

Você tem acesso ao resumo financeiro atual do usuário:
${summary}

${transactionHistory}

${dynamicBreakdown ? `Consulta dinâmica solicitada pelo usuário (dados REAIS consultados no banco de dados, use-os com prioridade máxima e não invente outros números):\n${dynamicBreakdown}` : ''}

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
- OBSERVE com atenção TODAS as instruções do usuário na mensagem. Se ele pedir para usar uma data específica (ex: "coloque a data como dia 01/08", "entrou no dia 01/08"), preencha transactionData.date no formato "DD/MM/AAAA" (com o ano atual se não for mencionado, ex: "01/08/2026"). A data da transação vem APENAS do que o usuário disser na mensagem ATUAL — NUNCA use datas das transações do histórico acima. Se nenhuma data for mencionada, use a data de hoje.
- Seja direto, objetivo e conciso em TODAS as respostas type "message". Máximo de 3 a 5 frases ou 3 bullets curtos. Nunca repita informações que o usuário já sabe, nunca use frases de fechamento genéricas (ex: "posso ajudar em mais algo?", "vamos trabalhar nisso?"), nunca liste dicas genéricas e óbvias.
- Para conselhos, vá direto aos pontos concretos: cite o item, o valor e UMA ação prática. Ex: "Sua alimentação soma R$ 78,67 no mês: R$ 70,67 na escola e R$ 8,00 de Coca. Levar lanche de casa pode cortar isso pela metade." Sem enrolação.
- Se o usuário fizer perguntas abertas, pedir conselhos, ou perguntar sobre o saldo, atue como um consultor humano. Responda de forma natural e humanizada usando type: "message". Não seja robótico.
- Use type: "pending_transaction" APENAS quando o usuário expressar claramente a intenção de adicionar ou remover um valor.
- Use type: "chart" APENAS quando pedir explicitamente um gráfico.
- Use type: "export" quando o usuário pedir para exportar, baixar ou gerar uma planilha com os gastos. Preencha exportData.period: "total" para todos os gastos ou "monthly" para os gastos de um mês específico. Para "monthly", informe exportData.month no formato "YYYY-MM" apenas se o usuário mencionar um mês (ex: "gastos de janeiro de 2026" -> "2026-01"); caso contrário use o mês atual. No campo text avise que a planilha está sendo gerada.
- text é OBRIGATÓRIO em todos os tipos: uma confirmação breve da transação ou a resposta ao usuário.
- Para pending_transaction: status SEMPRE "Pago" por padrão — a menos que o usuário deixe EXPLÍCITO que a ação é futura (ex: "vou pagar", "preciso pagar", "tenho que pagar", "vou comprar", "mês que vem"). Nunca marque como "Pendente" ou "Para pagar" se o usuário não mencionou que a transação ainda vai acontecer. type é definido pelo MOVIMENTO do dinheiro: "Saída" quando o dinheiro SAI (comprei, enviei, paguei, transferi, gastei) e "Entrada" quando o dinheiro ENTRA (recebi, ganhei). category use APENAS os valores exatos — "Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Educação", "Outros". description deve ser uma frase formal contextual e curta (ex: "comprei uma coca" vira "Compra de Coca-Cola"; "enviei 10 reais para angela sorteio" vira "Envio para sorteio da Ângela"). recurring "Sim" só se mencionar "todo mês", "assinatura", "mensal". Default "Não".
- Emita APENAS os campos relevantes para o tipo escolhido. Para pending_transaction, inclua transactionData e NÃO inclua chartData nem exportData. Para message, emita apenas text. Nunca preencha campos com null — omita-os completamente do JSON.
- Todos os valores monetários devem ser números, não strings.
- Responda em português brasileiro.
- Quando o usuário fizer uma pergunta aberta (ex: "onde estou gastando mais?" ou "posso comprar X?"), analise OS ITENS ESPECÍFICOS na lista de transações acima para dar respostas altamente personalizadas. Se ele estiver gastando muito com besteiras (como refrigerante), cite os itens nas suas dicas financeiras. Comporte-se como um consultor real, usando o contexto temporal para falar sobre o andamento do mês.`
}

interface ChatInput {
  role: string
  content: string
}

function isValidBrDate(dateStr?: string): boolean {
  if (!dateStr) return false
  const parts = dateStr.split('/')
  if (parts.length !== 3) return false
  const [day, month, year] = parts.map(Number)
  if ([day, month, year].some(isNaN)) return false
  const date = new Date(year, month - 1, day)
  return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year
}

function formatCurrencyBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function normalizeTransactionData(data: AIResponse['transactionData']): AIResponse['transactionData'] {
  if (!data) return data

  if (!data.status) {
    data.status = 'Pago'
  }

  if (!isValidBrDate(data.date)) {
    data.date = new Date().toLocaleDateString('pt-BR')
  }

  const numericValue = Number(data.value)
  if (!isNaN(numericValue)) {
    data.value = numericValue
  }

  return data
}

function buildTransactionConfirmation(data: AIResponse['transactionData']): string {
  if (!data) return 'Transação registrada.'

  const prefix = data.type === 'Entrada' ? 'Entrada de' : 'Saída de'
  const description = data.description ? ` (${data.description})` : ''
  const date = data.date ? ` em ${data.date}` : ''

  return `${prefix} ${formatCurrencyBRL(data.value)}${description}${date}`
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

    if (parsed.transactionData && parsed.type === 'message') {
      parsed.type = 'pending_transaction'
    }

    if (parsed.type === 'pending_transaction' && parsed.transactionData) {
      parsed.transactionData = normalizeTransactionData(parsed.transactionData)
      parsed.text = buildTransactionConfirmation(parsed.transactionData)
    }

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

const TRANSACTION_MOVEMENT_PATTERN =
  /(entrou|saiu|entrada|saída|saida|recebi|recebimento|ganhei|paguei|pagamento|comprei|compra|enviei|transferi|transferência|transferencia|gastei|gasto|depositei|saque|depósito|deposito|registre|registrar|registra|adiciona|adicionar|lanc[ea]|lancei)/i

const FUTURE_INTENT_PATTERN =
  /(vou|vai|vamos|pagarei|comprarei|preciso pagar|tenho que pagar|devo pagar|mês que vem|mes que vem|no mês que vem|amanhã|amanha|depois|futura|futuro|até dia|a pagar|pendente)/i

function hasFutureIntent(text: string): boolean {
  return FUTURE_INTENT_PATTERN.test(text)
}

function hasTransactionIntent(text: string): boolean {
  return /\d/.test(text) && TRANSACTION_MOVEMENT_PATTERN.test(text)
}

function applyStatusDefault(response: AIResponse, lastMessage: string): AIResponse {
  if (response.type === 'pending_transaction' && response.transactionData) {
    const status = response.transactionData.status

    if ((status === 'Pendente' || status === 'Para pagar') && !hasFutureIntent(lastMessage)) {
      response.transactionData.status = 'Pago'
    }
  }

  return response
}

function parseExtractedTransaction(raw: string): AIResponse['transactionData'] | null {
  try {
    const cleaned = cleanJsonResponse(raw)
    const parsed = JSON.parse(cleaned)
    const data = (parsed.transactionData ?? parsed) as AIResponse['transactionData']

    if (data && typeof data.value !== 'undefined' && data.type) {
      return normalizeTransactionData(data)
    }

    return null
  } catch {
    return null
  }
}

function buildExtractInstruction(today: string): string {
  return `Hoje é dia ${today}.
O usuário acabou de descrever uma transação financeira. Extraia os dados dela.
Responda APENAS com o JSON do objeto transactionData, sem texto e sem código markdown:
{
  "status": "Pago" | "Pendente" | "Para pagar",
  "date": "DD/MM/AAAA",
  "type": "Entrada" | "Saída",
  "value": number,
  "category": "Alimentação" | "Moradia" | "Transporte" | "Lazer" | "Saúde" | "Educação" | "Outros",
  "description": "string",
  "recurring": "Sim" | "Não"
}
Regras:
- status: SEMPRE "Pago" por padrão — a menos que o usuário deixe EXPLÍCITO que a ação é futura (vou pagar, preciso pagar, vou comprar, mês que vem). Nunca marque "Pendente"/"Para pagar" sem o usuário ter dito que ainda vai pagar.
- type: "Entrada" quando o dinheiro ENTRA (recebi, entrou, ganhei). "Saída" quando o dinheiro SAI (comprei, enviei, paguei, transferi, gastei).
- category: APENAS um destes valores exatos — "Alimentação", "Moradia", "Transporte", "Lazer", "Saúde", "Educação", "Outros". "Salário" NÃO é categoria: use "Outros".
- date: formato DD/MM/AAAA. Se o usuário mencionou uma data, use exatamente essa (ano ${today.split('/')[2]} se o ano não foi informado). Se não mencionou, use ${today}.
- description: frase curta e formal (ex: "enviei 10 reais para angela sorteio" -> "Envio para sorteio da Ângela").
- recurring: "Sim" apenas se mencionar "todo mês"/"assinatura"/"mensal". Default "Não".`
}

async function extractTransactionData(
  text: string,
  systemPrompt: string,
  provider: ModelProvider,
  today: string,
): Promise<AIResponse['transactionData'] | null> {
  const instruction = buildExtractInstruction(today)

  try {
    if (provider === 'groq') {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'system', content: instruction },
          { role: 'user', content: text },
        ],
        temperature: 0,
        max_tokens: 300,
        stream: false,
      })

      return parseExtractedTransaction(completion.choices[0]?.message?.content || '')
    }

    const interaction = await ai.interactions.create({
      model: 'gemini-3.5-flash',
      input: text,
      system_instruction: `${systemPrompt}\n\n${instruction}`,
    })

    return parseExtractedTransaction(interaction.output_text || '')
  } catch {
    return null
  }
}

async function ensureTransaction(
  response: AIResponse,
  lastMessage: string,
  systemPrompt: string,
  provider: ModelProvider,
  today: string,
): Promise<AIResponse> {
  if (response.type === 'message' && !response.transactionData && hasTransactionIntent(lastMessage)) {
    const data = await extractTransactionData(lastMessage, systemPrompt, provider, today)

    if (data) {
      return {
        type: 'pending_transaction',
        text: buildTransactionConfirmation(data),
        transactionData: data,
      }
    }
  }

  return response
}

function cleanJsonResponse(raw: string): string {
  return raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const FINANCE_QUERY_PATTERN = /(gast|despes|entrad|saída|saida|recebi|recebimento|saldo|total|quanto|investid)/i

function isFinanceQuery(text: string): boolean {
  return FINANCE_QUERY_PATTERN.test(text)
}

function detectMonthQuery(text: string): { month: number; year: number } | null {
  const lower = text.toLowerCase()

  let monthIndex = -1
  MONTH_NAMES.forEach((name, i) => {
    if (new RegExp(`\\b${name}\\b`, 'i').test(lower)) {
      monthIndex = i
    }
  })

  const mesMatch = lower.match(/m[eê]s(?: de)? (\d{1,2})/)
  if (mesMatch) {
    const m = Number(mesMatch[1])
    if (m >= 1 && m <= 12) {
      monthIndex = m - 1
    }
  }

  if (monthIndex === -1) return null

  const yearMatch = lower.match(/(20\d{2}|19\d{2})/)
  let year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear()

  if (lower.includes('ano passado')) {
    year = new Date().getFullYear() - 1
  }

  return { month: monthIndex, year }
}

function buildMonthBreakdown(rows: SpentObject[], month: number, year: number): string {
  const expenses = rows.filter((t) => t.type === 'Saída')
  const incomes = rows.filter((t) => t.type === 'Entrada')

  const byCategory = expenses.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.value
    return acc
  }, {})

  const totalIncome = incomes.reduce((sum, t) => sum + t.value, 0)
  const totalExpenses = expenses.reduce((sum, t) => sum + t.value, 0)

  const categoryLines =
    Object.entries(byCategory).length > 0
      ? Object.entries(byCategory)
          .map(([category, value]) => `- ${category}: R$ ${value.toFixed(2)}`)
          .join('\n')
      : '- Nenhuma despesa registrada.'

  return `Mês de ${MONTH_NAMES[month]} de ${year}:
${categoryLines}
Total de Saídas: R$ ${totalExpenses.toFixed(2)}
Total de Entradas: R$ ${totalIncome.toFixed(2)}
Saldo: R$ ${(totalIncome - totalExpenses).toFixed(2)}`
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

  const lastMessage = messages[messages.length - 1]?.content || ''

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

  const monthQuery = detectMonthQuery(lastMessage)
  const dynamicBreakdown = monthQuery && isFinanceQuery(lastMessage)
    ? buildMonthBreakdown(
        transactions.filter((t) => {
          const date = parseBrDate(t.date)
          return date ? date.getMonth() === monthQuery.month && date.getFullYear() === monthQuery.year : false
        }),
        monthQuery.month,
        monthQuery.year,
      )
    : undefined

  console.log('Dynamic breakdown:', dynamicBreakdown || 'nenhum')

  const systemPrompt = buildSystemPrompt(summary, today, currentMonthLabel, transactionHistory, dynamicBreakdown)

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
        temperature: 0.3,
        max_completion_tokens: 2048,
        top_p: 1,
        stream: false,
      })

      return applyStatusDefault(
        await ensureTransaction(
          parseAIResponse(completion.choices[0]?.message?.content || '', transactions, currentYear, currentMonth),
          lastMessage,
          systemPrompt,
          provider,
          today,
        ),
        lastMessage,
      )
    }

    const interaction = await ai.interactions.create({
      model: 'gemini-3.5-flash',
      input: lastMessage,
      system_instruction: systemPrompt,
    })

    return applyStatusDefault(
      await ensureTransaction(
        parseAIResponse(interaction.output_text || '', transactions, currentYear, currentMonth),
        lastMessage,
        systemPrompt,
        provider,
        today,
      ),
      lastMessage,
    )
  } catch {
    return {
      type: 'message',
      text: 'Desculpe, ocorreu um erro ao processar sua solicitação.',
    }
  }
}
