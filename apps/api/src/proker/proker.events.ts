/**
 * Emitted after the write commits. The notification module (not built yet) will listen and email the PIC
 * and biro leads; the proker module never imports the mailer (architecture rule 4).
 */
export class ProkerCreated {
  static readonly event = 'proker.created';
  constructor(readonly prokerId: string) {}
}

/** A new PIC was set on an existing proker (US-3.2 AC1). */
export class ProkerPicAssigned {
  static readonly event = 'proker.pic-assigned';
  constructor(
    readonly prokerId: string,
    readonly picMembershipId: string,
  ) {}
}

/** Members newly added to the committee (US-3.9 AC4: they are emailed). */
export class ProkerCommitteeChanged {
  static readonly event = 'proker.committee-changed';
  constructor(
    readonly prokerId: string,
    readonly addedMembershipIds: string[],
  ) {}
}

/**
 * The event date was set, moved or cleared. The document module re-plans the proposal deadlines (US-5),
 * so the proker module does not need to know documents have deadlines.
 */
export class ProkerEventDateChanged {
  static readonly event = 'proker.event-date-changed';
  constructor(
    readonly prokerId: string,
    readonly eventDate: Date | null,
  ) {}
}
