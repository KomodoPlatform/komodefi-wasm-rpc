module.exports = {
  apps: [
    {
      name: 'web-server',
      script: 'yarn preview',
      autorestart: true,
    },
    {
      name: 'main-server',
      script: 'server.cjs',
      watch: false,
      autorestart: true,
    },
  ],
};
