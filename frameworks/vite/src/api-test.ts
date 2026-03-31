// Test fetching from /api/hello (proxied to backend via Caddy)
export async function fetchHello(): Promise<string> {
  const res = await fetch('/api/hello');
  const data = await res.json();
  return data.message;
}
