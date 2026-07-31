'use server'

import { Pool } from 'pg'

interface TransactionData {
  status?: string
  type: string
  value: number
  category: string
  description?: string | null
  recurring?: string
}

export interface SpentObject {
  status: string
  date: string
  type: string
  category: string
  description: string
  value: number
  recurring: string
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
})

export async function getTransactions(): Promise<SpentObject[]> {
  console.log('Buscando transações no banco de dados...')

  try {
    const result = await pool.query(
      `SELECT status, date, type, category, description, value, recurring
       FROM transactions
       ORDER BY id ASC`,
    )

    console.log(`Total de linhas lidas: ${result.rows.length}`)

    const transactions: SpentObject[] = result.rows.map((row) => ({
      status: String(row.status || ''),
      date: String(row.date || ''),
      type: String(row.type || ''),
      category: String(row.category || ''),
      description: String(row.description || ''),
      value: Number(row.value),
      recurring: String(row.recurring || ''),
    }))

    console.log(`Transações válidas encontradas: ${transactions.length}`)

    return transactions
  } catch (err) {
    console.error('ERRO AO BUSCAR TRANSAÇÕES:', err)
    return []
  }
}

export async function saveTransaction(data: TransactionData) {
  console.log('Iniciando salvamento no banco de dados...', data)

  try {
    const currentDate = new Date().toLocaleDateString('pt-BR')

    const values = [
      data.status || 'Pago',
      currentDate,
      data.type || 'Saída',
      data.category || 'Outros',
      data.description || '',
      data.value,
      data.recurring || 'Não',
    ]

    console.log('Payload enviado:', JSON.stringify(values))

    await pool.query(
      `INSERT INTO transactions (status, date, type, category, description, value, recurring)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      values,
    )

    return { success: true }
  } catch (err) {
    console.error('ERRO AO SALVAR NO BANCO DE DADOS:', err)
    return { error: 'Erro ao salvar no banco de dados.' }
  }
}
