interface WeatherForecast {
  date: string;
  temperatureC: number;
  summary: string;
}

export default async function Home() {
  const apiUrl = process.env.API_URL || 'http://localhost:3001';
  let weather: WeatherForecast[] = [];
  let error: string | null = null;

  try {
    const res = await fetch(`${apiUrl}/api/weather`, { cache: 'no-store' });
    if (!res.ok) {
      error = `API returned ${res.status}`;
    } else {
      weather = await res.json();
    }
  } catch (e: any) {
    error = e.message;
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Next.js Weather</h1>
      {error ? (
        <p>Failed to load weather data: {error}</p>
      ) : weather.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Temp (°C)</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {weather.map((w) => (
              <tr key={w.date}>
                <td>{w.date}</td>
                <td>{w.temperatureC}</td>
                <td>{w.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No weather data available.</p>
      )}
    </div>
  );
}
