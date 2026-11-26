/**
 * Emitted after a task is created or reassigned (US-4.1 AC3, US-4.2 AC1). The notification module (not
 * built yet) will email the assignee; the task module never imports the mailer (architecture rule 4).
 */
export class TaskAssigned {
  static readonly event = 'task.assigned';
  constructor(
    readonly taskId: string,
    readonly assigneeMembershipId: string,
  ) {}
}
