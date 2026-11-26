import { Circle, CircleCheck, CircleDot, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TASK_STATUS_LABEL, type TaskStatus } from './task-api';

/** One colour and icon per status, shared by the Tugasku tabs and rows (same palette as StatusBadge). */
const TASK_STATUS_STYLE: Record<TaskStatus, { icon: LucideIcon; className: string }> = {
  TODO: { icon: Circle, className: 'bg-muted text-foreground' },
  IN_PROGRESS: { icon: CircleDot, className: 'bg-primary/10 text-primary' },
  DONE: { icon: CircleCheck, className: 'bg-success/15 text-success' },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { icon: Icon, className } = TASK_STATUS_STYLE[status];
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {TASK_STATUS_LABEL[status]}
    </span>
  );
}

/** A tinted background keeps the dark orange text readable (solid orange behind it was too low-contrast). */
export function OverdueBadge() {
  return (
    <span className="shrink-0 rounded-full bg-late/15 px-2 py-0.5 text-xs font-semibold text-late-foreground">
      Terlambat
    </span>
  );
}

/** A status tab: its colour and icon when chosen, plain otherwise; the count says what is behind it. */
export function FilterChip(props: {
  status?: TaskStatus;
  label: string;
  count: number | undefined;
  active: boolean;
  onClick: () => void;
}) {
  const style = props.status && TASK_STATUS_STYLE[props.status];
  const Icon = style?.icon;
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors',
        props.active
          ? cn('border-transparent', style?.className ?? 'bg-navy text-white')
          : 'border-border bg-card text-muted-foreground hover:bg-accent',
      )}
    >
      {Icon && <Icon className="size-4" aria-hidden="true" />}
      {props.label}
      {props.count !== undefined && (
        <span
          className={cn(
            'rounded-full px-1.5 text-xs',
            props.active ? 'bg-white/60 text-foreground' : 'bg-muted',
          )}
        >
          {props.count}
        </span>
      )}
    </button>
  );
}
