import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorText, selectClass } from '@/features/org/org-forms';

/** Approve, or return with a note of at least 10 characters (the same rule as the API's DecisionDto). */
export function DecisionForm(props: {
  title: string;
  error: string | null;
  onCancel: () => void;
  onSubmit: (body: { decision: string; note?: string }) => Promise<unknown>;
}) {
  const [decision, setDecision] = useState<'APPROVE' | 'RETURN'>('APPROVE');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <form
      noValidate
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const text = note.trim();
        if (decision === 'RETURN' && text.length < 10) {
          return setProblem('Tulis catatan apa yang perlu diperbaiki (minimal 10 karakter).');
        }
        setProblem(null);
        void props.onSubmit({ decision, ...(text && { note: text }) });
      }}
    >
      <h2 className="font-bold">{props.title}</h2>
      <select
        aria-label="Keputusan"
        className={selectClass}
        value={decision}
        onChange={(e) => setDecision(e.target.value as 'APPROVE' | 'RETURN')}
      >
        <option value="APPROVE">Setujui</option>
        <option value="RETURN">Kembalikan untuk revisi</option>
      </select>
      <textarea
        aria-label="Catatan"
        rows={3}
        className={selectClass + ' h-auto py-2'}
        placeholder={
          decision === 'RETURN' ? 'Wajib: apa yang perlu diperbaiki' : 'Catatan (opsional)'
        }
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <ErrorText>{problem ?? props.error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit">Kirim</Button>
        <Button type="button" variant="outline" onClick={props.onCancel}>
          Batal
        </Button>
      </div>
    </form>
  );
}
