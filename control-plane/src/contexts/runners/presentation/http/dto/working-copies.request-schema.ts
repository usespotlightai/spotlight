// The request schema of workingCopies, for the definitions of pull pools and trusts.
export const WORKING_COPIES_SCHEMA = {
  type: 'object' as const,
  nullable: true,
  required: ['store'],
  description:
    'Where the hosts keep the working copies of runs. Left out, Spotlight keeps them as archives in its own storage. Each host runs a working copy hook, the program that its working-copy-hook setting names, which opens each sandbox’s workspace from the store and saves each archive as a snapshot. Give every pool or trust that a line’s runs can go to the same store: a run on a host that reaches another store starts afresh',
  properties: {
    store: {
      type: 'string' as const,
      example: 's3://team-a',
      description:
        'The name of the store, which Spotlight does not read: any host whose pool or trust names the same store restores its working copies',
    },
    base: {
      type: 'string' as const,
      nullable: true,
      example: 'base-v1',
      description:
        'The snapshot a new working copy starts from. A run that starts no session of its own also starts from it when the last working copy descends from another base',
    },
  },
};
