import type {
  IntegrationViewResponseDto,
  MemberResponseDto,
  MyConnectionResponseDto,
  PersonConnectionResponseDto,
} from '@/lib/api';
import { toolsCounted } from '@/lib/described';

export type Integration = IntegrationViewResponseDto;

export type MyConnection = MyConnectionResponseDto;

export const actsAsEachPerson = (integration: Integration): boolean =>
  integration.holderRule === 'requester';

export const usesTeamAccount = (integration: Integration): boolean =>
  integration.standing !== 'listens';

const formatTools = ({ described }: Integration): string | null => {
  if (!described || described.problem) {
    return null;
  }

  return toolsCounted(described.tools);
};

export const formatUsedFor = (integration: Integration): string => {
  const acting = !usesTeamAccount(integration)
    ? 'Receives events'
    : actsAsEachPerson(integration)
      ? 'Acts as each person'
      : 'Acts as the team';
  const tools = formatTools(integration);

  return tools ? `${acting} · ${tools}` : acting;
};

export const teamAccountPurpose = (integration: Integration): string =>
  actsAsEachPerson(integration)
    ? 'Watches and posts for the team.'
    : 'Agents’ tools act as this account.';

type Connected = {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
};

export type Joined = {
  readonly connected: readonly Connected[];
  readonly waiting: readonly MemberResponseDto[];
};

export const joinedOf = (
  source: string,
  people: readonly PersonConnectionResponseDto[],
  members: readonly MemberResponseDto[],
): Joined => {
  const images = new Map(members.map((member) => [member.id, member.image]));
  const connected = people
    .filter((each) => each.source === source)
    .map((each) => ({
      id: each.personId,
      name: each.name || 'Someone who left',
      image: images.get(each.personId) ?? null,
    }));
  const ids = new Set(connected.map((each) => each.id));

  return {
    connected,
    waiting: members.filter((member) => !ids.has(member.id)),
  };
};
