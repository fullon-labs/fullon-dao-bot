import {z} from 'zod';

const schema=z.object({
  NODE_ENV:z.enum(['development','test','production']).default('development'),
  HOST:z.string().default('127.0.0.1'),
  PORT:z.coerce.number().int().positive().default(8787),
  PUBLIC_ORIGIN:z.string().url(),
  ALLOWED_ORIGINS:z.string().default(''),
  DATABASE_URL:z.string().min(1),
  FULLON_RPC_URL:z.string().url(),
  FULLON_CHAIN_ID:z.string().regex(/^[0-9a-f]{64}$/),
  FULLON_NETWORK_NAME:z.string().min(1),
  DAO_CONTRACT:z.string().default('dao.gov'),
  GITHUB_APP_ID:z.string().min(1),
  GITHUB_INSTALLATION_ID:z.coerce.number().int().positive(),
  GITHUB_PRIVATE_KEY_BASE64:z.string().min(1),
  GITHUB_WEBHOOK_SECRET:z.string().min(16),
  GITHUB_OWNER:z.string().min(1),
  GITHUB_REPO:z.string().min(1),
  GITHUB_DISCUSSION_CATEGORY_ID:z.string().min(1),
  CHALLENGE_TTL_SECONDS:z.coerce.number().int().min(60).max(900).default(300),
  WORKER_INTERVAL_SECONDS:z.coerce.number().int().min(10).default(30)
});

export type Config=z.infer<typeof schema> & {allowedOrigins:string[];githubPrivateKey:string};

export function loadConfig(env:NodeJS.ProcessEnv=process.env):Config{
  const value=schema.parse(env);
  return {
    ...value,
    allowedOrigins:value.ALLOWED_ORIGINS.split(',').map(v=>v.trim()).filter(Boolean),
    githubPrivateKey:Buffer.from(value.GITHUB_PRIVATE_KEY_BASE64,'base64').toString('utf8')
  };
}
