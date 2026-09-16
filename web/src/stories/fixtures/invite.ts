import type { QueryClient } from '@tanstack/react-query';
import { inviteKeys } from '@/hooks/api/useInvites';
import type { InviteOfferResponseDto } from '@/lib/api';
import { failQuery } from '@/stories/failQuery';

export const TOKEN = 'invite_platform';

const OFFER: InviteOfferResponseDto = {
  email: 'sam@example.com',
  teamName: 'Platform',
  workspaceName: 'Acme',
  invitedBy: 'Jordan Lee',
  standing: 'open',
};

export const seedInvite = (client: QueryClient) =>
  client.setQueryData(inviteKeys.byToken(TOKEN), OFFER);

export const missingInvite = (client: QueryClient) =>
  client.setQueryData(inviteKeys.byToken(TOKEN), null);

export const failInvite = (client: QueryClient) =>
  failQuery(client, inviteKeys.byToken(TOKEN));
