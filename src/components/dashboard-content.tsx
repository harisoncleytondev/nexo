'use client'

import { useState, useEffect, useRef } from 'react'
import type { Transaction } from '@/types'
import { MessageBubble } from './message-bubble'
import { ChatInput } from './chat-input'
import { LogoutButton } from './logout-button'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  transaction?: Transaction
}

export function DashboardContent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! Registre suas transações financeiras aqui.',
    },
  ])
  const [, setTransactions] = useState<Transaction[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('transactions')
    if (stored) setTransactions(JSON.parse(stored))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (text: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMessage])

    const parsed = parseTransaction(text)
    if (parsed) {
      setTransactions((prev) => {
        const updated = [parsed, ...prev]
        localStorage.setItem('transactions', JSON.stringify(updated))
        return updated
      })

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Transação registrada:',
            transaction: parsed,
          },
        ])
      }, 400)
    } else {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              'Não entendi. Tente algo como: "Comprei café por R$ 8,50" ou "Recebi salário de R$ 5.000,00"',
          },
        ])
      }, 400)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <h1 className="text-sm font-semibold text-white">Nexo</h1>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md space-y-4 px-4 py-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="sticky bottom-0 border-t border-zinc-800 bg-black">
        <div className="mx-auto max-w-md px-4 py-3">
          <ChatInput onSend={handleSend} />
        </div>
      </footer>
    </div>
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
