import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z
    .string()
    .min(
      1,
      "DATABASE_URL is required. Set it in apps/api/.env (Supabase connection string)."
    )
});

export const env = envSchema.parse(process.env);

