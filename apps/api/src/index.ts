import './config/env' // validate env first — crashes on missing vars
import { createApp } from './app'
import { prisma } from './config/prisma'
import { logger } from './config/logger'
import { env } from './config/env'

const app = createApp()

// Last-resort safety net: every controller is expected to catch its own
// errors and always send a response (see sendUnexpectedError in
// utils/response.ts) rather than let one reach here. But on Node 15+ an
// unhandled promise rejection crashes the whole process by default — so if
// anything still slips through (a background task, a bug in code outside a
// request handler), log it instead of taking down the API for every user
// over a single bad request.
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled promise rejection')
})

// A synchronous throw outside any request handler means process state may
// be corrupted — log with full context (unlike an unattributed crash) and
// exit so the process manager (nodemon in dev, PM2 in production per
// ecosystem.config.js) restarts it cleanly.
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception — exiting')
  process.exit(1)
})

async function start() {
  try {
    await prisma.$connect()
    logger.info('Connected to database')

    const server = app.listen(env.API_PORT, () => {
      logger.info(`API server running on http://localhost:${env.API_PORT}`)
    })

    // Keep the DB connection alive — Supabase pooler drops idle connections after ~5 min
    const keepAlive = setInterval(async () => {
      try { await prisma.$queryRaw`SELECT 1` } catch { /* reconnect on next request */ }
    }, 4 * 60 * 1000) // every 4 minutes

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      clearInterval(keepAlive)
      logger.info(`${signal} received — shutting down`)
      server.close(async () => {
        await prisma.$disconnect()
        logger.info('Server closed')
        process.exit(0)
      })
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  } catch (err) {
    logger.error({ err }, 'Failed to start server')
    process.exit(1)
  }
}

start()
