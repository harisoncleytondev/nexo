'use client'

import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import type { AIResponse } from '@/types'
import { TransactionChart } from './transaction-chart'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  type?: 'message' | 'pending_transaction' | 'chart'
  transactionData?: AIResponse['transactionData']
  chartData?: { name: string; value: number }[]
  status?: 'pending' | 'confirmed' | 'cancelled'
}

interface Props {
  message: Message
  saving?: boolean
  onConfirm?: (msg: Message) => void
  onCancel?: (msg: Message) => void
}

export function MessageBubble({ message, saving, onConfirm, onCancel }: Props) {
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
        <div className="prose prose-invert prose-sm max-w-none text-zinc-300">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
            {message.content}
          </ReactMarkdown>
        </div>

        {message.type === 'pending_transaction' && message.transactionData && message.status === 'pending' && (
          <>
            <div className="space-y-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Status</span>
                <span className="text-white">{message.transactionData.status || 'Pago'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Tipo</span>
                <span className={message.transactionData.type === 'Entrada' ? 'text-green-400' : 'text-red-400'}>
                  {message.transactionData.type}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Valor</span>
                <span className="text-white">R$ {message.transactionData.value.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Categoria</span>
                <span className="text-zinc-300">{message.transactionData.category}</span>
              </div>
              {message.transactionData.description && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Motivo</span>
                  <span className="text-zinc-300">{message.transactionData.description}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Recorrente</span>
                <span className="text-zinc-300">{message.transactionData.recurring || 'Não'}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onConfirm?.(message)}
                disabled={saving}
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Confirmar'}
              </button>
              <button
                onClick={() => onCancel?.(message)}
                disabled={saving}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </>
        )}

        {message.type === 'chart' && message.chartData && (
          <TransactionChart data={message.chartData} />
        )}
      </div>
    </div>
  )
}
