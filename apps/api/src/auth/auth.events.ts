/**
 * US-1.6: someone asked for a reset link. The notification module emails it; the auth module never imports
 * the mailer (architecture rule 4). `token` is the raw value: it exists only in this in-process event and the
 * email, while the database keeps its hash.
 */
export class PasswordResetRequested {
  static readonly event = 'auth.password-reset-requested';
  constructor(
    readonly userId: string,
    readonly name: string,
    readonly email: string,
    readonly token: string,
  ) {}
}
