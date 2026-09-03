import type { Integration } from '@domain/entities/integration.entity';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';

export const INTEGRATION_READER = Symbol('INTEGRATION_READER');

export interface ReadIntegrations {
  /** Every host the files declare well enough to listen to. */
  readonly integrations: readonly Integration[];
  /** Everything wrong with the rest, for whoever has to fix it. */
  readonly problems: readonly ConfigurationProblem[];
}

/**
 * Turns the files a workspace keeps into the hosts they declare. What the
 * rules are written in is this port's business and not the caller's: the
 * application asks what a workspace listens to and what is wrong, and gets
 * back the domain's own words either way.
 *
 * A file that will not read is not an error here. It is one integration
 * missing and a problem to show, while everything beside it goes on working.
 */
export interface IntegrationReaderPort {
  read(files: readonly ConfigurationFile[]): ReadIntegrations;
}
