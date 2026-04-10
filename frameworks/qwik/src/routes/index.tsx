import { component$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";

interface Forecast {
  date: string;
  temperatureC: number;
  summary: string;
}

export const useWeatherData = routeLoader$<Forecast[]>(async () => {
  const apiUrl = process.env["API_URL"] || "http://localhost:3001";
  const res = await fetch(`${apiUrl}/api/weather`);
  if (!res.ok) {
    throw new Error(`Weather API returned ${res.status}`);
  }
  return res.json();
});

export default component$(() => {
  const weather = useWeatherData();

  return (
    <div>
      <h1>Qwik Weather</h1>
      {weather.value.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Temp (°C)</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {weather.value.map((w) => (
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
});

export const head: DocumentHead = {
  title: "Qwik Weather",
  meta: [
    {
      name: "description",
      content: "Weather forecast powered by Qwik",
    },
  ],
};
