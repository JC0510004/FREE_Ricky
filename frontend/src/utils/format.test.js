import { describe, it, expect } from 'vitest'
import { formatTime, extractApiError } from './format'

describe('formatTime', () => {
  it('formatea segundos a MM:SS', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(59)).toBe('0:59')
    expect(formatTime(60)).toBe('1:00')
    expect(formatTime(125)).toBe('2:05')
  })

  it('agrega cero a la izquierda en los segundos', () => {
    expect(formatTime(61)).toBe('1:01')
    expect(formatTime(600)).toBe('10:00')
  })
})

describe('extractApiError', () => {
  it('retorna fallback si no hay datos', () => {
    expect(extractApiError(null)).toBe('Ocurrió un error')
    expect(extractApiError(undefined, 'fallback')).toBe('fallback')
  })

  it('retorna el string directo', () => {
    expect(extractApiError('Credenciales incorrectas')).toBe('Credenciales incorrectas')
  })

  it('extrae un error de una lista', () => {
    expect(extractApiError({ username: ['Este usuario no está disponible'] })).toBe(
      'Este usuario no está disponible'
    )
  })

  it('extrae non_field_errors', () => {
    expect(extractApiError({ non_field_errors: ['Credenciales inválidas'] })).toBe(
      'Credenciales inválidas'
    )
  })

  it('une múltiples errores con separador', () => {
    expect(extractApiError({
      username: ['Usuario requerido'],
      password: ['Contraseña requerida'],
    })).toBe('Usuario requerido · Contraseña requerida')
  })

  it('ignora vacíos y nulls', () => {
    expect(extractApiError({ username: [''], email: null })).toBe('Ocurrió un error')
  })
})