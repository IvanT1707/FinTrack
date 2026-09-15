import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('fintrack_access_token')
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let refreshPromise = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const refreshToken = localStorage.getItem('fintrack_refresh_token')

    if (error.response?.status !== 401 || originalRequest?._retry || !refreshToken) {
      return Promise.reject(error)
    }

    originalRequest._retry = true
    refreshPromise ||= axios.post(`${api.defaults.baseURL}/auth/refresh`, {
      refresh_token: refreshToken,
    })

    try {
      const { data } = await refreshPromise
      localStorage.setItem('fintrack_access_token', data.access_token)
      originalRequest.headers.Authorization = `Bearer ${data.access_token}`
      return api(originalRequest)
    } catch (refreshError) {
      localStorage.removeItem('fintrack_access_token')
      localStorage.removeItem('fintrack_refresh_token')
      localStorage.removeItem('fintrack_user')
      window.dispatchEvent(new Event('fintrack:logout'))
      return Promise.reject(refreshError)
    } finally {
      refreshPromise = null
    }
  },
)

export default api
