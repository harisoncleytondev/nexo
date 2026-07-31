'use server'

import { AuthError } from 'next-auth'
import { signIn, signOut } from './auth'

export async function login(_prevState: { error?: string } | null, formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  try {
    await signIn('credentials', {
      username,
      password,
      redirectTo: '/',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Credenciais inválidas' }
    }
    throw error
  }

  return null
}

export async function logout() {
  await signOut({ redirectTo: '/login' })
}
