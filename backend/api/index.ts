/**
 * Vercel Serverless Entry Point — Hono Backend
 *
 * This file is the single serverless function that handles ALL backend
 * requests on Vercel. It converts Vercel's Node.js req/res into
 * Web standard Request/Response that Hono understands.
 *
 * How it works on Vercel:
 *   - Every request to /_/backend/* hits this function
 *   - We reconstruct a Web Request from the Vercel req object
 *   - Hono processes it and returns a Web Response
 *   - We write the response back to Vercel's res object
 *
 * Runtime: nodejs20.x (required for Prisma + PostgreSQL)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../src/app.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Build the full URL from Vercel's request, stripping the /_/backend route prefix so Hono matches routes correctly
  const host = req.headers.host ?? 'localhost';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  let path = req.url ?? '/';
  if (path.startsWith('/_/backend')) {
    path = path.substring('/_/backend'.length);
  }
  // Ensure path starts with a slash
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  const url = new URL(path, `${protocol}://${host}`);

  // Collect the body (Vercel parses JSON automatically, we need to re-serialize)
  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.body !== undefined && req.body !== null) {
      body = JSON.stringify(req.body);
    }
  }

  // Convert Vercel headers to standard Headers object
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else {
      headers.set(key, value);
    }
  }

  // Ensure content-type is set for JSON bodies
  if (body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  // Build a Web-standard Request for Hono
  const webRequest = new Request(url.toString(), {
    method: req.method ?? 'GET',
    headers,
    body,
  });

  // Let Hono handle it
  const response = await app.fetch(webRequest);

  // Write status
  res.status(response.status);

  // Write response headers
  response.headers.forEach((value, key) => {
    // Skip headers that Node.js manages automatically
    if (key.toLowerCase() === 'transfer-encoding') return;
    res.setHeader(key, value);
  });

  // Write body
  const responseBody = await response.arrayBuffer();
  res.end(Buffer.from(responseBody));
}
