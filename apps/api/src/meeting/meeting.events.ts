/**
 * Emitted after the write commits. The notification module will email the invitees (US-6.1 AC2, 6.2 AC1);
 * the meeting module never imports the mailer (architecture rule 4).
 */
export class MeetingScheduled {
  static readonly event = 'meeting.scheduled';
  constructor(readonly meetingId: string) {}
}

export class MeetingUpdated {
  static readonly event = 'meeting.updated';
  constructor(readonly meetingId: string) {}
}

export class MeetingCancelled {
  static readonly event = 'meeting.cancelled';
  constructor(readonly meetingId: string) {}
}

/** US-6.3 AC3: every invitee gets the minutes. */
export class MinutesPublished {
  static readonly event = 'minutes.published';
  constructor(readonly meetingId: string) {}
}
