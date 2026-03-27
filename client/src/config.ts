const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL
const rawSocketUrl = import.meta.env.VITE_SOCKET_URL

export const config = {
  apiBaseUrl: rawApiBaseUrl && rawApiBaseUrl.trim() !== '' ? rawApiBaseUrl : 'http://localhost:3001',
  socketUrl: rawSocketUrl && rawSocketUrl.trim() !== '' ? rawSocketUrl : 'http://localhost:3001',
}
