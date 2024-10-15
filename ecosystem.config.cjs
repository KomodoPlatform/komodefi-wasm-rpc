module.exports = {
  apps: [
    {
      name: 'web-server',
      script: 'yarn preview',
      watch: false,
      autorestart: true,
    },
    {
      name: 'main-server',
      script: 'server.cjs',
      // watch: true,
    },
  ],
};
