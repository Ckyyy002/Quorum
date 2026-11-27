import { CalendarDays, FileText, ListTodo, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { TYPE_LABEL as DOCUMENT_TYPE_LABEL } from '@/features/document/document-api';
import { DocumentStatusBadge } from '@/features/document/document-section';
import { MEETING_TYPE_LABEL } from '@/features/meeting/meeting-api';
import { ErrorText } from '@/features/org/org-forms';
import { POSITION_LABEL, type Position } from '@/features/org/positions';
import { formatDateTime, formatDay, formatRupiah, STATUS_LABEL } from '@/features/proker/labels';
import type { ProkerStatus } from '@/features/proker/proker-api';
import { ProkerTable } from '@/features/proker/progress-table';
import { cn } from '@/lib/utils';
import {
  NEXT_STEP_LABEL,
  useBudgetDashboard,
  useDepartmentDashboard,
  useMyDashboard,
  useOrganizationDashboard,
  type BudgetTotals,
  type ProkerSummary,
  type Rate,
} from './dashboard-api';

// Same groups as the API rules `dashboard:organization` and `dashboard:budget` (policy.ts).
const ORGANIZATION_GROUPS = ['KETUA', 'SEKJEN_BIDANG', 'SEKJEN_ADM', 'SEKJEN_KEU'];
const BUDGET_GROUPS = ['KETUA', 'SEKJEN_KEU'];

const monthName = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso));

/** US-9: what needs me first, then the dashboards my position may see. */
export function HomePage() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  const { user } = state;
  const m = user.membership;
  const group = m?.roleGroup ?? '';
  const unit = m?.biro?.name ?? m?.department?.name ?? m?.kesekjenan?.name;

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Halo, {user.name}</h1>
        <p className="text-muted-foreground">
          {m
            ? `${POSITION_LABEL[m.position as Position]}${unit ? ` · ${unit}` : ''} · Periode ${m.period.name}`
            : user.isAdmin
              ? 'Kamu masuk sebagai Admin Sistem. Mulai dari menu Struktur organisasi.'
              : 'Kamu belum punya jabatan di periode aktif. Hubungi Admin Sistem.'}
        </p>
      </div>
      {m && <Inbox />}
      {group === 'DEPT_LEAD' && m?.department && <DepartmentSection id={m.department.id} />}
      {(user.isAdmin || ORGANIZATION_GROUPS.includes(group)) && <OrganizationSection />}
      {(user.isAdmin || BUDGET_GROUPS.includes(group)) && <BudgetSection />}
    </section>
  );
}

function Section(props: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-bold">{props.title}</h2>
        {props.subtitle && <p className="text-sm text-muted-foreground">{props.subtitle}</p>}
      </div>
      {props.children}
    </div>
  );
}

