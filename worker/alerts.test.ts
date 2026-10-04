import { describe, expect, it } from 'vitest';
import { Alerts, type AlertMessage } from './alerts';

function collector() {
  const sent: AlertMessage[] = [];
  return { sent, deliver: async (message: AlertMessage) => void sent.push(message) };
}

const say = (subject: string): AlertMessage => ({ subject, text: subject });

describe('Alerts', () => {
  it('sends the first report of a problem', async () => {
    const { sent, deliver } = collector();
    const alerts = new Alerts(deliver);

    await expect(alerts.raise('offline', say('down'))).resolves.toBe(true);
    expect(sent).toHaveLength(1);
  });

  it('stays quiet while the same problem persists', async () => {
    // The socket drops and reconnects several times an hour on its own. One
    // email per drop is how an alert address gets filtered into oblivion.
    const { sent, deliver } = collector();
    const alerts = new Alerts(deliver);

    await alerts.raise('offline', say('down'));
    await alerts.raise('offline', say('down'));
    await alerts.raise('offline', say('down'));

    expect(sent).toHaveLength(1);
  });

  it('says so again if it is still broken much later', async () => {
    let t = 0;
    const { sent, deliver } = collector();
    const alerts = new Alerts(deliver, { repeatAfterMs: 6 * 60 * 60 * 1000, now: () => t });

    await alerts.raise('offline', say('down'));
    t += 5 * 60 * 60 * 1000;
    await alerts.raise('offline', say('still down'));
    expect(sent).toHaveLength(1);

    t += 2 * 60 * 60 * 1000;
    await alerts.raise('offline', say('still down'));
    expect(sent).toHaveLength(2);
  });

  it('announces recovery, but only if it had complained', async () => {
    const { sent, deliver } = collector();
    const alerts = new Alerts(deliver);

    // Nothing was wrong, so there is nothing to be relieved about.
    await expect(alerts.resolve('offline', say('back'))).resolves.toBe(false);
    expect(sent).toHaveLength(0);

    await alerts.raise('offline', say('down'));
    await expect(alerts.resolve('offline', say('back'))).resolves.toBe(true);
    expect(sent.map((m) => m.subject)).toEqual(['down', 'back']);
  });

  it('complains again after a recovery, because it is a new outage', async () => {
    const { sent, deliver } = collector();
    const alerts = new Alerts(deliver);

    await alerts.raise('offline', say('down'));
    await alerts.resolve('offline', say('back'));
    await alerts.raise('offline', say('down again'));

    expect(sent).toHaveLength(3);
  });

  it('tracks conditions separately', async () => {
    const { sent, deliver } = collector();
    const alerts = new Alerts(deliver);

    await alerts.raise('offline', say('down'));
    await alerts.raise('logged-out', say('needs a scan'));

    expect(sent).toHaveLength(2);
    expect(alerts.isActive('offline')).toBe(true);
    expect(alerts.isActive('logged-out')).toBe(true);

    await alerts.resolve('offline', say('back'));
    expect(alerts.isActive('offline')).toBe(false);
    expect(alerts.isActive('logged-out')).toBe(true);
  });

  it('treats a failing mail server as not worth crashing over', async () => {
    const alerts = new Alerts(async () => {
      throw new Error('smtp refused');
    });

    // The condition is still recorded — losing the alert must not also mean
    // re-alerting on every subsequent check.
    await expect(alerts.raise('offline', say('down'))).resolves.toBe(true);
    expect(alerts.isActive('offline')).toBe(true);
  });
});
