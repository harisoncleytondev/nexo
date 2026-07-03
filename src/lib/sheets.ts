'use server'

import { google } from 'googleapis'

interface TransactionData {
  status?: string
  type: string
  value: number
  category: string
  description?: string | null
  recurring?: string
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
