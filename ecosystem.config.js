module.exports = {
  apps: [{
    name: "likeme",
    script: "./index.js",
    watch: false,
    instances: 1,
    exec_mode: "cluster",
    max_memory_restart: '500M',
    cron_restart: "59 23 * * * *",
    node_args: "--require dotenv/config", // Carga dotenv antes de ejecutar el script
    env_production: {
      NODE_ENV: "production",
    },
  }]
};
