'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface Props {
  data: { name: string; value: number }[]
}

export function TransactionChart({ data }: Props) {
  console.log('Dados finais do gráfico:', data)

  if (!data || data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Nenhum gasto registrado nesse período.
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="name"
            stroke="#a1a1aa"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#a1a1aa"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `R$ ${val}`}
          />
          <Tooltip
            cursor={{ fill: '#27272a' }}
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              color: '#f4f4f5',
            }}
            formatter={(value) => [`R$ ${Number(value).toFixed(2)}`, 'Total']}
          />
          <Bar dataKey="value" fill="#e4e4e7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
