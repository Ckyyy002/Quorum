import {
  Building2,
  ClipboardList,
  FileText,
  GanttChart,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Network,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import type { MyMembership } from '@/features/auth/auth-api';
import { useAuth } from '@/features/auth/auth-context';
import { POSITION_LABEL, type Position } from '@/features/org/positions';
import { cn } from '@/lib/utils';

/** Same groups as the API's `tracker:view` rule (apps/api/src/policy/domain/policy.ts). */
const TRACKER_GROUPS = ['KETUA', 'SEKJEN_BIDANG', 'SEKJEN_ADM', 'SEKJEN_KEU', 'DEPT_LEAD'];

const itemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-sm',
    // Yellow marks the active item only; it is never text on white (docs/design/README.md).
    isActive
      ? 'bg-brand-yellow font-bold text-foreground'
      : 'font-medium text-[#d6e6f2] hover:bg-white/10',
  );

function NavItem({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    // `end` only for "/": otherwise Dashboard would stay active everywhere, and Proker should stay
    // active on /proker/:id.
    <NavLink to={to} end={to === '/'} className={itemClass}>
      <Icon className="size-[18px]" aria-hidden="true" />
      {label}
    </NavLink>
  );
}

function NavGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="px-2.5 pb-1.5 text-[11px] font-bold tracking-[1.2px] text-[#9fc3dc]">
        {title}
      </span>
      {children}
    </div>
  );
}

/** The overview of the unit this member leads (US-2.7, 2.8, 3.5); staff and Ketua have none. */
function myUnit(m: MyMembership | null): { to: string; label: string } | null {
  if (m?.roleGroup === 'SEKJEN_BIDANG' && m.kesekjenan) {
    return { to: `/unit/kesekjenan/${m.kesekjenan.id}`, label: 'Kesekjenanku' };
  }
  if (m?.roleGroup === 'DEPT_LEAD' && m.department) {
    return { to: `/unit/departemen/${m.department.id}`, label: 'Departemenku' };
  }
  if (m?.roleGroup === 'BIRO_LEAD' && m.biro) {
    return { to: `/unit/biro/${m.biro.id}`, label: 'Biroku' };
  }
  return null;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/** Sidebar + header for every signed-in screen. Menus follow `/me` (US-2.6 AC2); the API still checks. */
export function AppShell() {
  const { state, logout } = useAuth();
  if (state.status !== 'authenticated') return null;
  const { user } = state;
  const position = user.membership?.position as Position | undefined;
  const unit = myUnit(user.membership);
  const subtitle = position
    ? POSITION_LABEL[position]
    : user.isAdmin
      ? 'Admin Sistem'
      : 'Belum ada jabatan';

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <nav
        aria-label="Menu utama"
        className="flex shrink-0 flex-col gap-6 bg-navy px-3.5 py-5 text-[#fdfaf0] md:sticky md:top-0 md:h-svh md:w-62"
      >
        <div className="flex items-center gap-2.5 px-2">
          <img src="/logo-on-dark.svg" alt="" className="size-9" />
          <div className="flex flex-col">
            <span className="text-base font-extrabold">Quorum</span>
            <span className="text-[11px] text-[#9fc3dc]">HMTC ITS</span>
          </div>
        </div>
        <NavGroup title="KERJA">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/proker" icon={ClipboardList} label="Proker" />
          {user.membership && <NavItem to="/tugas" icon={ListTodo} label="Tugasku" />}
          {(user.membership || user.isAdmin) && (
            <NavItem to="/dokumen" icon={FileText} label="Dokumen" />
          )}
          {(user.isAdmin || TRACKER_GROUPS.includes(user.membership?.roleGroup ?? '')) && (
            <NavItem to="/tracker" icon={GanttChart} label="Tracker" />
          )}
          {unit && <NavItem to={unit.to} icon={Building2} label={unit.label} />}
        </NavGroup>
        {user.isAdmin && (
          <NavGroup title="ADMIN">
            <NavItem to="/admin/struktur" icon={Network} label="Struktur organisasi" />
            <NavItem to="/admin/anggota" icon={Users} label="Anggota & jabatan" />
          </NavGroup>
        )}
        <div className="mt-auto border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => void logout()}
            className={itemClass({ isActive: false }) + ' w-full'}
          >
            <LogOut className="size-[18px]" aria-hidden="true" />
            Keluar
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-2.5 border-b border-border bg-card px-8 py-3.5">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-full bg-chart-1 text-[13px] font-bold text-white"
          >
            {initials(user.name)}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">{user.name}</span>
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          </span>
        </header>
        <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
