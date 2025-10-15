module.exports = {
  apps: [
    {
      name: 'gov-stats-backend',
      script: './venv/bin/uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8010',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PYTHONUNBUFFERED: '1',
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'gov-stats-frontend',
      script: 'npm',
      args: 'run start:prod',
      cwd: './frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_BASE_URL: 'http://60.205.111.170:8010',
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
