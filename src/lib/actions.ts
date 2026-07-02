'use server'

import { createSession, destroySession } from './session'
import { redirect } from 'next/navigation'

export async function login(_prevState: { error?: string } | null, formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  if (username !== process.env.ADMIN_USER || password !== process.env.ADMIN_PASS) {
    return { error: 'Credenciais inválidas' }
  }

  await createSession(username)
  redirect('/')
}

export async function logout() {
  await destroySession()
  redirect('/login')
}
