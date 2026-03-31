import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

interface WeatherForecast {
  date: string
  temperatureC: number
  summary: string
}

const fetchWeather = createServerFn({ method: 'GET' }).handler(async () => {
  const apiUrl = process.env.API_URL || 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/weather`)
  if (!res.ok) {
    throw new Error(`API returned ${res.status}`)
  }
  return res.json() as Promise<WeatherForecast[]>
})

export const Route = createFileRoute('/')({
  loader: async () => {
    try {
      const weather = await fetchWeather()
      return { weather, error: null }
    } catch (e: any) {
      return { weather: [] as WeatherForecast[], error: e.message }
    }
  },
  component: App,
})

function App() {
  const { weather, error } = Route.useLoaderData()

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
          TanStack Start Weather
        </h1>

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
      </section>
    </main>
  )
}
