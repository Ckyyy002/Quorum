import { wibDay } from '../../common/wib';
import { buildDeadlines, deadlineState, isLate, stepCompletedBy } from './deadlines';

describe('buildDeadlines', () => {
  it('counts H-21, H-18, H-15 and H-14 back from the event day', () => {
    // Arrange
    const event = wibDay('2026-12-30');

    // Act
    const deadlines = buildDeadlines(event);

    // Assert
    expect(deadlines).toEqual([
      { step: 'KAPRODI_DISCUSSION', dueDate: wibDay('2026-12-09') },
      { step: 'SUBMIT', dueDate: wibDay('2026-12-12') },
      { step: 'PENGESAHAN', dueDate: wibDay('2026-12-15') },
      { step: 'TO_KAPRODI', dueDate: wibDay('2026-12-16') },
    ]);
  });
});

describe('isLate / deadlineState', () => {
  const due = wibDay('2026-12-12');

  it('counts the whole due day (WIB) as on time', () => {
    expect(isLate(due, new Date('2026-12-12T16:59:00Z'))).toBe(false);
    expect(isLate(due, new Date('2026-12-12T17:00:00Z'))).toBe(true);
  });

  it('reports DONE, LATE or PENDING', () => {
    const before = new Date('2026-12-11T00:00:00Z');
    const after = new Date('2026-12-14T00:00:00Z');

    expect(deadlineState({ dueDate: due, doneAt: before }, after)).toBe('DONE');
    expect(deadlineState({ dueDate: due, doneAt: after }, after)).toBe('LATE');
    expect(deadlineState({ dueDate: due, doneAt: null }, before)).toBe('PENDING');
    expect(deadlineState({ dueDate: due, doneAt: null }, after)).toBe('LATE');
  });
});

describe('stepCompletedBy', () => {
  it('maps workflow actions to the deadline they complete', () => {
    expect(stepCompletedBy('SUBMIT')).toBe('SUBMIT');
    expect(stepCompletedBy('APPROVE')).toBe('PENGESAHAN');
    expect(stepCompletedBy('TO_KAPRODI')).toBe('TO_KAPRODI');
    expect(stepCompletedBy('APPROVE_ADMIN')).toBeUndefined();
  });
});
