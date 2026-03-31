export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const apiUrl = config.apiUrl || 'http://localhost:3001';
  const data = await $fetch(`${apiUrl}/api/weather`);
  return data;
});
