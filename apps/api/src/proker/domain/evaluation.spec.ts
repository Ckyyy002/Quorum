import { wibDay } from '../../common/wib';
import { evaluationTooEarly } from './evaluation';

describe('evaluationTooEarly', () => {
  const event = wibDay('2026-12-10');

  it('opens at 00:00 WIB on the event day', () => {
    expect(evaluationTooEarly(event, new Date('2026-12-09T16:59:59Z'))).toBe(true);
    expect(evaluationTooEarly(event, new Date('2026-12-09T17:00:00Z'))).toBe(false);
    expect(evaluationTooEarly(event, new Date('2026-12-20T00:00:00Z'))).toBe(false);
  });

  it('stays closed while the proker has no event date', () => {
    expect(evaluationTooEarly(null, new Date())).toBe(true);
  });
});
