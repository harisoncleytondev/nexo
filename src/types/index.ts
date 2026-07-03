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
    action: 'add' | 'remove'
    value: number
    category: string
    description: string
  }
  chartData?: { name: string; value: number }[]
}
