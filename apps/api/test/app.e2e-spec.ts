import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type { ErrorBody } from '../src/common/filters/http-exception.filter.js';
import { setupApp } from '../src/setup-app.js';

describe('App bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the health check under the /api/v1 prefix', async () => {
    // Act
    const res = await request(app.getHttpServer()).get('/api/v1/health');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns the standard error body for an unknown route', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist');
    const body = res.body as ErrorBody;

    expect(res.status).toBe(404);
    expect(body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      path: '/api/v1/does-not-exist',
    });
    expect(typeof body.message).toBe('string');
    expect(typeof body.timestamp).toBe('string');
  });

  it('publishes the OpenAPI document for Swagger at /api/docs', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json');
    const doc = res.body as { paths: Record<string, unknown> };

    expect(res.status).toBe(200);
    expect(Object.keys(doc.paths)).toContain('/api/v1/health');
  });
});
