# Trick or Treat Rush 🎃

Juego de Halloween para el **Halloween Challenge de Lenslist**, hecho como **Snap Web Lens** sobre la misma base
que *Cruise Rush* (PlayCanvas + Vite + `@snap/web-lens-api`). Tu Bitmoji recorre un pueblo embrujado de cuento
gótico, golpea puertas (*¡dulce o truco!*), junta caramelos, esquiva fantasmas y zombies y, en el último minuto,
sobrevive a la **Monster Madness**. Gana quien tenga más caramelos a los 180 segundos.

## Cómo correrlo

```bash
npm install
npm run dev            # http://localhost:3000 (vista de celular)
npm run pack           # build + chequeos de Snap → submission/trick-or-treat-rush-v<versión>.zip
npm test               # reglas de la autoridad (rápido, sin navegador)
npm run test:e2e       # además: una noche completa y una sala de 3 jugadores en Chromium headless
```

**Jugarlo sin Snapchat:** `npm run artifact -- <carpeta>` arma una versión para publicar como página de claude.ai
(los `.glb` van como `.glb.json`, que esas páginas sí sirven). Ahí la sala se abre con `#room-NOMBRE` al final del link.

Parámetros de desarrollo: `?room=NOMBRE` (sala multijugador, ver abajo), `?name=Ana`, `?costume=witch|pumpkin|horns|cape|none`,
`?inset=120` (simula los controles de Snapchat arriba), `?lowfx` (sin post-procesado ni sombras, para celulares lentos),
`?debug` (panel de diagnóstico y ganchos de prueba), `?autostart`, `?bitmoji=./otro.glb`, `?camdist=6`.
Diagnóstico en el teléfono: tocar el título 5 veces.

## Multijugador: qué permite la plataforma y qué hace el juego

**Limitación oficial.** Una Web Lens no tiene red en tiempo de ejecución: el CSP de la Lens bloquea `fetch`,
WebSocket y WebRTC, y la API oficial (`@snap/web-lens-api` 0.1.2, la última publicada) sólo ofrece `bitmoji`,
`leaderboards` y `storage`. El parámetro `participant` (Bitmoji de otra persona) está reservado y se rechaza con
`ERR_INVALID_PARAMS`. Connected Lenses existe sólo en Lens Studio, no en Web Lenses. **Por eso, dentro de Snapchat
no es posible hoy jugar en vivo entre teléfonos.**

**Lo que sí está construido**, sin simular jugadores:

- **Arquitectura multijugador real con autoridad única** (`src/game/authority.js`): un solo dispositivo (el anfitrión)
  tiene el reloj de la ronda y el único generador de azar; decide cada visita a una casa (70 / 20 / 10), cada caramelo
  (un id, un dueño), los monstruos, los power-ups y el ranking. Los demás le mandan pedidos y reflejan sus **eventos
  numerados** (sin duplicados) y **snapshots a 10 Hz**; las posiciones van a 15 Hz con interpolación.
- **Dentro de Snapchat** la sesión es de un jugador por teléfono (`LoopbackTransport`): el mismo código, con el
  teléfono como autoridad. La competencia con amigos va por el **leaderboard de Snapchat** (`submitScore` + el panel
  nativo `show()`), que se abre al terminar cada noche.
- **Salas de 2 a 4 jugadores** con `?room=NOMBRE` (`BroadcastTransport`): instancias del juego separadas y reales
  (ventanas o pestañas del mismo navegador de escritorio), cada una con su jugador, su entrada y su cámara; lobby con
  nombres, anfitrión que inicia, 3-2-1-GO compartido, final y ranking iguales para todos. Sirve para jugar y para
  **probar el protocolo de verdad** (`tests/room.mjs`). Si Snap publica una capacidad de red para Web Lenses, sólo
  cambia `src/net/transport.js`.
- Los demás jugadores se ven con el **Bitmoji por defecto de Snap** + su disfraz y nombre: la API no entrega el
  Bitmoji de otra persona.

## Reglas implementadas

