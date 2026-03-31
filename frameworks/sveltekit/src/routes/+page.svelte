<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<h1>SvelteKit Weather</h1>

{#if data.error}
  <p>Failed to load weather data: {data.error}</p>
{:else if data.weather && data.weather.length}
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Temp (°C)</th>
        <th>Summary</th>
      </tr>
    </thead>
    <tbody>
      {#each data.weather as w}
        <tr>
          <td>{w.date}</td>
          <td>{w.temperatureC}</td>
          <td>{w.summary}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <p>No weather data available.</p>
{/if}
