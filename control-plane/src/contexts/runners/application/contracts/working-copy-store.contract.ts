// Where the hosts of a pull pool or trust keep the working copies of runs, as other contexts read it.
export interface WorkingCopyStoreContract {
  readonly store: string;
  readonly base: string | null;
}
