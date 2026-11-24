import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter.toBody', () => {
  const filter = new HttpExceptionFilter();

  it('keeps status, message and error of a Nest HTTP exception', () => {
    const body = filter.toBody(new NotFoundException('Proker not found'), '/api/v1/prokers/1');

    expect(body).toMatchObject({
      statusCode: 404,
      message: 'Proker not found',
      error: 'Not Found',
      path: '/api/v1/prokers/1',
    });
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('keeps the list of validation messages from the ValidationPipe', () => {
    const body = filter.toBody(new BadRequestException(['email must be an email']), '/x');

    expect(body.statusCode).toBe(400);
    expect(body.message).toEqual(['email must be an email']);
    expect(body.error).toBe('Bad Request');
  });

  it('uses the standard status text when the exception response is a plain string', () => {
    const body = filter.toBody(new HttpException('Too big', 413), '/x');

    expect(body).toMatchObject({ statusCode: 413, message: 'Too big', error: 'Payload Too Large' });
  });

  it('hides the internal message of an unknown error behind a 500', () => {
    const body = filter.toBody(new Error('connection string leaked'), '/x');

    expect(body).toMatchObject({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  });
});
