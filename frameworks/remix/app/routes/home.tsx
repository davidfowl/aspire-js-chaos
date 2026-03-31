import type { Route } from "./+types/home";

interface WeatherForecast {
  date: string;
  temperatureC: number;
  summary: string;
}

export async function loader() {
  const apiUrl = process.env.API_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${apiUrl}/api/weather`);
    if (!res.ok) {
      return { weather: [] as WeatherForecast[], error: `API returned ${res.status}` };
    }
    const weather: WeatherForecast[] = await res.json();
    return { weather, error: null };
  } catch (e: any) {
    return { weather: [] as WeatherForecast[], error: e.message };
  }
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Remix Weather" },
    { name: "description", content: "Server-side weather data" },
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { weather, error } = loaderData;

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Remix Weather</h1>
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
            {weather.map((w: WeatherForecast) => (
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
