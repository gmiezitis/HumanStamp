# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: comprehensive-demo.spec.ts >> Comprehensive Agency Demo - Full Workflow with Screenshots >> complete workflow with 7 styled screenshots
- Location: e2e/comprehensive-demo.spec.ts:10:7

# Error details

```
AggregateError: apiRequestContext.post: connect ECONNREFUSED ::1:3000
connect ECONNREFUSED 127.0.0.1:3000
Call log:
  - → POST http://localhost:3000/api/auth/test-login
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.12 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - content-type: application/json
    - content-length: 32

```