function Card(props: { icon: LucideIcon; title: string; to: string; children: ReactNode }) {
  const Icon = props.icon;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <Link to={props.to} className="flex items-center gap-2 font-bold hover:underline">
        <Icon className="size-4 text-primary" aria-hidden="true" /> {props.title}
      </Link>
      {props.children}
    </div>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

/** "Perlu tindakanmu": documents waiting for my step, my tasks and my next meetings. */
function Inbox() {
  const me = useMyDashboard();
  if (me.isError) return <ErrorText>Ringkasan tidak bisa dimuat. Muat ulang halaman.</ErrorText>;
  if (!me.data) return <Empty>Memuat…</Empty>;
  const { documents, tasks, meetings } = me.data;

  return (
    <Section title="Perlu tindakanmu">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card icon={FileText} title={`Dokumen (${documents.length})`} to="/dokumen">
          {documents.length === 0 ? (
            <Empty>Tidak ada dokumen yang menunggu langkahmu.</Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {documents.map((d) => (
                <li key={d.id}>
                  <Link to={`/dokumen/${d.id}`} className="flex flex-col hover:underline">
                    <span className="text-sm font-semibold">{d.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {DOCUMENT_TYPE_LABEL[d.type]} · {d.proker.name} ·{' '}
                      <span className="font-semibold text-primary">{NEXT_STEP_LABEL[d.step]}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card icon={ListTodo} title={`Tugas terbuka (${tasks.open})`} to="/tugas">
          {tasks.overdue > 0 && (
            <p className="text-sm font-semibold text-late-foreground">
              {tasks.overdue} lewat tenggat
            </p>
          )}
          {tasks.next.length === 0 ? (
            <Empty>Tidak ada tugas terbuka.</Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.next.map((t) => (
                <li key={t.id} className="flex flex-col">
                  <span className="text-sm font-semibold">{t.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.proker?.name ?? 'Tindak lanjut rapat'} · Tenggat {formatDay(t.deadline)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card icon={CalendarDays} title="Rapat berikutnya" to="/rapat">
          {meetings.length === 0 ? (
            <Empty>Belum ada rapat terjadwal.</Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {meetings.map((mt) => (
                <li key={mt.id}>
                  <Link to={`/rapat/${mt.id}`} className="flex flex-col hover:underline">
                    <span className="text-sm font-semibold">{mt.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {MEETING_TYPE_LABEL[mt.type]} · {formatDateTime(mt.startsAt)} WIB ·{' '}
                      {mt.location}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Section>
  );
}

/** `n proker · 2 berjalan · 1 selesai` and checklist completion as a bar. */
function ProkerCell({ summary }: { summary: ProkerSummary }) {
  if (summary.total === 0) return <span className="text-muted-foreground">Belum ada</span>;
  const pct = summary.checklistTotal
    ? Math.round((summary.checklistDone / summary.checklistTotal) * 100)
    : null;
  return (
    <div className="flex min-w-40 flex-col gap-1">
      <span>
        {summary.total} proker ·{' '}
        {Object.entries(summary.byStatus)
          .map(([s, n]) => `${n} ${STATUS_LABEL[s as ProkerStatus].toLowerCase()}`)
          .join(' · ')}
      </span>
      {pct !== null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-1.5 w-24 rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-chart-1" style={{ width: `${pct}%` }} />
          </div>
          checklist {pct}%
        </div>
      )}
    </div>
  );
}

function RateCell({ rate }: { rate: Rate | null }) {
  if (!rate || rate.percent === null) return <span className="text-muted-foreground">-</span>;
  return (
    <span
      className={cn('font-semibold', rate.percent < 60 && 'text-late-foreground')}
      title={`${rate.present} hadir · ${rate.excused} izin dari ${rate.invited} undangan`}
    >
      {rate.percent}%
      <span className="ml-1 text-xs font-normal text-muted-foreground">
        ({rate.present}/{rate.invited}
        {rate.excused > 0 && ` · ${rate.excused} izin`})
      </span>
    </span>
  );
}

const th = 'px-4 py-2 text-left text-xs font-semibold text-muted-foreground';
const td = 'px-4 py-2.5 align-top';

/** US-9.1: per kesekjenan and department. */
function OrganizationSection() {
  const org = useOrganizationDashboard();
  if (org.isError) return <ErrorText>Dashboard organisasi tidak bisa dimuat.</ErrorText>;
  if (!org.data) return null;
  return (
    <Section
      title="Organisasi"
      subtitle={`Proker, dokumen terlambat, dan kehadiran rapat ${monthName(org.data.monthStart)}`}
    >
      {org.data.kesekjenan.map((k) => (
        <div key={k.id} className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="px-4 pt-3 text-left font-bold">{k.name}</caption>
            <thead>
              <tr>
                <th className={th}>Departemen</th>
                <th className={th}>Proker</th>
                <th className={th}>Dokumen terlambat</th>
                <th className={th}>Kehadiran rapat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {k.departments.map((d) => (
                <tr key={d.id}>
                  <td className={cn(td, 'font-semibold')}>{d.name}</td>
                  <td className={td}>
                    <ProkerCell summary={d.prokers} />
                  </td>
                  <td
                    className={cn(td, d.lateDocuments > 0 && 'font-semibold text-late-foreground')}
                  >
                    {d.lateDocuments}
                  </td>
                  <td className={td}>
                    <RateCell rate={d.attendance} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Section>
  );
}

/** US-9.2: proker per biro, late documents, overdue tasks and attendance per member. */
function DepartmentSection({ id }: { id: string }) {
  const dept = useDepartmentDashboard(id);
  if (dept.isError) return <ErrorText>Dashboard departemen tidak bisa dimuat.</ErrorText>;
  if (!dept.data) return null;
  const d = dept.data;
  return (
    <Section title={`Departemen ${d.name}`} subtitle={`Kehadiran rapat ${monthName(d.monthStart)}`}>
      {d.biros.map((b) => (
        <div key={b.id ?? 'none'} className="flex flex-col gap-2">
          <h3 className="font-bold">
            {b.name}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              · {b.summary.checklistDone}/{b.summary.checklistTotal} checklist
            </span>
          </h3>
          <ProkerTable prokers={b.prokers} />
        </div>
      ))}

      {d.lateDocuments.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-bold">Dokumen terlambat</h3>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {d.lateDocuments.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <Link to={`/dokumen/${doc.id}`} className="text-sm font-semibold hover:underline">
                  {doc.title}
                  <span className="ml-2 font-normal text-muted-foreground">{doc.proker.name}</span>
                </Link>
                <DocumentStatusBadge status={doc.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <caption className="px-4 pt-3 text-left font-bold">Anggota</caption>
          <thead>
            <tr>
              <th className={th}>Nama</th>
              <th className={th}>Tugas lewat tenggat</th>
              <th className={th}>Kehadiran rapat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {d.members.map((m) => (
              <tr key={m.id}>
                <td className={td}>
                  <span className="font-semibold">{m.user.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {POSITION_LABEL[m.position as Position]}
                  </span>
                </td>
                <td className={cn(td, m.overdueTasks > 0 && 'font-semibold text-late-foreground')}>
                  {m.overdueTasks}
                </td>
                <td className={td}>
                  <RateCell rate={m.attendance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  PAGU_DEPARTEMEN: 'Pagu dept.',
  KAS_HMTC: 'Kas HMTC',
  MANDIRI: 'Mandiri',
  NONE: 'Tanpa sumber',
};

function Money({ totals, of }: { totals: BudgetTotals; of: 'proposal' | 'lpj' }) {
  const sum = of === 'proposal' ? totals.proposalTotal : totals.lpjTotal;
  const parts = Object.entries(totals[of]);
  return (
    <div className="flex flex-col">
      <span className="font-semibold">{formatRupiah(sum)}</span>
      {parts.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {parts
            .map(([source, n]) => `${SOURCE_LABEL[source] ?? source} ${formatRupiah(n)}`)
            .join(' · ')}
        </span>
      )}
    </div>
  );
}

/** US-9.3: approved proposal budgets vs LPJ realized, by funding source. */
function BudgetSection() {
  const budget = useBudgetDashboard();
  if (budget.isError) return <ErrorText>Ringkasan anggaran tidak bisa dimuat.</ErrorText>;
  if (!budget.data) return null;
  const b = budget.data;
  return (
    <Section
      title="Anggaran"
      subtitle="Proposal yang sudah disahkan dibanding realisasi LPJ (disahkan atau lebih lanjut)"
    >
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={th}>Unit</th>
              <th className={th}>Proposal disahkan</th>
              <th className={th}>Realisasi LPJ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {b.kesekjenan.flatMap((k) => [
              <tr key={k.id} className="bg-muted/40">
                <td className={cn(td, 'font-bold')}>{k.name}</td>
                <td className={td}>
                  <Money totals={k.totals} of="proposal" />
                </td>
                <td className={td}>
                  <Money totals={k.totals} of="lpj" />
                </td>
              </tr>,
              ...k.departments.map((d) => (
                <tr key={d.id}>
                  <td className={cn(td, 'pl-8')}>{d.name}</td>
                  <td className={td}>
                    <Money totals={d.totals} of="proposal" />
                  </td>
                  <td className={td}>
                    <Money totals={d.totals} of="lpj" />
                  </td>
                </tr>
              )),
            ])}
            <tr className="font-bold">
              <td className={td}>Total</td>
              <td className={td}>
                <Money totals={b.total} of="proposal" />
              </td>
              <td className={td}>
                <Money totals={b.total} of="lpj" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  );
}
