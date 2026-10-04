/**
 * Paced, serialised outbound sending.
 *
 * WhatsApp here is an unofficial client on a real phone number, and the fastest
 * way to lose that number is to behave like software: fifty messages in a
 * burst, evenly spaced to the millisecond. Every send goes through this — one
 * at a time, with an irregular human-ish pause between them, under a hard
 * ceiling for the day.
 *
 * The clock and the randomness are injected so the pacing can actually be
 * tested rather than asserted about.
 */

export class DailyCapReached extends Error {
  constructor(cap: number) {
    super(`daily send cap of ${cap} reached`);
    this.name = 'DailyCapReached';
  }
}

export interface QueueOptions {
  /** Shortest pause between two sends, ms. */
  minGapMs?: number;
  /** Longest pause between two sends, ms. */
  maxGapMs?: number;
  /** Ceiling for any rolling 24-hour window. */
  dailyCap?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class SendQueue {
  private chain: Promise<unknown> = Promise.resolve();
  /** Timestamps of attempts, newest last, pruned to the last 24 hours. */
  private attempts: number[] = [];
  private lastAt = 0;

  private readonly minGapMs: number;
  private readonly maxGapMs: number;
  private readonly dailyCap: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(options: QueueOptions = {}) {
    this.minGapMs = options.minGapMs ?? 3_000;
    this.maxGapMs = options.maxGapMs ?? 8_000;
    this.dailyCap = options.dailyCap ?? 200;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
  }

  /** Attempts in the last 24 hours. */
  get recentCount(): number {
    this.prune();
    return this.attempts.length;
  }

  /**
   * Queue a send. Resolves with the job's value, rejects with whatever the job
   * threw — or with `DailyCapReached` before the job ever runs.
   */
  run<T>(job: () => Promise<T>): Promise<T> {
    const task = this.chain.then(async () => {
      await this.pace();
      return job();
    });

    // The chain must survive a failed send: without swallowing here, one
    // rejection would reject every message queued behind it.
    this.chain = task.then(
      () => undefined,
      () => undefined,
    );

    return task;
  }

  private prune(): void {
    const cutoff = this.now() - DAY_MS;
    while (this.attempts.length && this.attempts[0] <= cutoff) this.attempts.shift();
  }

  private async pace(): Promise<void> {
    this.prune();
    if (this.attempts.length >= this.dailyCap) throw new DailyCapReached(this.dailyCap);

    // Only draw when there is a gap to draw for. The first send has nothing to
    // space itself from, and consuming randomness it does not use would make
    // every later gap depend on how many sends came before.
    if (this.lastAt !== 0) {
      const gap = this.minGapMs + this.random() * (this.maxGapMs - this.minGapMs);
      const wait = this.lastAt + gap - this.now();
      if (wait > 0) await this.sleep(wait);
    }

    // Recorded on the attempt, not on success: WhatsApp saw the traffic either
    // way, and the cap exists to limit what WhatsApp sees.
    const at = this.now();
    this.lastAt = at;
    this.attempts.push(at);
  }
}
