import { describe, expect, it } from 'vitest';
import { DailyCapReached, SendQueue } from './queue';

/** A clock the test drives: `sleep` jumps it forward instead of waiting. */
function fakeClock() {
  let t = 1_000_000;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('SendQueue', () => {
  it('sends the first message without waiting', async () => {
    const clock = fakeClock();
    const queue = new SendQueue({ ...clock, random: () => 0.5 });

    const before = clock.now();
    await queue.run(async () => 'sent');
    expect(clock.now()).toBe(before);
  });

  it('spaces the ones after it', async () => {
    const clock = fakeClock();
    const queue = new SendQueue({
      ...clock,
      minGapMs: 3_000,
      maxGapMs: 8_000,
      random: () => 0.5, // midpoint: 5500ms
    });

    await queue.run(async () => 1);
    const after = clock.now();
    await queue.run(async () => 2);

    expect(clock.now() - after).toBe(5_500);
  });

  it('varies the gap rather than ticking like a metronome', async () => {
    const clock = fakeClock();
    const draws = [0, 1];
    const queue = new SendQueue({
      ...clock,
      minGapMs: 3_000,
      maxGapMs: 8_000,
      random: () => draws.shift() ?? 0.5,
    });

    await queue.run(async () => 1);
    const first = clock.now();
    await queue.run(async () => 2);
    const second = clock.now();
    await queue.run(async () => 3);

    expect(second - first).toBe(3_000);
    expect(clock.now() - second).toBe(8_000);
  });

  it('runs one at a time even when everything is queued at once', async () => {
    const clock = fakeClock();
    const queue = new SendQueue({ ...clock, minGapMs: 1_000, maxGapMs: 1_000 });

    const order: number[] = [];
    let live = 0;
    let peak = 0;

    await Promise.all(
      [1, 2, 3].map((n) =>
        queue.run(async () => {
          live += 1;
          peak = Math.max(peak, live);
          order.push(n);
          live -= 1;
        }),
      ),
    );

    expect(peak).toBe(1);
    expect(order).toEqual([1, 2, 3]);
  });

  it('keeps going after one send throws', async () => {
    const clock = fakeClock();
    const queue = new SendQueue({ ...clock, minGapMs: 0, maxGapMs: 0 });

    const failure = queue.run(async () => {
      throw new Error('recipient unreachable');
    });
    const after = queue.run(async () => 'still here');

    await expect(failure).rejects.toThrow('recipient unreachable');
    await expect(after).resolves.toBe('still here');
  });

  it('refuses past the daily cap', async () => {
    const clock = fakeClock();
    const queue = new SendQueue({ ...clock, minGapMs: 0, maxGapMs: 0, dailyCap: 2 });

    await queue.run(async () => 1);
    await queue.run(async () => 2);

    await expect(queue.run(async () => 3)).rejects.toBeInstanceOf(DailyCapReached);
    expect(queue.recentCount).toBe(2);
  });

  it('lets the cap roll off after a day', async () => {
    const clock = fakeClock();
    const queue = new SendQueue({ ...clock, minGapMs: 0, maxGapMs: 0, dailyCap: 1 });

    await queue.run(async () => 1);
    await expect(queue.run(async () => 2)).rejects.toBeInstanceOf(DailyCapReached);

    clock.advance(24 * 60 * 60 * 1000 + 1);
    await expect(queue.run(async () => 3)).resolves.toBe(3);
    expect(queue.recentCount).toBe(1);
  });

  it('counts a failed attempt against the cap', async () => {
    const clock = fakeClock();
    const queue = new SendQueue({ ...clock, minGapMs: 0, maxGapMs: 0, dailyCap: 1 });

    await queue.run(async () => {
      throw new Error('blocked');
    }).catch(() => {});

    // WhatsApp saw that traffic whether or not it landed.
    await expect(queue.run(async () => 'next')).rejects.toBeInstanceOf(DailyCapReached);
  });
});
