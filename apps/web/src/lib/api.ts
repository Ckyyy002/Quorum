import axios from 'axios';

/** Single HTTP client; auth interceptors are added in US-1. `/api` is proxied to the API by Vite. */
export const api = axios.create({ baseURL: '/api/v1', withCredentials: true });
