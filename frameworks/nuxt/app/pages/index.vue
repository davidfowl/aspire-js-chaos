<template>
  <div>
    <h1>Nuxt Weather</h1>
    <p v-if="error">Failed to load weather data: {{ error.message }}</p>
    <table v-else-if="data && data.length">
      <thead>
        <tr><th>Date</th><th>Temp (°C)</th><th>Summary</th></tr>
      </thead>
      <tbody>
        <tr v-for="w in data" :key="w.date">
          <td>{{ w.date }}</td>
          <td>{{ w.temperatureC }}</td>
          <td>{{ w.summary }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else>Loading weather data...</p>
  </div>
</template>

<script setup lang="ts">
interface Forecast {
  date: string;
  temperatureC: number;
  summary: string;
}

const { data, error } = await useAsyncData<Forecast[]>('weather', () =>
  $fetch('/api/weather')
);
</script>
