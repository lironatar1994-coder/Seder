import { describe, expect, it } from 'vitest';
import { captureReply, morningMessage, needsSecondOpinion, readCommand } from './reply';
import type { QuickAddResult } from '@/server/tasks/capture';

/** A capture result, with only the parts a test cares about spelled out. */
function result(understood: Partial<NonNullable<QuickAddResult['understood']>>, landedIn = 'תיבה נכנסת'): QuickAddResult {
  return {
    ok: true,
    id: 'task_1',
    landedIn,
    understood: {
      title: 'לקנות חלב',
      scheduledFor: null,
      scheduledTime: null,
      deadline: null,
      projectName: null,
      labelNames: [],
      priority: 4,
      recurrence: null,
      ...understood,
    },
  };
}

describe('captureReply', () => {
  it('names the task first — that is what the sender wants confirmed', () => {
    expect(captureReply(result({}))).toContain('נוספה: *לקנות חלב*');
  });

  it('says where an undated task went', () => {
    expect(captureReply(result({}))).toContain('נשמרה בתיבה נכנסת.');
  });

  it('reports the day and the time together', () => {
    const reply = captureReply(result({ scheduledFor: '2099-01-05', scheduledTime: '14:30' }));
    expect(reply).toMatch(/מתי: .*בשעה 14:30/);
  });

  it('does not also name the view once there is a date', () => {
    // "מתי" has already answered "where will I find this"; naming the view too
    // reads as two answers to one question.
    const reply = captureReply(result({ scheduledFor: '2099-01-05' }, 'בקרוב'));
    expect(reply).not.toContain('נשמרה ב');
  });

  it('keeps a deadline separate from a schedule', () => {
    const reply = captureReply(result({ scheduledFor: '2099-01-05', deadline: '2099-01-09' }));
    expect(reply).toContain('מתי:');
    expect(reply).toContain('דדליין:');
  });

  it('describes a repeat in words', () => {
    const reply = captureReply(result({ recurrence: 'daily:1' }));
    expect(reply).toMatch(/חוזר: .+/);
  });

  it('lists the project, the labels and a real priority', () => {
    const reply = captureReply(
      result({ projectName: 'עבודה', labelNames: ['טלפון', 'דחוף'], priority: 1 }),
    );
    expect(reply).toContain('פרויקט: עבודה');
    expect(reply).toContain('תוויות: טלפון, דחוף');
    expect(reply).toContain('עדיפות: דחוף');
  });

  it('says nothing about priority 4, which is the absence of one', () => {
    expect(captureReply(result({ priority: 4 }))).not.toContain('עדיפות');
  });
});

describe('needsSecondOpinion', () => {
  it('leaves a fully parsed message alone', () => {
    expect(needsSecondOpinion('לקנות חלב מחר', result({ scheduledFor: '2099-01-05' }))).toBe(false);
  });

  it('does not pay for a call when the message says nothing about time', () => {
    expect(needsSecondOpinion('לקנות חלב', result({}))).toBe(false);
  });

  it('asks again when the message is about time and the parser found none', () => {
    expect(needsSecondOpinion('לקנות חלב בשבוע הבא', result({}))).toBe(true);
    expect(needsSecondOpinion('להתקשר לרופא בעוד שלושה ימים', result({}))).toBe(true);
    expect(needsSecondOpinion('לאסוף את הילדים אחרי הצהריים', result({}))).toBe(true);
  });

  it('does not ask again when a time was found, however vague the wording', () => {
    expect(needsSecondOpinion('לקנות חלב בשבוע הבא', result({ scheduledFor: '2099-01-12' }))).toBe(
      false,
    );
  });

  it('asks again when nothing could be made of the message at all', () => {
    expect(needsSecondOpinion('???', { ok: false, error: 'לכל משימה צריך שם' })).toBe(true);
  });
});

describe('morningMessage', () => {
  it('says nothing when there is nothing', () => {
    expect(morningMessage([])).toBe('');
  });

  it('reads as a sentence for a single task, not a list of one', () => {
    expect(morningMessage(['לקנות חלב'])).toBe('היום: *לקנות חלב*');
  });

  it('counts and lists when there are several', () => {
    const message = morningMessage(['לקנות חלב', 'להתקשר לרופא', 'לאסוף חבילה']);
    expect(message).toContain('היום (3):');
    expect(message).toContain('• לקנות חלב');
    expect(message).toContain('• לאסוף חבילה');
  });

  it('stops before it becomes a wall, and says how many it held back', () => {
    const titles = Array.from({ length: 14 }, (_, i) => `משימה ${i + 1}`);
    const message = morningMessage(titles);

    expect(message).toContain('היום (14):');
    expect(message).toContain('• משימה 10');
    expect(message).not.toContain('• משימה 11');
    expect(message).toContain('ועוד 4.');
  });
});

describe('readCommand', () => {
  it('recognises the ways people ask for help', () => {
    expect(readCommand('עזרה')).toBe('help');
    expect(readCommand('  Help  ')).toBe('help');
    expect(readCommand('עזרה?')).toBe('help');
  });

  it('recognises an undo', () => {
    expect(readCommand('בטל')).toBe('undo');
    expect(readCommand('ביטול')).toBe('undo');
  });

  it('treats anything else as a task, including a sentence containing the word', () => {
    expect(readCommand('לבטל את הפגישה מחר')).toBeNull();
    expect(readCommand('לקנות חלב')).toBeNull();
  });
});
