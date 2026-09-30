import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { WorkflowError } from './workflow';

export function apiError(error: unknown) {
  if (error instanceof WorkflowError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  if (error instanceof ZodError)
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  if (error instanceof Error) {
    if (error.message === 'EMAIL_NOT_CONFIGURED')
      return NextResponse.json(
        {
          error:
            'Email sending is not configured. Ask your administrator to configure SMTP before sending review requests.',
        },
        { status: 503 }
      );
    if (error.message.includes('Unauthorized'))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message.includes('Forbidden'))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  console.error('Approval workflow request failed');
  return NextResponse.json(
    { error: 'Unable to complete the request. Please try again.' },
    { status: 500 }
  );
}
