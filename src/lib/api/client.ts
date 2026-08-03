import axios, { AxiosRequestConfig } from "axios";

// Standalone public self-signup portal — talks only to PUBLIC backend endpoints.
const API_BASE = import.meta.env.VITE_API_GATEWAY as string;

export const apiClient = axios.create({ baseURL: API_BASE });

const Request = {
  async get<T = unknown>(url: string, params?: Record<string, unknown>) {
    const res = await apiClient.get<T>(url, { params });
    return res.data;
  },
  async post<T = unknown>(url: string, payload?: unknown, config?: AxiosRequestConfig) {
    const res = await apiClient.post<T>(url, payload, config);
    return res.data;
  },
  async put<T = unknown>(url: string, payload?: unknown, config?: AxiosRequestConfig) {
    const res = await apiClient.put<T>(url, payload, config);
    return res.data;
  },
};

export default Request;
