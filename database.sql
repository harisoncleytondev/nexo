CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'Pago',
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  value NUMERIC(12, 2) NOT NULL,
  recurring TEXT NOT NULL DEFAULT 'Não',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
