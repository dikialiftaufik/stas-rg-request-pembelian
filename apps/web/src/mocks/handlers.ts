import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/api/v1/setup', () =>
    HttpResponse.json({ data: { mode: 'mock', backendConnected: false } }),
  ),
];
