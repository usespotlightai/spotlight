/** What a memory session shows on the Runners page. It is for no one run, so it opens none. */
interface MemorySessionTitle {
  readonly title: string;
  readonly opens: boolean;
}

export const MemorySessionTitles = {
  duplicateCheck: {
    title: 'Checking proposed memories',
    opens: false,
  } satisfies MemorySessionTitle,

  upkeep: {
    title: 'Running memory upkeep',
    opens: false,
  } satisfies MemorySessionTitle,
};
