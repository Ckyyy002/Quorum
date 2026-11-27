import Handlebars from 'handlebars';

/**
 * Email texts. Handlebars escapes every `{{value}}`, so a proker name or meeting note typed by a member
 * cannot inject HTML into someone else's inbox. Kept as strings next to the code (not .hbs files) so the
 * build needs no asset copying.
 */
const LAYOUT = Handlebars.compile(`<!doctype html>
<html lang="id"><body style="font-family:Arial,sans-serif;color:#1f2937;max-width:560px;margin:auto">
  <p style="font-weight:bold;color:#0b3a5b">Quorum · HMTC ITS</p>
  <p>Halo {{name}},</p>
  {{{body}}}
  <p><a href="{{link}}" style="background:#0b3a5b;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">Buka di Quorum</a></p>
  <p style="font-size:12px;color:#6b7280">Email otomatis dari Quorum. Jangan dibalas.</p>
</body></html>`);

interface Message {
  subject: string;
  body: string;
}

const MESSAGES = {
  prokerPic: {
    subject: 'Kamu menjadi PIC proker {{proker}}',
    body: '<p>Kamu ditunjuk sebagai PIC (Ketua Pelaksana) proker <b>{{proker}}</b> di {{department}}.</p>',
  },
  prokerBiro: {
    subject: 'Proker baru untuk {{biro}}: {{proker}}',
    body: '<p>Proker <b>{{proker}}</b> dibuat dan dieksekusi oleh {{biro}}.</p>',
  },
  committeeAdded: {
    subject: 'Kamu masuk kepanitiaan {{proker}}',
    body: '<p>Kamu ditambahkan ke kepanitiaan proker <b>{{proker}}</b>.</p>',
  },
  taskAssigned: {
    subject: 'Tugas baru: {{title}}',
    body: '<p>Kamu mendapat tugas <b>{{title}}</b>{{#if source}} dari {{source}}{{/if}}, tenggat <b>{{deadline}}</b>.</p>',
  },
  documentStep: {
    subject: '{{type}} {{title}}: {{headline}}',
    body: `<p>{{type}} <b>{{title}}</b> (proker {{proker}}): {{headline}}.</p>
{{#if note}}<p>Catatan: {{note}}</p>{{/if}}`,
  },
  meeting: {
    subject: '{{headline}}: {{title}}',
    body: `<p>{{headline}}: <b>{{title}}</b></p>
<p>{{when}} WIB · {{durationMin}} menit · {{location}}</p>
{{#if urgentReason}}<p>Mendesak: {{urgentReason}}</p>{{/if}}
{{#if agenda.length}}<p>Agenda:</p><ol>{{#each agenda}}<li>{{topic}} — output: {{expectedOutput}}{{#if materials}} (bahan: {{materials}}){{/if}}</li>{{/each}}</ol>{{/if}}`,
  },
  minutes: {
    subject: 'Notulen {{title}}',
    body: `<p>Notulen rapat <b>{{title}}</b> sudah terbit.</p>
<p>{{summary}}</p>
{{#if decisions.length}}<p>Keputusan:</p><ul>{{#each decisions}}<li>{{text}}</li>{{/each}}</ul>{{/if}}`,
  },
} satisfies Record<string, Message>;

export type MessageKind = keyof typeof MESSAGES;

const compiled = Object.fromEntries(
  Object.entries(MESSAGES).map(([kind, m]) => [
    kind,
    // A subject is plain text, not HTML, so it is not escaped.
    {
      subject: Handlebars.compile(m.subject, { noEscape: true }),
      body: Handlebars.compile(m.body),
    },
  ]),
) as Record<MessageKind, { subject: HandlebarsTemplateDelegate; body: HandlebarsTemplateDelegate }>;

/** Subject and HTML for one recipient. */
export function render(
  kind: MessageKind,
  data: Record<string, unknown> & { name: string; link: string },
): { subject: string; html: string } {
  const t = compiled[kind];
  return {
    subject: t.subject(data),
    html: LAYOUT({ ...data, body: t.body(data) }),
  };
}
