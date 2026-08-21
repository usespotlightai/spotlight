import { type Env, envSchema } from '@infrastructure/config/env.schema';

export function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return result.data;
}
