import type { ConnectionMissingDto } from '@work/application/ports/integration-tool-calls.port';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';

const unmet = (missing: ConnectionMissingDto): string =>
  missing.because === 'refresh-failed'
    ? `${missing.integrationName} could not refresh your connection, so it has to be made again`
    : `you haven’t connected ${missing.integrationName} yet`;

export const ConnectionAsked = {
  body(declared: DeclaredTool, missing: ConnectionMissingDto): string {
    return [
      `I need to use \`${declared.tool.value}\`, which acts as you in ${missing.integrationName}, and ${unmet(missing)}.`,
      `Connect ${missing.integrationName} and I will carry on. Nothing has been sent yet.`,
    ].join('\n\n');
  },

  busy(missing: ConnectionMissingDto): string {
    return `this task is already waiting on someone, so nobody can be asked to connect ${missing.integrationName} until they answer`;
  },

  denial(missing: ConnectionMissingDto): string {
    switch (missing.because) {
      case 'no-requester':
        return `nobody started this task, so there is nobody whose ${missing.integrationName} connection it could act with`;
      case 'not-a-member':
        return `the person who started this task is no longer on the team, so it cannot act with their ${missing.integrationName} connection`;
      case 'refresh-failed':
        return `${missing.integrationName} could not refresh the connection of the person who started this task`;
      case 'not-connected':
        return `the person who started this task hasn’t connected ${missing.integrationName}`;
    }
  },
};
