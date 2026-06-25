import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { errorHandler } from './middleware/error.middleware'
import { authRouter } from './modules/auth/auth.routes'
import { employeesRouter } from './modules/employees/employees.routes'
import { departmentsRouter } from './modules/departments/departments.routes'
import { jobGradesRouter } from './modules/job-grades/job-grades.routes'
import { holidaysRouter } from './modules/holidays/holidays.routes'
import { dashboardRouter } from './modules/dashboard/dashboard.routes'
import { env } from './config/env'

export function createApp(): Express {
  const app = express()

  // Security & compression
  app.use(helmet())
  app.use(compression())
  app.use(
    cors({
      origin: env.WEB_APP_URL,
      credentials: true,
    })
  )

  // Logging
  app.use(morgan('dev'))

  // Body parsing
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())

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

  // API routes
  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/employees', employeesRouter)
  app.use('/api/v1/departments', departmentsRouter)
  app.use('/api/v1/job-grades', jobGradesRouter)
  app.use('/api/v1/holidays', holidaysRouter)
  app.use('/api/v1/dashboard', dashboardRouter)

  // 404
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' })
  })

  // Error handler (must be last)
  app.use(errorHandler)

  return app
}
