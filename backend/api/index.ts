/**
 * Vercel Serverless Entry Point — Hono Backend
 *
 * Uses @hono/node-server's official Vercel adapter for maximum stability and performance.
 * Dynamically strips the /_/backend path prefix from the Node.js request
 * object before passing it to Hono to ensure correct route matching.
 */

import { handle } from '@hono/node-server/vercel';
import app from '../src/app.js';

const handler = handle(app);

export default async function (req: any, res: any) {
  // Strip /_/backend prefix so Hono matches routes correctly
  if (req.url && req.url.startsWith('/_/backend')) {
    req.url = req.url.substring('/_/backend'.length);
    if (!req.url.startsWith('/')) {
      req.url = '/' + req.url;
    }
  }
  return handler(req, res);
}
