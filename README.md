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
  teléfono como autoridad. La competencia con amigos va por el **ranking de Snapchat**: cada noche se manda el puntaje
  (`submitScore`) y el panel propio de Snapchat (`show()`), donde aparecen los amigos con sus Bitmojis, se abre al
  terminar cada noche y desde el botón dorado **🏆 AMIGOS** del menú y de los resultados. La API no deja leer ese
  ranking ni los Bitmojis de otros desde el juego: en los resultados propios se ve el Bitmoji 2D del jugador junto a su
  puntaje y el récord que Snapchat confirma (`bestScore`). Snapchat da **un solo ranking por Lens** (sin niveles).
  En escritorio el stub no tiene panel, así que el botón se oculta (`?board` lo muestra para revisar el diseño).
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
| Niveles | **Easy / Medium / Hard** en el menú (en una sala manda el del anfitrión). **Las cinco criaturas aparecen en todos los niveles** (cada una en su propio recorrido); lo que cambia es qué tan rápidos y atentos son los monstruos y **cuánta ayuda reparte la noche** (`DIFFICULTY` en `config.js`). **Easy**: 2 fantasmas y 5 criaturas lentas (1,5 m/s, te ven a 4,5 m, te frenan 3 s), un truco suelta 6 monstruos, 26 caramelos en las calles, 4 orbes (vuelven a los 8 s), gemas desde los 6 s y cada 8–12 s, tormenta de 12 caramelos/s. **Medium**: 2 fantasmas + 5 criaturas (1,9 m/s, te frenan 4 s), trucos de 7 monstruos, 22 caramelos, 3 orbes, gemas desde los 10 s cada 10–16 s, 10 caramelos/s. **Hard, difícil de verdad**: 4 fantasmas casi tan rápidos como correr (4,8 m/s contra 5; sólo la carrera automática te despega) que ven a 12 m, persiguen hasta 11 s y **apuntan adonde vas** para cortarte el paso; 5 criaturas rápidas (2,8 m/s, te ven a 8,5 m, te frenan 5 s); trucos de 8 monstruos; en la Madness los fantasmas corren más que vos y sólo el sprint escapa; 2 s de protección tras un golpe; 16 caramelos en las calles, 2 orbes (25 s para volver), una gema a la vez desde los 30 s y cada 30–40 s, monstruos espantados que vuelven a los 2 s y sólo sueltan lo que robaron, tormenta de 7 caramelos/s |
| Idioma | se elige en el menú con banderas: **🇺🇸 English, 🇦🇷 Español, 🇫🇷 Français, 🇩🇪 Deutsch** (cada uno escrito en su propio idioma; la bandera es la de la variante en que están escritos los textos: inglés americano, español rioplatense; dibujadas en SVG, `src/ui/flags.js`); se guarda con el perfil y la primera vez se usa el idioma del teléfono; todo el texto del juego (menú, cómo jugar, HUD, avisos, resultados) está en los cuatro; para probar: `?lang=de` |
| Cómo jugar | un **tutorial de 8 tarjetas** para quien no lee (moverse, cámara, golpear puertas, caramelos, monstruos, poderes, lluvia de dulces, ganar): cada una un dibujo animado grande hecho con piezas del juego (joystick, botón de la cámara que cambia 3ª/1ª persona, botón calabaza, caramelos, las cabezas de las criaturas recortadas de sus dibujos, gemas, la nube de tormenta que llueve caramelos) y una sola frase; se pasa con SIGUIENTE, los puntitos o deslizando; aparece solo antes de la primera noche (con SALTAR) y desde CÓMO JUGAR (`src/ui/tutorial.js`) |
| Casas | 8 casas; botón **TRICK OR TREAT!** cerca de la puerta; la autoridad tira una sola vez: **treat 70 %** (3–6 caramelos), **trick 20 %** (**de la casa sale una manada de monstruos** a perseguirte: 6 / 7 / 8 según el nivel, fantasmas y criaturas, que salen en abanico por la puerta y te persiguen 6 / 9 / 15 s; y una de cada cinco veces, además, **la casa te roba todos los caramelos**: ~4 % de las visitas; el escudo lo evita), **jackpot 10 %** (calabaza dorada + power-up); puerta animada para todos; **cooldown 15 s** compartido (farol dorado / violeta y contador sobre la puerta) |
| Caramelos | caramelo 1, piruleta 5, chocolate 10, calabaza dorada 25, caramelo arcoíris 50; flotan, giran y brillan; un caramelo no se cobra dos veces |
| Monstruos | fantasma: −10 caramelos (y se los guarda); **criaturas** (los dibujos del equipo, ver Arte; las cinco en todos los niveles): te frenan 3 / 4 / 5 s según el nivel; protección después de cada golpe (5 / 3,5 / 2 s según el nivel); patrulla → detección → persecución → ataque → retirada → retorno, o huida si los asusta una gema; las criaturas rodean paredes, fantasmas las atraviesan; no ven a un jugador convertido en fantasma; en Medium y Hard apuntan adelante de un jugador que corre |
| Gemas | **todas duran 20 s**; aparecen con un haz de luz (cuándo y cuántas, según el nivel), de clases distintas si hay dos; **gigante** (roja): crecés ×5 (alto como una casa; pasás por encima de árboles, faroles, cercas y tumbas sin trabarte; agarrás todo lo que está cerca de tus pies y los monstruos te ven desde lejos), los monstruos no te dañan, huyen, y al tocarlos los espantás (sueltan caramelos y vuelven un rato después); **ladrona** (verde): todos los monstruos huyen y al atrapar uno le robás lo que le haya quitado a los jugadores más un extra (15 / 10 / 0 según el nivel); **fantasma** (blanca): tu Bitmoji se vuelve un fantasma translúcido que flota, los monstruos (también la manada de un truco) no te ven ni te dañan, atravesás a los fantasmas y las paredes |
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
| Easy | 2267 | 0,4 | 2 | 7,3 |
| Medium | 672 | 5,1 | 25 | 3,3 |
| Hard | 164 | 27,2 | 86 | 0,6 |

