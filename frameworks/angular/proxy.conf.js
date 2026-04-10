const target = process.env.API_HTTPS || process.env.API_HTTP || 'http://localhost:3001';

module.exports = {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
  }
};
