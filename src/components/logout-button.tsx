'use client'

import { logout } from '@/lib/actions'

export function LogoutButton() {
  return (
    <button
      onClick={() => logout()}
      className="text-xs text-neutral-500 hover:text-neutral-900"
    >
      Sair
    </button>
  )
}
