import { InvalidActionError } from '@integrations/domain/exceptions/invalid-action.error';
import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

export interface ActionFields {
  readonly name: string;
  readonly fromNetwork: boolean;
  readonly waitsSeconds: number | null;
  readonly uploads: { readonly sendsBody: boolean } | null;
  readonly auth: { readonly oauth2: boolean; readonly secrets: boolean };
  readonly headers: readonly string[];
  readonly url: string;
}

export interface ActionProblem {
  readonly at: FieldPath;
  readonly because: string;
}

const at = (...segments: string[]) => FieldPath.of(segments);

const fromSpotlightProblems = (fields: ActionFields): ActionProblem[] =>
  fields.waitsSeconds === null
    ? []
    : [
        {
          at: at('timeoutSeconds'),
          because:
            'is how long Spotlight waits for a host to send the action. Only an action sent from the network has it. Please set from: network, or remove timeoutSeconds',
        },
      ];

const fromNetworkProblems = (fields: ActionFields): ActionProblem[] => [
  ...(fields.uploads
    ? [
        {
          at: at('uploads'),
          because:
            'sends files that Spotlight keeps. An action sent from the network cannot read them. Please remove from: network, or remove uploads',
        },
      ]
    : []),
  ...(fields.auth.oauth2
    ? [
        {
          at: at('request', 'auth'),
          because:
            'cannot use an OAuth connection. An action sent from the network authenticates only with auth.secrets',
        },
      ]
    : []),
  ...fields.headers
    .filter((name) => name.toLowerCase() === 'host')
    .map((name) => ({
      at: at('request', 'headers', name),
      because:
        'is a Host header. Egress sends an action from the network to the host its URL names. Please remove the Host header',
    })),
  ...(fields.auth.secrets && /^http:/i.test(fields.url)
    ? [
        {
          at: at('request', 'url'),
          because:
            'is an http address. Egress injects secrets only into https requests. Please use an https address',
        },
      ]
    : []),
];

const uploadProblems = (fields: ActionFields): ActionProblem[] =>
  fields.uploads?.sendsBody
    ? [
        {
          at: at('uploads', 'send', 'body'),
          because:
            'is the body of the request that sends a file. Spotlight sends the bytes of the file as the body. Please remove body',
        },
      ]
    : [];

export class Action {
  private constructor(
    readonly name: string,
    readonly fromNetwork: boolean,
    readonly uploads: boolean,
  ) {}

  static problemsOf(fields: ActionFields): readonly ActionProblem[] {
    return [
      ...uploadProblems(fields),
      ...(fields.fromNetwork
        ? fromNetworkProblems(fields)
        : fromSpotlightProblems(fields)),
    ];
  }

  static of(fields: ActionFields): Action {
    if (!isSlug(fields.name)) {
      throw new InvalidIntegrationPartError(
        `action ${JSON.stringify(fields.name)}`,
        'must be lowercase words joined by dashes, as in post-message',
      );
    }

    const [problem] = Action.problemsOf(fields);

    if (problem) {
      throw new InvalidActionError(problem.at, problem.because);
    }

    return new Action(fields.name, fields.fromNetwork, fields.uploads !== null);
  }

  equals(other: Action): boolean {
    return (
      this.name === other.name &&
      this.fromNetwork === other.fromNetwork &&
      this.uploads === other.uploads
    );
  }
}
