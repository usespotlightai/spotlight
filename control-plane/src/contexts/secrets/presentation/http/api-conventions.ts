import type { ApiConvention } from '@platform/http/api-conventions';

export const SECRETS_API_CONVENTIONS: readonly ApiConvention[] = [
  {
    title: 'Secret changes',
    text: "A secret's change is recorded like any configuration change, and also records the value version it moved to and the hosts it is bound to, never its value.",
  },
];
