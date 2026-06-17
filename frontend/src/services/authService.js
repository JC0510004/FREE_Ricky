import API from '../api/axios'

const TOKEN_KEY = 'access_token'
const USER_KEY = 'usuario'

let _accessToken = localStorage.getItem(TOKEN_KEY)

export const authService = {
  async login(username, password) {
    const { data } = await API.post('/login/', { username, password })
    _accessToken = data.access_token
    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario))
    return data
  },

  async register(data) {
    const { data: response } = await API.post('/register/', data)
    _accessToken = response.access_token
    localStorage.setItem(TOKEN_KEY, response.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(response.usuario))
    return response
  },

  async refreshToken() {
    try {
      const { data } = await API.post('/token/refresh/')
      _accessToken = data.access_token
      localStorage.setItem(TOKEN_KEY, data.access_token)
      return data.access_token
    } catch {
      _accessToken = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      return null
    }
  },

  async logout() {
    try {
      await API.post('/logout/')
    } catch {
    }
    _accessToken = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },

  async verifySession() {
    const token = this.getAccessToken()
    if (!token) return false
    try {
      await API.get('/verify/')
      return true
    } catch {
      return false
    }
  },

  getAccessToken() {
    return _accessToken || localStorage.getItem(TOKEN_KEY)
  },

  getStoredUser() {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  },
}
