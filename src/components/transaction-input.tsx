'use client'

import { useState } from 'react'
import type { Transaction } from '@/types'

interface Props {
  onAdd: (transaction: Transaction) => void
}

export function TransactionInput({ onAdd }: Props) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const transaction = parseTransaction(input.trim())
    if (transaction) {
      onAdd(transaction)
      setInput('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ex: Comprei café por R$ 8,50"
        className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
      />
      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Adicionar
      </button>
    </form>
  )
}

function parseTransaction(input: string): Transaction | null {
  const lower = input.toLowerCase()
  const isIncome = /recebi|ganhei|salario|salário|deposito|depósito|credito|crédito/i.test(lower)

  const amountMatch = input.match(/(?:R?\$)?\s*([\d.,]+)/)
  if (!amountMatch) return null

  const amount = parseFloat(amountMatch[1].replace(',', '.'))
  if (isNaN(amount)) return null

  const description = input.replace(/(?:R?\$)?\s*[\d.,]+\s*/, '').trim()

  return {
    id: crypto.randomUUID(),
    description: description || input,
    amount,
    type: isIncome ? 'income' : 'expense',
    category: 'geral',
    date: new Date().toISOString(),
  }
}
