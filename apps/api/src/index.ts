import './config/env' // validate env first — crashes on missing vars
import { createApp } from './app'
import { prisma } from './config/prisma'
import { logger } from './config/logger'
import { env } from './config/env'

const app = createApp()

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
