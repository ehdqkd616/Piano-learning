module.exports = {
  apps: [
    {
      name: 'piano-learning-api',
      cwd: __dirname,
      script: 'src/index.js',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
