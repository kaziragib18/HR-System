import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { errorHandler } from './middleware/error.middleware'

export function createApp() {
  const app = express()

  // Security & compression
  app.use(helmet())
  app.use(compression())
  app.use(
    cors({
      origin: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
      credentials: true,
    })
  )

  // Logging
  app.use(morgan('dev'))

  // Body parsing
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  // Global rate limit
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Too many requests, please try again later.' },
    })
  )

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // API routes (registered here as modules are built)
  // app.use('/api/v1/auth', authRouter)
  // app.use('/api/v1/employees', employeesRouter)
  // ...

  // 404
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' })
  })

  // Error handler (must be last)
  app.use(errorHandler)

  return app
}
