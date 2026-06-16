import API from '../api/axios'

const TOKEN_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'
const USER_KEY = 'usuario'

export const authService = {
  async login(username, password) {
    const { data } = await API.post('/login/', { username, password })
    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(REFRESH_KEY, data.refresh_token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario))
    return data
  },

  async register(data) {
    const { data: response } = await API.post('/register/', data)
    localStorage.setItem(TOKEN_KEY, response.access_token)
    localStorage.setItem(REFRESH_KEY, response.refresh_token)
    localStorage.setItem(USER_KEY, JSON.stringify(response.usuario))
    return response
  },

  async refreshToken() {
    const refresh_token = localStorage.getItem(REFRESH_KEY)
    if (!refresh_token) return null
    try {
      const { data } = await API.post('/token/refresh/', { refresh_token })
      localStorage.setItem(TOKEN_KEY, data.access_token)
      localStorage.setItem(REFRESH_KEY, data.refresh_token)
      return data.access_token
    } catch {
      this.logout()
      return null
    }
  },

  async logout() {
    const refresh_token = localStorage.getItem(REFRESH_KEY)
    try {
      await API.post('/logout/', { refresh_token })
    } catch {
    }
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  },

  async verifySession() {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return false
    try {
      await API.get('/verify/')
      return true
    } catch {
      return false
    }
  },

  getAccessToken() {
    return localStorage.getItem(TOKEN_KEY)
  },

  getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY)
  },

  getStoredUser() {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  },
}
