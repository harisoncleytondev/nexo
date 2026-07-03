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
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis
            dataKey="name"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={{ stroke: '#27272a' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={{ stroke: '#27272a' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#18181b',
              border: '1px solid #27272a',
              borderRadius: 8,
              fontSize: 12,
              color: '#e4e4e7',
            }}
          />
          <Bar dataKey="value" fill="#e4e4e7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
