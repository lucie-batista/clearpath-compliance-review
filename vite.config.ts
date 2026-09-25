import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { POST as aiReview } from './api/ai-review.ts'

/** Serves the Vercel function locally, so `npm run dev` behaves like production. */
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use('/api/ai-review', async (req: IncomingMessage, res: ServerResponse) => {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const request = new Request('http://localhost/api/ai-review', {
          method: req.method,
          headers: { 'content-type': 'application/json', 'x-forwarded-for': req.socket.remoteAddress ?? 'local' },
          body: req.method === 'POST' ? Buffer.concat(chunks).toString() : undefined,
        })
        const response = await aiReview(request)
        res.statusCode = response.status
        res.setHeader('content-type', 'application/json')
        res.end(await response.text())
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Make ANTHROPIC_API_KEY from .env.local available to the local API (never exposed to the browser).
  const env = loadEnv(mode, process.cwd(), '')
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
  return { plugins: [react(), localApi()] }
})
