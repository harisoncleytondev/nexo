'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'

interface Props {
  onSend: (text: string) => void
}

export function ChatInput({ onSend }: Props) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua transação..."
          className="w-full rounded-full bg-zinc-900 px-4 py-2.5 pr-12 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
