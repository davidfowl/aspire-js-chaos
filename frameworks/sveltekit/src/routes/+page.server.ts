import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  const apiUrl = process.env.API_URL || 'http://localhost:3001';
  try {
    const res = await fetch(`${apiUrl}/api/weather`);
    if (!res.ok) {
      return { weather: [], error: `API returned ${res.status}` };
    }
    const weather = await res.json();
    return { weather, error: null };
  } catch (e: any) {
    return { weather: [], error: e.message };
  }
};
