import API from '../api/axios'

const USER_KEY = 'usuario:v1'
const TOKEN_KEY = 'access_token'

export const authService = {
  async login(username, password) {
    const { data } = await API.post('/login/', { username, password })
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario))
    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token)
    }
    return data
  },

  async register(data) {
    const { data: response } = await API.post('/register/', data)
    return response
  },

  async refreshToken() {
    try {
      const { data } = await API.post('/token/refresh/')
      if (data.access_token) {
        localStorage.setItem(TOKEN_KEY, data.access_token)
        return data.access_token
      }
      return null
    } catch {
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(TOKEN_KEY)
      return null
    }
  },

  async logout() {
    try {
      await API.post('/logout/')
    } catch {
    }
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
  },

  async verifySession() {
    try {
      await API.get('/verify/')
      return true
    } catch {
      return false
    }
  },

  getStoredUser() {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  },

  getStoredToken() {
    return localStorage.getItem(TOKEN_KEY)
  },
}