Medido con las cinco criaturas en todos los niveles y la manada de monstruos de los trucos. En Easy el bot junta
más que antes porque, con más monstruos cerca, la gema gigante y la ladrona espantan más (cada uno suelta caramelos).

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

**Monstruos.** El fantasma (translúcido, ojos que se encienden en rojo al perseguirte, azul cuando huye) y **cinco
criaturas hechas con los dibujos del equipo** (`art/creatures/`, de frente y en pose T, convertidos por
`npm run creatures`): la *nena del gato* (melena castaña, anteojos enormes, vestido con cuello blanco y un gatito
acostado en la cabeza), el de los *anteojos* (cabezota gris de pelo negro con anteojos redondos enormes, cuerpo de lata, brazos y piernas
de varilla, una bola con cable), la *dama de los labios* (azul, rulos violetas, una boca en el pecho y un vestido largo
que se vuelve fucsia abajo; se desliza sin piernas), el *gato* (cabeza de gato de ojos amarillos, bigotes, traje negro
y corbata blanca) y el *cuello largo* (orejas de murciélago, bigotes, cuello con manchas y jardinero).
Son marionetas 3D de teatro de papel, **macizas**: `npm run creatures` recorta cada dibujo de su fondo (también el
blanco de la cara del gato, que se confundía con el damero porque los bigotes blancos lo conectaban, y los huecos de
damero encerrados entre las varillas de las piernas del de los anteojos) y traza cada parte. Las cabezas, el torso de
lata, el de la dama y la bola se inflan desde su **contorno real** como una unión de esferas (la esfera más grande que
entra en cada punto), con los huecos rellenos: orejas, rulos y el gatito en el pelo de la nena tienen su propio
volumen y nada queda hueco al mirarlas de costado. Brazos, piernas, cuellos, vestido y torsos finos son tubos que
siguen el ancho del dibujo fila por fila; si el dibujo tiene huecos adentro (las piernas de varillas), quedan como una
ranura oscura, nunca un agujero. Adelante se ve el dibujo tal cual; **la espalda tiene su propia pintura** en la misma
textura (a la derecha, a media resolución): pelo, pelaje, lata o tela tejidos con parches del propio dibujo a su
escala real, que se funden con los colores del dibujo en el borde, así no hay costura. A la nena se le agregó un cuello
(debajo del mentón) para que no quede un hueco cuando ladea la cabeza. Las mallas de cada criatura se construyen una
sola vez y las comparten todas sus copias (un truco suelta muchas a la vez).
Los brazos van articulados en los hombros: cuelgan y se balancean al caminar, se estiran hacia adelante al
perseguirte y se agitan al huir; cada una mueve la cabeza a su manera (la cabezota de los anteojos se bambolea, el
cuello largo se mece, el gato ladea la cabeza), se inclina al perseguirte y tiembla, azulada, si una gema la asusta.
Ocupan el lugar del zombie (mismas reglas). **Las cinco están en todos los niveles**, cada una en su propio recorrido
(este, oeste, la calle norte, la calle sur y el cementerio); cuál camina cada recorrido rota de ronda en ronda, igual
en todos los dispositivos. Revisarlas de todos los lados: `dev/creatures.html?name=catgirl` (con `&anim=1`, `chase` o
`flee`).

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
| `src/ui/ui.js`, `i18n.js`, `tutorial.js`, `flags.js` | UIManager; textos en inglés, español, francés y alemán, con selector de idioma con banderas; el tutorial de tarjetas |
| `src/lib/` | envoltorio de la API de Snapchat, `bitmoji-anim.js` (MIT), descompresión meshopt (heredados de Cruise Rush) |

