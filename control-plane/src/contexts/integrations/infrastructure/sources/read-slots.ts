export class ReadSlots {
  private busy = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly most: number) {}

  async within<T>(
    deadline: number,
    late: () => Error,
    work: (left: number) => Promise<T>,
  ): Promise<T> {
    await this.taken(deadline, late);

    try {
      return await work(Math.max(deadline - Date.now(), 0));
    } finally {
      this.busy -= 1;
      this.waiting.shift()?.();
    }
  }

  private taken(deadline: number, late: () => Error): Promise<void> {
    if (this.busy < this.most) {
      this.busy += 1;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const turn = () => {
        clearTimeout(timer);
        this.busy += 1;
        resolve();
      };
      const timer = setTimeout(
        () => {
          this.waiting.splice(this.waiting.indexOf(turn), 1);
          reject(late());
        },
        Math.max(deadline - Date.now(), 0),
      );

      this.waiting.push(turn);
    });
  }
}
