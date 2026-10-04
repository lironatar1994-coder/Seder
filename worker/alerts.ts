/**
 * Telling somebody when WhatsApp stops working.
 *
 * The failure that matters is silent by construction: WhatsApp logs the number
 * out, inbound capture stops, and nothing anywhere raises its hand. The status
 * page answers the question if you think to ask it, which is precisely what
 * nobody does on the day it breaks.
 *
 * Two rules make this bearable rather than noisy:
 *
 *   - An alert fires **once** per condition, not once per check. The socket
 *     reconnects on its own several times an hour; one email per drop would
 *     train you to filter the address.
 *   - Recovery is announced too. An alert with no all-clear leaves you unable
 *     to tell "still broken" from "nobody told me it was fixed".
 *
 * The sender is injected so the policy can be tested without a mail server —
 * the logic worth testing is *when* it sends, which is the part that decides
 * between a useful signal and an ignored one.
 */

export interface AlertMessage {
  subject: string;
  text: string;
}

export interface AlertsOptions {
  /** Re-raise a condition that is still active after this long. */
  repeatAfterMs?: number;
  now?: () => number;
}

export class Alerts {
  private readonly active = new Map<string, number>();
  private readonly repeatAfterMs: number;
  private readonly now: () => number;

  constructor(
    private readonly deliver: (message: AlertMessage) => Promise<void>,
    options: AlertsOptions = {},
  ) {
    // Six hours: long enough not to nag, short enough that an outage running
    // into a second working day says so again.
    this.repeatAfterMs = options.repeatAfterMs ?? 6 * 60 * 60 * 1000;
    this.now = options.now ?? Date.now;
  }

  /** True when the condition is currently considered broken. */
  isActive(kind: string): boolean {
    return this.active.has(kind);
  }

  /** Report a condition. Sends on the first report, then only on repeat. */
  async raise(kind: string, message: AlertMessage): Promise<boolean> {
    const at = this.now();
    const since = this.active.get(kind);

    if (since !== undefined && at - since < this.repeatAfterMs) return false;

    this.active.set(kind, at);
    await this.deliver(message).catch((error) =>
      console.error('[whatsapp] could not send the alert:', (error as Error).message),
    );
    return true;
  }

  /** Report a condition fixed. Silent unless it had been raised. */
  async resolve(kind: string, message: AlertMessage): Promise<boolean> {
    if (!this.active.delete(kind)) return false;

    await this.deliver(message).catch((error) =>
      console.error('[whatsapp] could not send the all-clear:', (error as Error).message),
    );
    return true;
  }
}
