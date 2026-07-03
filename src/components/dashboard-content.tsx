'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import type { Transaction, AIResponse } from '@/types'
import { MessageBubble } from './message-bubble'
import { ChatInput } from './chat-input'
import { LogoutButton } from './logout-button'
import { chat } from '@/lib/chat'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  type?: 'message' | 'pending_transaction' | 'chart'
  transactionData?: AIResponse['transactionData']
  chartData?: { name: string; value: number }[]
  status?: 'pending' | 'confirmed' | 'cancelled'
}

export function DashboardContent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! Como posso ajudar com suas finanças hoje?',
    },
  ])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('transactions')
    if (stored) setTransactions(JSON.parse(stored))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const confirmTransaction = (msg: Message) => {
    if (!msg.transactionData) return

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      description: msg.transactionData.description,
      amount: msg.transactionData.value,
      type: msg.transactionData.action === 'add'
        ? msg.transactionData.value >= 0 ? 'income' : 'expense'
        : 'expense',
      category: msg.transactionData.category,
      date: new Date().toISOString(),
    }

    setTransactions((prev) => {
      const updated = [transaction, ...prev]
      localStorage.setItem('transactions', JSON.stringify(updated))
      return updated
    })

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, status: 'confirmed' as const } : m
      )
    )
  }

  const cancelTransaction = (msg: Message) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, status: 'cancelled' as const } : m
      )
    )
  }

  const handleSend = (text: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMessage])

    startTransition(async () => {
      const history = messages
        .concat(userMessage)
        .map((m) => ({ role: m.role, content: m.content }))

      const result: AIResponse = await chat(history)

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.text,
        type: result.type,
        transactionData: result.transactionData,
        chartData: result.chartData,
        status: result.type === 'pending_transaction' ? 'pending' : undefined,
      }

      setMessages((prev) => [...prev, assistantMessage])
    })
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
            <MessageBubble
              key={msg.id}
              message={msg}
              onConfirm={confirmTransaction}
              onCancel={cancelTransaction}
            />
          ))}
          {isPending && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl bg-zinc-900 px-4 py-2 text-sm text-zinc-500">
                processando...
              </div>
            </div>
          )}
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
