import { wibDay } from '../../common/wib';
import { compareTrackerRows, trackerRow } from './tracker';

const now = new Date('2026-12-05T03:00:00Z'); // 5 Dec 2026, 10:00 WIB

describe('trackerRow', () => {
  it('shows both stages, the earliest open deadline and a late flag', () => {
    // Arrange: SUBMIT was due 2 Dec and is still open, so it is late and comes first.
    const proker = {
      eventDate: wibDay('2026-12-20'),
      documents: [
        {
          id: 'p',
          type: 'PROPOSAL' as const,
          status: 'DRAFT' as const,
          deadlines: [
            {
              step: 'KAPRODI_DISCUSSION',
              dueDate: wibDay('2026-11-29'),
              doneAt: wibDay('2026-11-28'),
            },
            { step: 'SUBMIT', dueDate: wibDay('2026-12-02'), doneAt: null },
            { step: 'PENGESAHAN', dueDate: wibDay('2026-12-05'), doneAt: null },
          ],
        },
      ],
    };

    // Act
    const row = trackerRow(proker, now);

    // Assert
    expect(row).toEqual({
      proposal: { id: 'p', status: 'DRAFT' },
      lpj: null,
      nextDeadline: { step: 'SUBMIT', dueDate: wibDay('2026-12-02') },
      late: true,
    });
  });

  it('has no deadline and is not late for a proker without documents', () => {
    expect(trackerRow({ eventDate: null, documents: [] }, now)).toEqual({
      proposal: null,
      lpj: null,
      nextDeadline: null,
      late: false,
    });
  });
});

describe('compareTrackerRows', () => {
  const row = (due: string | null, event: string | null) => ({
    proposal: null,
    lpj: null,
    late: false,
    nextDeadline: due ? { step: 'SUBMIT', dueDate: wibDay(due) } : null,
    eventDate: event ? wibDay(event) : null,
  });

  it('sorts by nearest open deadline, then event day, with blanks last', () => {
    const rows = [
      row(null, '2026-12-10'),
      row('2026-12-08', '2026-12-30'),
      row(null, null),
      row('2026-12-03', '2026-12-25'),
    ];

    const sorted = [...rows].sort(compareTrackerRows);

    expect(sorted).toEqual([rows[3], rows[1], rows[0], rows[2]]);
  });
});
