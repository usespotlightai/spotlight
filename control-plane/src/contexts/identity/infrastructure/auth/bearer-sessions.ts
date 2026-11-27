import { bearer } from 'better-auth/plugins';

const bearerWithoutAfterHooks = () => {
  const plugin = bearer();

  return { ...plugin, hooks: { before: plugin.hooks.before } };
};

export const bearerSessions: typeof bearerWithoutAfterHooks =
  bearerWithoutAfterHooks;
