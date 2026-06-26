import type { Config } from 'drizzle-kit';

export default {
  schema: './src/database/schemas/*.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] || 'postgresql://telecom:telecom_secret@localhost:5432/telecom_tickets',
  },
} satisfies Config;
