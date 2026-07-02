'use client'

import type { Transaction } from '@/types'

interface Props {
  transactions: Transaction[]
}

export function TransactionTable({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-400">
        Nenhuma transação registrada.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
            <th className="pb-2 pr-4 font-medium">Descrição</th>
            <th className="pb-2 pr-4 font-medium">Valor</th>
            <th className="pb-2 pr-4 font-medium">Tipo</th>
            <th className="pb-2 font-medium">Data</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-b border-neutral-100">
              <td className="py-2 pr-4 text-neutral-900">{t.description}</td>
              <td
                className={`py-2 pr-4 font-medium ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}
              >
                {t.type === 'income' ? '+' : '-'}R$ {t.amount.toFixed(2)}
              </td>
              <td className="py-2 pr-4 text-neutral-500">
                {t.type === 'income' ? 'Receita' : 'Despesa'}
              </td>
              <td className="py-2 text-neutral-500">
                {new Date(t.date).toLocaleDateString('pt-BR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
