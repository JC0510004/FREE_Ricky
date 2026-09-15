import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorMessage from './ErrorMessage'

describe('ErrorMessage', () => {
  it('retorna null si no hay mensaje', () => {
    const { container } = render(<ErrorMessage message={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('retorna null si el mensaje es string vacío', () => {
    const { container } = render(<ErrorMessage message="" />)
    expect(container.firstChild).toBeNull()
  })

  it('muestra el mensaje de error', () => {
    render(<ErrorMessage message="Credenciales incorrectas" />)
    expect(screen.getByText('Credenciales incorrectas')).toBeInTheDocument()
  })

  it('contiene el icono de error', () => {
    render(<ErrorMessage message="Error de prueba" />)
    expect(screen.getByText('error')).toBeInTheDocument()
  })
})