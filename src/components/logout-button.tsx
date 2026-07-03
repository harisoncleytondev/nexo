'use client'

import { logout } from '@/lib/actions'

export function LogoutButton() {
  return (
    <button
      onClick={() => logout()}
      className="text-xs text-zinc-500 hover:text-zinc-300"
    >
      Sair
    </button>
  )
}
