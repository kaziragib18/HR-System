module.exports = {
  apps: [
    {
      name: 'hr-api',
      cwd: './apps/api',
      script: 'npx',
      args: 'tsx src/index.ts',
      watch: ['src'],
      ignore_watch: ['node_modules'],
      env: { NODE_ENV: 'development' },
      restart_delay: 1000,
      max_restarts: 10,
      error_file: '../../logs/api-error.log',
      out_file: '../../logs/api-out.log',
    },
    {
      name: 'hr-web',
      cwd: './apps/web',
      script: 'npx',
      args: 'next dev --port 3000',
      env: { NODE_ENV: 'development' },
      restart_delay: 2000,
      max_restarts: 10,
      error_file: '../../logs/web-error.log',
      out_file: '../../logs/web-out.log',
    },
  ],
}
