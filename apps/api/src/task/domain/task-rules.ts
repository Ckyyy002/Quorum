// Mirror the Prisma enums so domain code (and DTO validation) stays free of Prisma imports.
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_SOURCES = ['PROKER', 'MEETING'] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

/** US-4.3 AC1: one step forward at a time, and DONE can be reopened. Anything else is a skip (400). */
const NEXT: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['DONE'],
  DONE: ['IN_PROGRESS'],
};

export function canMoveTask(from: TaskStatus, to: TaskStatus): boolean {
  return NEXT[from].includes(to);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A deadline is a WIB day stored as 00:00 WIB (see common/wib.ts), and work is allowed until that day
 * ends, so the day has passed only once `now` reaches the next midnight WIB.
 */
export function dayHasPassed(day: Date, now: Date): boolean {
  return now.getTime() >= day.getTime() + DAY_MS;
}

/** US-4.5 AC2: deadline passed and not DONE. */
export function isTaskOverdue(
  task: { status: TaskStatus; deadline: Date | null },
  now: Date,
): boolean {
  return task.status !== 'DONE' && !!task.deadline && dayHasPassed(task.deadline, now);
}