| Sistema | Detalle |
|---|---|
| Ronda | 3-2-1-GO, **180 s exactos** (reloj real del anfitrión), últimos 60 s **Monster Madness**, fin compartido y puntajes bloqueados |
| Casas | 8 casas; botón **TRICK OR TREAT!** cerca de la puerta; la autoridad tira una sola vez: **treat 70 %** (3–6 caramelos), **trick 20 %** (sale un fantasma o te atrapa una telaraña), **jackpot 10 %** (calabaza dorada + power-up); puerta animada para todos; **cooldown 15 s** compartido (farol dorado / violeta y contador sobre la puerta) |
| Caramelos | caramelo 1, piruleta 5, chocolate 10, calabaza dorada 25, caramelo arcoíris 50; flotan, giran y brillan; un caramelo no se cobra dos veces |
| Monstruos | fantasma: −10 caramelos y protección de 2,5 s; zombie: te frena 5 s; patrulla → detección → persecución → ataque → retirada → retorno; zombies rodean paredes, fantasmas las atraviesan; **fantasma gigante** en la Madness que persigue al líder |
| Power-ups | velocidad ×2 (8 s), escudo mágico (para un ataque), imán de caramelos (8 s), caramelos dobles (10 s); un orbe por vez en la ranura, botón POWER-UP; indicadores en el HUD y auras visibles para todos; se reinician en cada ronda |
| Madness | "MONSTER MADNESS!", campanadas de medianoche, más niebla, luna roja, faroles que titilan, monstruos ×1,35, caramelos especiales, fantasma gigante |
| Cámara | estilo GTA: **tercera persona** (detrás y arriba, órbita con el dedo derecho, pellizco para la distancia, se recentra al caminar, las paredes no tapan la vista) y **primera persona** (altura de los ojos, el cuerpo se oculta); botón **CAMERA**; local, nunca se sincroniza |
| Controles | joystick izquierdo (empujar poco = caminar, a fondo = correr), mirar con el lado derecho, TRICK OR TREAT / POWER-UP / CAMERA abajo a la derecha. Teclado: WASD + Shift, E, Espacio, C |

## Arte

Todo el pueblo se genera por código en el arranque (sin modelos que descargar): casas altas y torcidas que se
inclinan al subir, techos en aguja con punta enroscada, chimeneas curvas, ventanas irregulares encendidas, puertas
enormes, escalones asimétricos, cercas torcidas, árboles con ramas como manos y raíces grandes, cementerio victoriano
con reja de lanzas y mausoleo, torre-reloj (sus agujas van de las 11:57 a la medianoche durante la ronda), hongos
luminosos, flores oscuras, topiarios raros, calabazas deformadas y talladas. Paleta violeta / azul petróleo / negro
azulado / lavanda / musgo / rosa empolvado con naranja calabaza, amarillo cálido, dorado viejo y rojo oscuro.
Texturas fotográficas CC0 de Poly Haven teñidas por vértice. **Son modelos procedurales hechos para este juego, no
arte final de un artista**: el equipo puede reemplazar piezas sin tocar la lógica.

Personajes: el Bitmoji 3D del jugador (vía API oficial; el Bitmoji por defecto de Snap si no tiene o falla), animado
con clips propios (`idle, walk, run, knock, hit, cheer, sad`) horneados por `npm run clips` desde `src/poses.js`.
Disfraces (sombrero de bruja, sombrero-calabaza, cuernos, capa) como piezas aparte sobre las articulaciones de la
cabeza o la espalda, medidas sobre las mallas de cada Bitmoji: no modifican el avatar.

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `src/main.js` | GameManager: arranque, bucle, pantallas, eventos de la ronda, HUD, guardado, leaderboard |
| `src/game/authority.js` | autoridad de sesión: RoundTimer, reglas de casas, caramelos, puntajes, power-ups, IA de monstruos, Madness, ranking |
| `src/game/view.js` | GameStateManager: espejo del estado en cada dispositivo + interpolación |
| `src/game/config.js` | todas las reglas y números |
| `src/net/session.js`, `transport.js` | MultiplayerManager: sala, anfitrión, pedidos, eventos, snapshots, poses |
| `src/actors/avatar.js` | PlayerSpawner: Bitmoji propio / por defecto, figura sustituta, disfraces |
| `src/actors/player.js` | BitmojiPlayerController |
| `src/camera.js` | CameraModeController |
| `src/actors/monsters.js`, `candy.js`, `effects.js` | monstruos, caramelos y orbes, auras de power-ups (lado visual) |
| `src/world/layout.js` | plano del pueblo (datos puros compartidos), colisionadores, rutas de patrulla |
| `src/world/village.js`, `houses.js`, `props.js`, `sky.js`, `shapes.js`, `collide.js` | escenario, iluminación, cielo, geometría, colisiones |
| `src/ui/ui.js`, `i18n.js` | UIManager; textos en inglés, español y francés |
| `src/lib/` | envoltorio de la API de Snapchat, `bitmoji-anim.js` (MIT), descompresión meshopt (heredados de Cruise Rush) |

## Estado y pendientes

- Probado en Chromium headless (WebGL por software): noche completa en solitario, controles táctiles y de teclado,
  cambio de cámara, casas, caramelos, power-ups, Madness, fin a los 180 s, y una sala de 3 instancias (lobby,
  anfitrión único, inicio, posiciones, caramelo sin duplicar, cooldown compartido, mismo ranking, segunda ronda).
- **Pendiente de validar en un teléfono dentro de Snapchat** (sólo es posible después de la revisión de Snap):
  el Bitmoji real del jugador y su retrato, el leaderboard, el guardado, el rendimiento real y los márgenes seguros.
- Pendiente del equipo: ícono 512×512, video de preview 720×1280, activar el leaderboard de la Lens en My Lenses.
- Build actual: ~3,9 MB descomprimido (límite 8 MB).
