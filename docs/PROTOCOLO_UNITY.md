# Protocolo de comunicación Web ⇄ Unity

Contrato único para los mensajes que el build de Unity WebGL intercambia con
la página mediante `postMessage`. La implementación vive en
`frontend/src/game/unityProtocol.js` y su validación está cubierta por
`frontend/src/game/unityProtocol.test.js`.

Antes de este contrato, `Juego.jsx` aceptaba decenas de alias
(`muertes`/`muerte`/`deaths`/`vidasPerdidas`/…, `completado`/`completed`/
`victoria`/`win`/…) y varios envoltorios anidados. Si el juego cambiaba un
nombre, no fallaba de forma visible: se guardaban `0` muertes o la partida se
marcaba mal. Ahora solo se aceptan los campos definidos aquí; cualquier otro
mensaje se rechaza y se avisa por consola.

---

## Reglas generales

- Todos los mensajes son objetos con un campo `type` obligatorio.
- Los datos de un mensaje viajan dentro de `datos` (forma canónica):

  ```json
  { "type": "resultadoPartida", "datos": { "...": "..." } }
  ```

  La forma plana (`{ "type": "...", "muertes": 3 }`) sigue aceptándose por
  compatibilidad, pero el frontend emite un aviso por consola. Migra a `datos`.
- No hay alias de campos. El campo es `muertes`, no `deaths`; es `tiempo`, no
  `time`; es `completado`, no `win`.
- `muertes` y `tiempo` deben ser números finitos y no negativos.
- `nivelId` debe ser un entero positivo.
- `escena` debe ser una cadena no vacía (se recorta el espacio sobrante).
- `completado` debe ser booleano.
- El `origin` del `postMessage` debe coincidir con el origen de
  `VITE_GAME_ORIGIN`. Se compara solo el origen (esquema, host y puerto), así
  que una barra final o una ruta en la variable no rompen el filtro. Si no
  coincide, el mensaje se ignora.

---

## Mensajes del juego → web

### `unityListo`

El juego ha cargado y está listo para recibir el nombre del jugador y el nivel.

```json
{ "type": "unityListo" }
```

La web responde con:

```json
{ "type": "setPlayerName", "nombre": "jugador1" }
{ "type": "cargarNivel", "nivel": 3 }
```

### `stats`

Actualización de estadísticas en vivo (HUD). Se usa para tener muertes/tiempo
a mano si el jugador sale antes de que llegue un `resultadoPartida`.

```json
{
  "type": "stats",
  "datos": { "muertes": 4, "tiempo": 120 }
}
```

Ambos campos son opcionales, pero debe venir al menos uno.

### `resultadoPartida`

La partida ha terminado. Es el mensaje que registra la partida en el backend.

```json
{
  "type": "resultadoPartida",
  "datos": {
    "nivelId": 3,
    "escena": "La Guarida del Pulpo",
    "muertes": 2,
    "tiempo": 90,
    "completado": true
  }
}
```

- `completado` es obligatorio. Si el juego todavía no lo envía, el frontend
  asume `true` (comportamiento histórico) y emite un aviso por consola.
- `nivelId` y `escena` son opcionales. La web resuelve el nivel así:
  1. `nivelId` del mensaje, si existe en `/api/niveles/`.
  2. `nivelId` de la pantalla desde la que se abrió el juego.
  3. `escena`, comparando el nombre del nivel.
- La puntuación **no** se envía: la calcula el backend a partir de
  `completado`, `tiempo` y `muertes`.

### `salirPanel`

El jugador ha pulsado salir. Si no se marcó como completada, se registra como
abandono (`completado: false`).

```json
{
  "type": "salirPanel",
  "datos": {
    "muertes": 1,
    "tiempo": 30,
    "completado": false
  }
}
```

`datos` es opcional. Si no llega, la web pide las estadísticas con
`{ "type": "solicitarDatos" }` y espera hasta 3 segundos antes de guardar el
abandono con los valores que tenga.

---

## Mensajes de la web → juego

| Mensaje | Campos | Cuándo se envía |
|---|---|---|
| `setPlayerName` | `nombre: string` | Al recibir `unityListo` |
| `cargarNivel` | `nivel: number` | Al recibir `unityListo`, si hay nivel seleccionado |
| `solicitarDatos` | — | Si `salirPanel` llega sin estadísticas |

Ejemplos:

```json
{ "type": "setPlayerName", "nombre": "jugador1" }
{ "type": "cargarNivel", "nivel": 3 }
{ "type": "solicitarDatos" }
```

---

## Modo compatibilidad legacy (temporal)

Mientras el build de Unity no envíe el contrato, el frontend traduce los
mensajes históricos antes de validarlos. Esta capa vive en
`frontend/src/game/unityProtocolLegacy.js` y **no** reparte lógica por
`Juego.jsx`.

- Tipos de stats aceptados: `stats`, `hudUpdate`, `gameStats`, `updateStats`,
  `finalStats`, `endStats`.
- Alias de campos: `deaths`/`muerte`/`vidasPerdidas`/`killCount`/`muertesTotales`
  → `muertes`; `time`/`segundos`/`timer`/`elapsedTime`/`playTime`/
  `tiempoTranscurrido` → `tiempo`; `completed`/`win`/`won`/`victoria`/`exito`
  → `completado`.
- Envoltorios: `stats`, `hud`, `estado`, `gameState`, `data`, `resultado`,
  `partida`, `final`, `finalStats`, `endStats`.
- La petición de stats envía las 9 variantes históricas, empezando por
  `solicitarDatos`.

Cada mensaje traducido emite un aviso por consola con el cambio aplicado. Para
desactivar la capa y exigir el contrato estricto:

```env
VITE_UNITY_LEGACY_COMPAT=false
```

En Docker se configura con `UNITY_LEGACY_COMPAT=false` (build-arg). El valor
por defecto es `true` para no romper builds antiguos.

> Esta capa es de transición: cuando el juego cumpla el contrato, desactívala y
> elimina `unityProtocolLegacy.js` y sus tests.

---

## Configuración del origen

`VITE_GAME_ORIGIN` debe apuntar al origen real del build de Unity, sin barra
final. En Docker se configura con `GAME_ORIGIN` y se inyecta a la vez en el
bundle de Vite y en la CSP de nginx (`frame-src`). Si ambos valores no
coinciden, el navegador bloquea el iframe o el frontend ignora los mensajes.

```env
GAME_ORIGIN=http://192.168.18.50:8080
```

`VITE_GAME_URL` permite usar una URL completa distinta (por ejemplo, un CDN),
pero **debe compartir origen con `VITE_GAME_ORIGIN`** para que los
`postMessage` pasen el filtro de `origin`.

---

## Ejemplo mínimo en Unity (C# / `.jslib`)

El puente de JavaScript debe enviar exactamente el contrato:

```js
// GameBridge.jslib
mergeInto(LibraryManager.library, {
  EnviarResultado: function (nivelId, muertes, tiempo, completado) {
    window.parent.postMessage({
      type: 'resultadoPartida',
      datos: {
        nivelId: nivelId,
        muertes: muertes,
        tiempo: tiempo,
        completado: completado === 1,
      },
    }, '*')
  },
})
```

> En producción, sustituye `'*'` por el origen de la web para restringir el
> destinatario del mensaje.
