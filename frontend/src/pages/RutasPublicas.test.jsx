import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { AuthProvider } from '../contexts/AuthContext'
import { ForgotPassword } from '../routes/lazyPages'

describe('rutas públicas', () => {
  it('/forgot-password monta ForgotPassword y no la landing', async () => {
    window.history.pushState({}, '', '/forgot-password?token=abc123')
    render(
      <StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="*" element={<div>LANDING</div>} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </StrictMode>,
    )
    expect(screen.queryByText('LANDING')).toBeNull()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Abriendo tu enlace' })).toBeInTheDocument()
    }, { timeout: 5000 })
  })
})
