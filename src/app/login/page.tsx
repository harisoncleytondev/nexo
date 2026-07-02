import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-neutral-900">Nexo</h1>
          <p className="text-sm text-neutral-500">Acesso restrito</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
