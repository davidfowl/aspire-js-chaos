const http = require('http');
const port = process.env.PORT || 3001;

const forecasts = [
  { date: '2026-04-01', temperatureC: 22, summary: 'Warm' },
  { date: '2026-04-02', temperatureC: 18, summary: 'Cool' },
  { date: '2026-04-03', temperatureC: 30, summary: 'Hot' },
  { date: '2026-04-04', temperatureC: 12, summary: 'Chilly' },
  { date: '2026-04-05', temperatureC: 25, summary: 'Balmy' },
];

const server = http.createServer((req, res) => {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/api/weather' || req.url === '/weather') {
    res.end(JSON.stringify(forecasts));
  } else if (req.url === '/api/health' || req.url === '/health') {
    res.end(JSON.stringify({ status: 'healthy' }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found', path: req.url }));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Weather API listening on port ${port}`);
});
