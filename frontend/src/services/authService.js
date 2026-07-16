import API from '../api/axios'

const USER_KEY = 'usuario:v1'

export const authService = {
  async login(username, password) {
    const { data } = await API.post('/login/', { username, password })
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario))
    return data
  },

  async register(data) {
    const { data: response } = await API.post('/register/', data)
    localStorage.setItem(USER_KEY, JSON.stringify(response.usuario))
    return response
  },

  async refreshToken() {
    try {
      await API.post('/token/refresh/')
      return true
    } catch {
      localStorage.removeItem(USER_KEY)
      return null
    }
  },

  async logout() {
    try {
      await API.post('/logout/')
    } catch {
    }
    localStorage.removeItem(USER_KEY)
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
}
