import { dayHasPassed, wibDay } from '../../common/wib';
import { canMoveTask, isTaskOverdue } from './task-rules';

describe('canMoveTask', () => {
  it('allows TODO → IN_PROGRESS → DONE', () => {
    expect(canMoveTask('TODO', 'IN_PROGRESS')).toBe(true);
    expect(canMoveTask('IN_PROGRESS', 'DONE')).toBe(true);
  });

  it('allows reopening DONE → IN_PROGRESS', () => {
    expect(canMoveTask('DONE', 'IN_PROGRESS')).toBe(true);
  });

  it('rejects skipping a step and moving backwards to TODO', () => {
    expect(canMoveTask('TODO', 'DONE')).toBe(false);
    expect(canMoveTask('DONE', 'TODO')).toBe(false);
    expect(canMoveTask('IN_PROGRESS', 'TODO')).toBe(false);
  });

  it('rejects staying in the same status', () => {
    expect(canMoveTask('TODO', 'TODO')).toBe(false);
  });
});

describe('deadlines in WIB', () => {
  const deadline = wibDay('2026-12-10');

  it('keeps the deadline day open until midnight WIB', () => {
    // 23:59 WIB on the deadline day is 16:59 UTC.
    expect(dayHasPassed(deadline, new Date('2026-12-10T16:59:00Z'))).toBe(false);
    expect(dayHasPassed(deadline, new Date('2026-12-10T17:00:00Z'))).toBe(true);
  });

  it('flags an open task after its deadline day', () => {
    const now = new Date('2026-12-11T01:00:00Z');

    expect(isTaskOverdue({ status: 'IN_PROGRESS', deadline }, now)).toBe(true);
    expect(isTaskOverdue({ status: 'TODO', deadline }, now)).toBe(true);
  });

  it('never flags a DONE task or a task without a deadline', () => {
    const now = new Date('2026-12-20T00:00:00Z');

    expect(isTaskOverdue({ status: 'DONE', deadline }, now)).toBe(false);
    expect(isTaskOverdue({ status: 'TODO', deadline: null }, now)).toBe(false);
  });
});
