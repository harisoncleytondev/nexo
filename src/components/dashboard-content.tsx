'use client'

import { useState, useEffect } from 'react'
import type { Transaction } from '@/types'
import { TransactionInput } from './transaction-input'
import { TransactionTable } from './transaction-table'
import { LogoutButton } from './logout-button'

export function DashboardContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('transactions')
    if (stored) setTransactions(JSON.parse(stored))
  }, [])

  const addTransaction = (transaction: Transaction) => {
    const updated = [transaction, ...transactions]
    setTransactions(updated)
    localStorage.setItem('transactions', JSON.stringify(updated))
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col bg-white">
      <header className="border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-neutral-900">Nexo</h1>
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col px-4 py-6">
        <TransactionInput onAdd={addTransaction} />
        <div className="mt-8">
          <TransactionTable transactions={transactions} />
        </div>
      </main>
    </div>
  )
}
