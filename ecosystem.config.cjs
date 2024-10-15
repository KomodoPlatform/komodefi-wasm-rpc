module.exports = {
  apps: [
    {
      name: 'dev-server',
      script: 'yarn dev',
      watch: false,
      autorestart: true,
    },
    {
      name: 'main-server',
      script: 'server.cjs',
      watch: true,
    },
  ],
};