## Ícono y video para My Lenses

En `art/store/`, hechos con el juego mismo y con herramientas que se pueden volver a correr:

- **`icon.png`** (512×512): la cabeza del gato del equipo, recortada de su dibujo, delante de una luna de Halloween,
  con calabaza, chupetín y caramelos sobre la noche violeta del juego. Snapchat muestra los íconos en un círculo:
  todo queda adentro. `node tools/make-icon.mjs [salida.png] [criatura]` (otra criatura: `catgirl`, `lips`...).
- **`preview-en.mp4`** (9 s, 720×1280, 30 fps, H.264, sin sonido): el juego real en cinco tomas: el menú, un sprint
  con el imán de caramelos por la calle del cementerio, un truco en la puerta con la manada de monstruos saliendo,
  la tormenta de caramelos con rayos y la gema gigante. `npm run dev` y después
  `node tools/make-preview.mjs art/store/preview-en.mp4 --lang en` (`--lang es` para la versión en español,
  `--every 10` para ver sólo algunos cuadros). La página corre con un **reloj virtual**: cada cuadro avanza
  exactamente 1/30 s del juego (su reloj, sus timers y las animaciones CSS) y recién ahí se captura, así el video
  sale fluido aunque la máquina dibuje lento (con WebGL por software, unos segundos por cuadro).

## Estado y pendientes

- Probado en Chromium headless (WebGL por software): noche completa en solitario, controles táctiles y de teclado,
  carrera automática, cambio de cámara, casas, caramelos, power-ups, lluvia de caramelos, forma fantasma (atraviesa
  una casa y vuelve a ser sólida), gemas, Madness, fin a los 180 s, y una sala de 3 instancias (lobby,
  anfitrión único, inicio, posiciones, caramelo sin duplicar, cooldown compartido, mismo ranking, segunda ronda).
- **Pendiente de validar en un teléfono dentro de Snapchat** (sólo es posible después de la revisión de Snap):
  el Bitmoji real del jugador y su retrato, el leaderboard, el guardado, el rendimiento real y los márgenes seguros.
- Pendiente del equipo: activar el leaderboard de la Lens en My Lenses (el ícono y el video ya están, ver abajo).
- Build actual: ~5,8 MB descomprimido (zip 3,8 MB; `npm run pack` lo mantiene bajo 7,2 MB porque My Lenses cuenta
  ~10 % más que la suma de los archivos; límite 8 MB).
