import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

const config = (values: Record<string, unknown>) =>
  ({
    get: (key: string) => values[key],
    getOrThrow: (key: string) => values[key],
  }) as unknown as ConfigService;

const to = { userId: 'u1', name: 'Rani', email: 'rani@quorum.test' };
const mail = { subject: 'Tugas baru', html: '<p>Halo</p>' };

describe('MailService', () => {
  it('builds the message without sending anything when the transport is json', async () => {
    const service = new MailService(config({ MAIL_TRANSPORT: 'json', MAIL_FROM: 'q@quorum.test' }));

    await expect(service.send(to, mail)).resolves.toBeUndefined();
  });

  it('logs a failed send instead of throwing', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    // Port 1 on localhost refuses connections, so the SMTP send fails at once.
    const service = new MailService(
      config({ MAIL_TRANSPORT: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: 1, MAIL_FROM: 'q@x' }),
    );

    await expect(service.send(to, mail)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Could not email user u1'));
    error.mockRestore();
  });
});
