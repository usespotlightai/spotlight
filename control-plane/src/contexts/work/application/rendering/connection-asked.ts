import type { ConnectionWantedDto } from '@work/application/ports/integration-tool-calls.port';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';

const unmet = (wanted: ConnectionWantedDto): string =>
  wanted.because === 'renewal-refused'
    ? `${wanted.integration} refused to renew your connection, so it has to be made again`
    : `you haven’t connected ${wanted.integration} yet`;

export const ConnectionAsked = {
  body(declared: DeclaredTool, wanted: ConnectionWantedDto): string {
    return [
      `I need to use \`${declared.tool.value}\`, which acts as you in ${wanted.integration}, and ${unmet(wanted)}.`,
      `Connect ${wanted.integration} and I will carry on. Nothing has been sent yet.`,
    ].join('\n\n');
  },

  busy(wanted: ConnectionWantedDto): string {
    return `this task is already waiting on someone, so nobody can be asked to connect ${wanted.integration} until they answer`;
  },

  refusal(wanted: ConnectionWantedDto): string {
    switch (wanted.because) {
      case 'no-requester':
        return `nobody started this task, so there is nobody whose ${wanted.integration} connection it could act with`;
      case 'not-a-member':
        return `the person who started this task is no longer on the team, so it cannot act with their ${wanted.integration} connection`;
      case 'renewal-refused':
        return `${wanted.integration} refused to renew the connection of the person who started this task`;
      case 'not-connected':
        return `the person who started this task hasn’t connected ${wanted.integration}`;
    }
  },
};
