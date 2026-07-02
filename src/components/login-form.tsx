'use client'

import { useActionState } from 'react'
import { login } from '@/lib/actions'

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null)

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div className="space-y-1">
        <label htmlFor="username" className="text-sm font-medium text-neutral-700">
          Usuário
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="username"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          placeholder="Digite seu usuário"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-neutral-700">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          placeholder="Digite sua senha"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  )
}
