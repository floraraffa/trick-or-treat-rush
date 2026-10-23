# Trick or Treat Rush 🎃

Juego de Halloween para el **Halloween Challenge de Lenslist**, hecho como **Snap Web Lens** sobre la misma base
que *Cruise Rush* (PlayCanvas + Vite + `@snap/web-lens-api`). Tu Bitmoji recorre un pueblo embrujado de cuento
gótico, golpea puertas (*¡dulce o truco!*), junta caramelos (o hace que lluevan del cielo), esquiva fantasmas y las criaturas dibujadas por el equipo
(o los espanta con una gema, o se vuelve fantasma y los atraviesa) y, en el último minuto, sobrevive a la
**Monster Madness**. Gana quien tenga más caramelos a los 3 minutos (180 segundos).

## Cómo correrlo

```bash
npm install
npm run dev            # http://localhost:3000 (vista de celular)
npm run pack           # build + chequeos de Snap → submission/trick-or-treat-rush-v<versión>.zip
npm test               # reglas de la autoridad (rápido, sin navegador)
npm run test:e2e       # además: una noche completa y una sala de 3 jugadores en Chromium headless
npm run textures       # vuelve a bajar y preparar las texturas de Poly Haven (necesita red)
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
| Niveles | **Easy / Medium / Hard** en el menú (en una sala manda el del anfitrión). Cada nivel fija los monstruos y **cuánta ayuda reparte la noche** (`DIFFICULTY` en `config.js`). **Easy**: 2 fantasmas y 1 criatura lentos, 26 caramelos en las calles, 4 orbes (vuelven a los 8 s), gemas desde los 6 s y cada 8–12 s, tormenta de 12 caramelos/s. **Medium**: 2 + 2, 22 caramelos, 3 orbes, gemas desde los 10 s cada 10–16 s, 10 caramelos/s. **Hard, difícil de verdad**: 4 fantasmas casi tan rápidos como correr (4,8 m/s contra 5; sólo la carrera automática te despega) que ven a 12 m, persiguen hasta 11 s y **apuntan adonde vas** para cortarte el paso; 3 criaturas; en la Madness los fantasmas corren más que vos y sólo el sprint escapa; 2 s de protección tras un golpe; 16 caramelos en las calles, 2 orbes (25 s para volver), una gema a la vez desde los 30 s y cada 30–40 s, monstruos espantados que vuelven a los 2 s y sólo sueltan lo que robaron, tormenta de 7 caramelos/s |
| Casas | 8 casas; botón **TRICK OR TREAT!** cerca de la puerta; la autoridad tira una sola vez: **treat 70 %** (3–6 caramelos), **trick 20 %** (sale un fantasma, te atrapa una telaraña o, una de cada cinco veces, **la casa te roba todos los caramelos**: ~4 % de las visitas; el escudo lo evita), **jackpot 10 %** (calabaza dorada + power-up); puerta animada para todos; **cooldown 15 s** compartido (farol dorado / violeta y contador sobre la puerta) |
| Caramelos | caramelo 1, piruleta 5, chocolate 10, calabaza dorada 25, caramelo arcoíris 50; flotan, giran y brillan; un caramelo no se cobra dos veces |
| Monstruos | fantasma: −10 caramelos (y se los guarda); **criaturas** (los dibujos del equipo, ver Arte): te frenan 5 s; protección después de cada golpe (5 / 3,5 / 2 s según el nivel); patrulla → detección → persecución → ataque → retirada → retorno, o huida si los asusta una gema; las criaturas rodean paredes, fantasmas las atraviesan; no ven a un jugador convertido en fantasma; en Medium y Hard apuntan adelante de un jugador que corre |
| Gemas | **todas duran 20 s**; aparecen con un haz de luz (cuándo y cuántas, según el nivel), de clases distintas si hay dos; **gigante** (roja): crecés ×7 (más alto que las casas; agarrás todo lo que está cerca de tus pies y los monstruos te ven desde lejos), los monstruos no te dañan, huyen, y al tocarlos los espantás (sueltan caramelos y vuelven un rato después); **ladrona** (verde): todos los monstruos huyen y al atrapar uno le robás lo que le haya quitado a los jugadores más un extra (15 / 10 / 0 según el nivel); **fantasma** (blanca): tu Bitmoji se vuelve un fantasma translúcido que flota, los monstruos no te ven ni te dañan, atravesás a los fantasmas, las paredes y las telarañas |
| Power-ups | **todos duran 20 s**: **tormenta de caramelos** (una nube negra te sigue, caen rayos con destello, trueno y lluvia, y **llueven caramelos del cielo**: 12 / 10 / 7 por segundo según el nivel, unos 200 en Medium; se agarran al tocar el suelo y los que nadie agarra se desvanecen a los 8 s; los demás jugadores ven tu nube y también pueden agarrarlos), escudo mágico (para un ataque), **imán** (atrae caramelos desde **16 m**: vuelan hacia vos), caramelos dobles; un orbe guardado en la ranura para el botón POWER-UP (si ya tenés uno, el orbe que tocás se activa en el acto: siempre se pueden agarrar); indicadores en el HUD y auras visibles para todos; se reinician en cada ronda |
| Madness | "MONSTER MADNESS!", campanadas de medianoche, más niebla, luna roja, faroles que titilan, monstruos más rápidos (×1,1 / ×1,2 / ×1,3), caramelos especiales |
| Cámara | estilo GTA: **tercera persona** (detrás y arriba, órbita con el dedo derecho, pellizco para la distancia, se recentra al caminar, las paredes no tapan la vista) y **primera persona** (altura de los ojos, el cuerpo se oculta); botón **CAMERA**; local, nunca se sincroniza |
| Controles | joystick izquierdo (empujar poco = caminar, a fondo = correr); **carrera automática**: si seguís para el mismo lado 1,1 s, el Bitmoji acelera solo hasta ×1,5 la velocidad de correr (7,5 m/s, más que cualquier monstruo); al frenar o girar más de 100° vuelve al paso del joystick. Sin botón de sprint. Mirar con el lado derecho, TRICK OR TREAT / POWER-UP / CAMERA abajo a la derecha. Teclado: WASD (+ Shift para correr), E, Espacio, C |

## Dificultad medida

Una ronda de 3 minutos con un jugador simulado que juega como una persona: agarra gemas y orbes, usa los power-ups
en el acto, golpea las puertas listas que tiene cerca, persigue monstruos cuando es gigante o ladrón, los ignora
cuando es fantasma y si no, junta caramelos y escapa del monstruo que lo persigue, con la carrera automática
(30 rondas por nivel, simulación de la autoridad en Node). Es un bot: sirve para comparar niveles, no para predecir a
una persona.

| Nivel | caramelos al final | golpes de monstruos | caramelos perdidos por golpes | gemas agarradas |
|---|---|---|---|---|
| Easy | 1537 | 1,2 | 9 | 8,8 |
| Medium | 874 | 3,5 | 24 | 6,0 |
| Hard | 117 | 31,0 | 87 | 0,3 |

La versión anterior de Hard (3 fantasmas a 3,6 m/s, la misma ayuda que los otros niveles) daba 635 caramelos y 9
golpes con este mismo bot, contra 703 y 1,7 en Easy: con las gemas y power-ups de 20 s casi no se notaba la
diferencia.

## Arte

La noche tiene volumen: **niebla por altura** en el shader de cada material (`src/world/heightfog.js`), espesa y
pálida a ras del suelo, más fina al subir, en bancos que derivan con el viento: la base de las casas y las tumbas se
pierde en la bruma y los techos asoman. Los faroles brillan en ella con un halo suave. Todo el pueblo se genera
por código en el arranque (sin modelos que descargar): casas altas y torcidas que se
inclinan al subir, techos en aguja con punta enroscada, chimeneas curvas, ventanas irregulares encendidas, puertas
enormes, escalones asimétricos, cercas torcidas, árboles con ramas como manos y raíces grandes, cementerio victoriano
con reja de lanzas y mausoleo, torre-reloj (sus agujas van de las 11:57 a la medianoche durante la ronda), hongos
luminosos, flores oscuras, topiarios raros, calabazas deformadas y talladas. Paleta violeta / azul petróleo / negro
azulado / lavanda / musgo / rosa empolvado con naranja calabaza, amarillo cálido, dorado viejo y rojo oscuro.
Texturas fotográficas CC0 de Poly Haven **con normal maps** (relieve con la luz): tablas de las fachadas, pizarras de
los techos, adoquines con musgo, lajas de la plaza, mampostería de cimientos, chimeneas, mausoleo y torre, piedra,
corteza y el musgo del suelo (1024 px), con oclusión ambiental horneada en el color, desaturadas y teñidas por
vértice con la paleta (`tools/fetch-textures.mjs`). **Son modelos procedurales hechos para este juego, no
arte final de un artista**: el equipo puede reemplazar piezas sin tocar la lógica.

Personajes: el Bitmoji 3D del jugador (vía API oficial; el Bitmoji por defecto de Snap si no tiene o falla), animado
con clips propios (`idle, walk, run, knock, hit, cheer, sad`) horneados por `npm run clips` desde `src/poses.js`.
Disfraces como piezas aparte sobre las articulaciones de la cabeza o la espalda, medidas sobre las mallas de cada
Bitmoji (no modifican el avatar), con materiales de verdad: **sombrero de bruja** de terciopelo arrugado con la punta
caída, cinta de satén y hebilla de bronce; **calabaza** con gajos marcados, tallada y encendida por dentro; **cuernos**
brillantes con anillos, rojo oscuro a negro en la punta; **vampiro**: capa de terciopelo negro forrada de satén rojo,
pegada a la espalda (se ajusta a la espalda medida de cada Bitmoji y se balancea un poco al correr), con puntas en el
borde, cuello alto de Drácula y cadena dorada con medallón. En el menú, el vampiro tiene su cara dibujada
(`src/ui/vampire.js`).

**Monstruos.** El fantasma (translúcido, ojos que se encienden en rojo al perseguirte, azul cuando huye) y **cuatro
criaturas hechas con los dibujos del equipo** (`art/creatures/`, convertidos por `npm run creatures`): el *cuello
largo* (orejas de murciélago, bigotes, cuello con manchas y jardinero; le agregamos piernas para caminar), el de los
*anteojos* (cabeza enorme sobre un resorte, cuerpo de lata, patas y brazos de varilla, una bola con cable), la
*muñeca* (melena negra, ojos enormes, cuerpo de esqueleto con brazos y piernas larguísimos) y la *boca* (cabecita de
rulos sobre un cuello de hilo, la gran máscara con labios y un cuerpo de tronco con raíces que se desliza sin piernas).
Son marionetas 3D de teatro de papel: cada parte es un recorte del dibujo inflado como almohadón (o una varilla, un
resorte, una bola) que muestra el dibujo tal cual visto de frente; por detrás y de costado, un color liso (pelo,
tela, lata). Cada una camina o se desliza a su manera, se inclina al perseguirte y tiembla, azulada, si una gema la
asusta. Ocupan el lugar del zombie (mismas reglas); cuál aparece se decide por el número del monstruo y de la ronda,
igual en todos los dispositivos, y rota de ronda en ronda: en Hard hay tres a la vez, en Medium dos, en Easy una.

Rayos de la tormenta: un canal nuevo en cada descarga (desplazamiento de punto medio, con ramas), cintas planas
vueltas a la cámara con núcleo blanco y halo azulado, 3–4 parpadeos en 0,4 s, y una luz que ilumina el suelo, la nube
desde adentro y el pueblo con cada parpadeo.

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
  carrera automática, cambio de cámara, casas, caramelos, power-ups, lluvia de caramelos, forma fantasma (atraviesa
  una casa y vuelve a ser sólida), gemas, Madness, fin a los 180 s, y una sala de 3 instancias (lobby,
  anfitrión único, inicio, posiciones, caramelo sin duplicar, cooldown compartido, mismo ranking, segunda ronda).
- **Pendiente de validar en un teléfono dentro de Snapchat** (sólo es posible después de la revisión de Snap):
  el Bitmoji real del jugador y su retrato, el leaderboard, el guardado, el rendimiento real y los márgenes seguros.
- Pendiente del equipo: ícono 512×512, video de preview 720×1280, activar el leaderboard de la Lens en My Lenses.
- Build actual: ~5,1 MB descomprimido (zip 3,2 MB; `npm run pack` lo mantiene bajo 7,2 MB porque My Lenses cuenta
  ~10 % más que la suma de los archivos; límite 8 MB).
