'use client'

import type { Transaction } from '@/types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  transaction?: Transaction
}

interface Props {
  message: Message
}

export function MessageBubble({ message }: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-zinc-800 px-4 py-2 text-sm text-white">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] space-y-2">
        <p className="text-sm text-zinc-300">{message.content}</p>
        {message.transaction && (
          <div className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Valor</span>
              <span className={message.transaction.type === 'income' ? 'text-green-400' : 'text-red-400'}>
                {message.transaction.type === 'income' ? '+' : '-'}R$ {message.transaction.amount.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Categoria</span>
              <span className="text-zinc-300">{message.transaction.category}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Data</span>
              <span className="text-zinc-300">{new Date(message.transaction.date).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
