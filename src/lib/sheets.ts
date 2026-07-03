'use server'

import { google } from 'googleapis'

const SPREADSHEET_ID = '10Z_XiDueA2Z6rpzS1CV5BAp7IaDsn_86bXrUxnMryHA'

interface TransactionData {
  action: 'add' | 'remove'
  value: number
  category: string
  description?: string | null
}

export async function saveTransaction(data: TransactionData) {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  if (!clientEmail || !privateKey) {
    return { error: 'Credenciais do Google não configuradas.' }
  }

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    const type = data.action === 'add' && data.value >= 0 ? 'Receita' : 'Despesa'

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          new Date().toLocaleDateString('pt-BR'),
          type,
          data.value,
          data.category,
          data.description || '',
        ]],
      },
    })

    return { success: true }
  } catch (err) {
    console.error('Sheets error:', err)
    return { error: 'Erro ao salvar na planilha.' }
  }
}
