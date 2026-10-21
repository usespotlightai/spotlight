import { bearer } from 'better-auth/plugins';

export const bearerSessions = () => {
  const plugin = bearer();

  return { ...plugin, hooks: { before: plugin.hooks.before } };
};
