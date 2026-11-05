import { describe, it, expect } from 'vitest'
import { MENSAJE, normalizarMensajeUnity, normalizarOrigen } from './unityProtocol'

describe('normalizarOrigen', () => {
  it('quita barra final y ruta, y conserva el origen', () => {
    expect(normalizarOrigen('http://host:8080/')).toBe('http://host:8080')
    expect(normalizarOrigen('http://host:8080/unity/')).toBe('http://host:8080')
    expect(normalizarOrigen('https://host')).toBe('https://host')
    expect(normalizarOrigen('no-es-url/')).toBe('no-es-url')
  })
})

describe('normalizarMensajeUnity', () => {
  it('rechaza mensajes que no son objetos o no tienen type válido', () => {
    expect(normalizarMensajeUnity(null)).toBeNull()
    expect(normalizarMensajeUnity('hola')).toBeNull()
    expect(normalizarMensajeUnity({ type: 'otroMensaje' })).toBeNull()
  })

  it('acepta unityListo sin datos', () => {
    expect(normalizarMensajeUnity({ type: MENSAJE.UNITY_LISTO })).toEqual({
      tipo: MENSAJE.UNITY_LISTO,
      datos: null,
      advertencias: [],
    })
  })

  it('normaliza stats dentro de "datos"', () => {
    const mensaje = normalizarMensajeUnity({
      type: MENSAJE.STATS,
      datos: { muertes: 4, tiempo: 120 },
    })

    expect(mensaje).toEqual({
      tipo: MENSAJE.STATS,
      datos: {
        nivelId: null,
        escena: null,
        muertes: 4,
        tiempo: 120,
        completado: null,
      },
      advertencias: [],
    })
  })

  it('rechaza stats sin ninguna métrica utilizable', () => {
    expect(normalizarMensajeUnity({
      type: MENSAJE.STATS,
      datos: { muertes: -1, tiempo: '120' },
    })).toBeNull()
  })

  it('normaliza resultadoPartida con completado explícito', () => {
    const mensaje = normalizarMensajeUnity({
      type: MENSAJE.RESULTADO,
      datos: { nivelId: 3, escena: 'La Guarida', muertes: 2, tiempo: 90, completado: false },
    })

    expect(mensaje.datos).toMatchObject({
      nivelId: 3,
      escena: 'La Guarida',
      muertes: 2,
      tiempo: 90,
      completado: false,
    })
    expect(mensaje.advertencias).toEqual([])
  })

  it('asume victoria y avisa si resultadoPartida no trae completado', () => {
    const mensaje = normalizarMensajeUnity({
      type: MENSAJE.RESULTADO,
      datos: { muertes: 2, tiempo: 90 },
    })

    expect(mensaje.datos.completado).toBe(true)
    expect(mensaje.advertencias).toHaveLength(1)
    expect(mensaje.advertencias[0]).toContain('completado')
  })

  it('acepta salirPanel sin datos (Juego.jsx pedirá los stats)', () => {
    const mensaje = normalizarMensajeUnity({ type: MENSAJE.SALIR })

    expect(mensaje.datos).toEqual({
      nivelId: null,
      escena: null,
      muertes: null,
      tiempo: null,
      completado: false,
    })
    expect(mensaje.advertencias).toEqual([])
  })

  it('trata salirPanel sin completado como abandono', () => {
    const mensaje = normalizarMensajeUnity({
      type: MENSAJE.SALIR,
      datos: { muertes: 1, tiempo: 30 },
    })

    expect(mensaje.datos.completado).toBe(false)
    expect(mensaje.advertencias).toEqual([])
  })

  it('respeta salirPanel completado=true', () => {
    const mensaje = normalizarMensajeUnity({
      type: MENSAJE.SALIR,
      datos: { completado: true },
    })

    expect(mensaje.datos.completado).toBe(true)
  })

  it('trata datos:null como ausencia de envoltorio', () => {
    const conRaiz = normalizarMensajeUnity({
      type: MENSAJE.SALIR,
      datos: null,
      muertes: 2,
      tiempo: 10,
    })
    expect(conRaiz.datos.muertes).toBe(2)
    expect(conRaiz.datos.tiempo).toBe(10)
    expect(conRaiz.advertencias.some((a) => a.includes('raíz'))).toBe(true)

    const sinDatos = normalizarMensajeUnity({ type: MENSAJE.SALIR, datos: null })
    expect(sinDatos.datos.completado).toBe(false)
    expect(sinDatos.advertencias).toEqual([])

    expect(normalizarMensajeUnity({ type: MENSAJE.STATS, datos: null })).toBeNull()
    expect(normalizarMensajeUnity({ type: MENSAJE.RESULTADO, datos: null })).toBeNull()
  })

  it('acepta la forma plana (datos en la raíz) y lo advierte', () => {
    const mensaje = normalizarMensajeUnity({
      type: MENSAJE.SALIR,
      muertes: 1,
      tiempo: 30,
    })

    expect(mensaje.datos.muertes).toBe(1)
    expect(mensaje.datos.tiempo).toBe(30)
    expect(mensaje.advertencias).toHaveLength(1)
    expect(mensaje.advertencias[0]).toContain('raíz')
  })

  it('no acepta alias de campos fuera del contrato', () => {
    expect(normalizarMensajeUnity({
      type: MENSAJE.STATS,
      datos: { deaths: 3, time: 10 },
    })).toBeNull()

    expect(normalizarMensajeUnity({
      type: MENSAJE.RESULTADO,
      datos: { deaths: 3, time: 10, win: true },
    })).toBeNull()
  })

  it('valida tipos: nivelId entero positivo, escena no vacía, números finitos', () => {
    expect(normalizarMensajeUnity({
      type: MENSAJE.STATS,
      datos: { muertes: Infinity, tiempo: -5 },
    })).toBeNull()

    const mensaje = normalizarMensajeUnity({
      type: MENSAJE.SALIR,
      datos: { nivelId: 0, escena: '   ', muertes: Infinity, tiempo: -5 },
    })
    expect(mensaje.datos).toMatchObject({
      nivelId: null,
      escena: null,
      muertes: null,
      tiempo: null,
    })

    const valido = normalizarMensajeUnity({
      type: MENSAJE.SALIR,
      datos: { nivelId: 7, escena: '  Nivel 7  ' },
    })
    expect(valido.datos.nivelId).toBe(7)
    expect(valido.datos.escena).toBe('Nivel 7')
  })
})
