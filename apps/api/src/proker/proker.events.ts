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
