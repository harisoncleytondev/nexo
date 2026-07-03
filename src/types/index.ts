export interface Transaction {
  id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
  date: string
}

export interface AIResponse {
  type: 'message' | 'pending_transaction' | 'chart'
  text: string
  transactionData?: {
    status?: string
    type: string
    value: number
    category: string
    description?: string | null
    recurring?: string
  }
  chartData?: { name: string; value: number }[]
}
