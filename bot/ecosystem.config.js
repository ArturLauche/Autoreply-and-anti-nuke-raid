module.exports = {
  apps: [
    {
      name: "protogon-bot",
      script: "src/index.js",
      cwd: __dirname,
      // 🔋 Tối ưu RAM cho VPS 1GB:
      node_args: "--max-old-space-size=640 --optimize-for-size --gc-interval=100",
      // Auto-restart khi crash hoặc memory leak
      max_memory_restart: "700M",
      exp_backoff_restart_delay: 100,
      // Logs
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      merge_logs: true,
      max_restarts: 10,
      min_uptime: "10s",
      // Environment
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
