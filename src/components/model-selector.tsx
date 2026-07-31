'use client'

import type { ModelProvider } from '@/types'

interface Props {
  value: ModelProvider
  onChange: (provider: ModelProvider) => void
}

const providers: { id: ModelProvider; label: string }[] = [
  { id: 'groq', label: 'Groq' },
  { id: 'gemini', label: 'Gemini' },
]

export function ModelSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-zinc-900 p-1 text-xs">
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={
            value === p.id
              ? 'rounded-full bg-zinc-700 px-3 py-1 text-white'
              : 'rounded-full px-3 py-1 text-zinc-500 hover:text-zinc-300'
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
