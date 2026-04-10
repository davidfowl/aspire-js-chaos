import { Title } from "@solidjs/meta";
import { For } from "solid-js";
import { query, createAsync } from "@solidjs/router";

interface WeatherForecast {
  date: string;
  temperatureC: number;
  summary: string;
}

const getWeather = query(async () => {
  "use server";
  const apiUrl = process.env.API_URL || "http://localhost:3001";
  const res = await fetch(`${apiUrl}/api/weather`);
  if (!res.ok) {
    throw new Error(`Weather API returned ${res.status}`);
  }
  return (await res.json()) as WeatherForecast[];
}, "weather");

export const route = {
  preload: () => getWeather(),
};

export default function Home() {
  const weather = createAsync(() => getWeather());

  return (
    <main>
      <Title>SolidStart Weather</Title>
      <h1>SolidStart Weather</h1>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Temp (°C)</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          <For each={weather()}>
            {(w) => (
              <tr>
                <td>{w.date}</td>
                <td>{w.temperatureC}</td>
                <td>{w.summary}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </main>
  );
}
