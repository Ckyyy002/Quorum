import { render } from './templates';

describe('render', () => {
  it('fills the subject and wraps the body in the layout with a link', () => {
    const mail = render('taskAssigned', {
      name: 'Rani',
      link: 'http://localhost:5173/tugas',
      title: 'Kirim surat',
      deadline: '14 Des 2026',
    });

    expect(mail.subject).toBe('Tugas baru: Kirim surat');
    expect(mail.html).toContain('Halo Rani');
    expect(mail.html).toContain('tenggat <b>14 Des 2026</b>');
    expect(mail.html).toContain('href="http://localhost:5173/tugas"');
  });

  it('escapes text members typed, so it cannot inject HTML', () => {
    const mail = render('committeeAdded', {
      name: 'Rani',
      link: 'http://x',
      proker: '<script>alert(1)</script>',
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('lists the agenda of a meeting invitation', () => {
    const mail = render('meeting', {
      name: 'Rani',
      link: 'http://x',
      headline: 'Undangan rapat',
      title: 'Rapat biro',
      when: '12 Des 2026, 19.00',
      durationMin: 90,
      location: 'Ruang HMTC',
      agenda: [{ topic: 'Evaluasi', expectedOutput: 'Daftar perbaikan' }],
    });

    expect(mail.subject).toBe('Undangan rapat: Rapat biro');
    expect(mail.html).toContain('<li>Evaluasi — output: Daftar perbaikan</li>');
  });
});
