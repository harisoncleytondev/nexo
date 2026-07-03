'use server'

import { google, sheets_v4 } from 'googleapis'

interface TransactionData {
  status?: string
  type: string
  value: number
  category: string
  description?: string | null
  recurring?: string
}

export interface SheetRow {
  status: string
  date: string
  type: string
  category: string
  description: string
  value: number
  recurring: string
}

async function getSheetsClient(): Promise<sheets_v4.Sheets | null> {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

  if (!clientEmail || !privateKey || !spreadsheetId) {
    return null
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  return google.sheets({ version: 'v4', auth })
}

function getSpreadsheetId(): string | null {
  return process.env.GOOGLE_SPREADSHEET_ID || null
}

export async function getTransactions(): Promise<SheetRow[]> {
  console.log('Buscando transacoes no Sheets...')

  const sheets = await getSheetsClient()
  const spreadsheetId = getSpreadsheetId()

  if (!sheets || !spreadsheetId) {
    console.error('Credenciais do Google nao configuradas.')
    return []
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A:G',
    })

    const rows = response.data.values || []

    console.log(`Total de linhas lidas: ${rows.length}`)

    const transactions: SheetRow[] = rows
      .filter((row) => {
        const value = row[5]
        if (value === undefined || value === null || value === '') return false
        const num = parseFloat(String(value).replace(',', '.'))
        return !isNaN(num)
      })
      .map((row) => ({
        status: String(row[0] || ''),
        date: String(row[1] || ''),
        type: String(row[2] || ''),
        category: String(row[3] || ''),
        description: String(row[4] || ''),
        value: parseFloat(String(row[5]).replace(',', '.')),
        recurring: String(row[6] || ''),
      }))

    console.log(`Transacoes validas encontradas: ${transactions.length}`)

    return transactions
  } catch (err) {
    console.error('ERRO AO BUSCAR TRANSAÇÕES:', err)
    return []
  }
}

export async function saveTransaction(data: TransactionData) {
  console.log('Iniciando salvamento no Sheets...', data)

  const sheets = await getSheetsClient()
  const spreadsheetId = getSpreadsheetId()

  if (!sheets || !spreadsheetId) {
    return { error: 'Credenciais do Google não configuradas.' }
  }

  try {
    const currentDate = new Date().toLocaleDateString('pt-BR')

    const payload = {
      spreadsheetId,
      range: 'A:G',
      valueInputOption: 'USER_ENTERED' as const,
      requestBody: {
        values: [[
          data.status || 'Pago',
          currentDate,
          data.type || 'Saída',
          data.category || 'Outros',
          data.description || '',
          data.value,
          data.recurring || 'Não',
        ]],
      },
    }

    console.log('Payload enviado:', JSON.stringify(payload, null, 2))

    const response = await sheets.spreadsheets.values.append(payload)

    console.log('Resposta do Sheets:', response.data)

    return { success: true }
  } catch (err) {
    console.error('ERRO AO SALVAR NO SHEETS:', err)
    return { error: 'Erro ao salvar na planilha.' }
  }
}
