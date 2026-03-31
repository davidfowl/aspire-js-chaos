const http = require('http');
const port = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/hello') {
    res.end(JSON.stringify({ message: 'Hello from the API!', timestamp: new Date().toISOString() }));
  } else if (req.url === '/api/health') {
    res.end(JSON.stringify({ status: 'healthy' }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`API server listening on port ${port}`);
});
