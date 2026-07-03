'use server'

import { google } from 'googleapis'

interface TransactionData {
  action: 'add' | 'remove'
  value: number
  category: string
  description?: string | null
}

export async function saveTransaction(data: TransactionData) {
  console.log('Iniciando salvamento no Sheets...', data)

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

  if (!clientEmail || !privateKey || !spreadsheetId) {
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

    const payload = {
      spreadsheetId,
      range: 'A:E',
      valueInputOption: 'USER_ENTERED' as const,
      requestBody: {
        values: [[
          new Date().toLocaleDateString('pt-BR'),
          type,
          data.value,
          data.category,
          data.description || '',
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
