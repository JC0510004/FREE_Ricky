import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Paginacion from './Paginacion'

describe('Paginacion', () => {
  const base = {
    page: 1,
    total: 312,
    pageSize: 50,
    totalPaginas: 7,
    loading: false,
    etiqueta: 'usuarios',
  }

  it('muestra el rango real y el total del backend, no el de la página', () => {
    render(<Paginacion {...base} onChange={() => {}} />)

    expect(screen.getByText('Mostrando 1–50 de 312 usuarios')).toBeInTheDocument()
    expect(screen.getByText('Página 1 de 7')).toBeInTheDocument()
  })

  it('no aparece cuando todo cabe en una sola página', () => {
    const { container } = render(
      <Paginacion {...base} total={12} totalPaginas={1} onChange={() => {}} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('no aparece cuando no hay nada', () => {
    const { container } = render(
      <Paginacion {...base} total={0} totalPaginas={1} onChange={() => {}} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('deshabilita Anterior en la primera página y Siguiente en la última', () => {
    const { rerender } = render(<Paginacion {...base} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente' })).not.toBeDisabled()

    rerender(<Paginacion {...base} page={7} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Anterior' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

it('los botones son alcanzables y activables con teclado', async () => {
    // Regresión de accesibilidad: los botones de contraseña salieron del tab
    // order. El paginador no debe repetir ese patrón.
    const onChange = vi.fn()
    const user = userEvent.setup()

    // Página 2: los dos botones están activos y ambos deben ser alcanzables.
    render(<Paginacion {...base} page={2} onChange={onChange} />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Anterior' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith(1)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('un botón deshabilitado se salta en el tab order', async () => {
    // Es el comportamiento correcto del navegador: en la primera página,
    // "Anterior" no debe recibir foco porque no hay nada a lo que ir.
    const user = userEvent.setup()
    render(<Paginacion {...base} onChange={() => {}} />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Anterior' })).not.toHaveFocus()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveFocus()
  })
})