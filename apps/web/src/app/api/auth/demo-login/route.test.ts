import { POST } from './route';
import { NextRequest } from 'next/server';

describe('POST /api/auth/demo-login', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 403 when DEMO_LOGIN is not true', async () => {
    process.env = { ...originalEnv, DEMO_LOGIN: 'false' };
    
    const request = new NextRequest('http://localhost:3000/api/auth/demo-login', {
      method: 'POST',
    });

    const response = await POST(request);
    
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Demo login not enabled');
  });

  it('returns 403 when DEMO_LOGIN is undefined', async () => {
    const envWithoutDemo = { ...originalEnv };
    delete envWithoutDemo.DEMO_LOGIN;
    process.env = envWithoutDemo;
    
    const request = new NextRequest('http://localhost:3000/api/auth/demo-login', {
      method: 'POST',
    });

    const response = await POST(request);
    
    expect(response.status).toBe(403);
  });
});
