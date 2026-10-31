# Trick or Treat Rush: assets y datos para Meta Quest

Este paquete sale del juego del teléfono (Snap Web Lens, PlayCanvas) con `npm run quest:bundle`. Es para llevar el
juego, o partes, a un proyecto de **Unity para Meta Quest**: los modelos se arrastran a Unity, y los datos y el
código de referencia los puede leer cualquier chat o programador para rehacer la lógica.

## El juego, en corto

Tu avatar recorre un pueblo embrujado de casas torcidas (estilo Tim Burton), golpea puertas (dulce o truco), junta
caramelos y esquiva monstruos: un fantasma y cinco criaturas dibujadas por el equipo. Los últimos 30 segundos son
la **Monster Madness**. Se juega en **8 noches de 90 segundos**, cada una con 3 estrellas posibles, una destreza
nueva y **su propio barrio**:

| Noche | Barrio (`id`) | Lo que tiene |
|---|---|---|
| 1 | Barrio italiano (`italy`) | campanarios, balcones con flores, ropa tendida, cipreses, la torre inclinada |
| 2 | Barrio francés (`france`) | mansardas, toldos, plátanos, faroles dobles, la torre de hierro |
| 3 | Nueva York (`newyork`) | brownstones, escaleras de incendio, tanques de agua, rascacielos con reloj |
| 4 | Buenos Aires (`buenosaires`) | casas de chapa de colores, fileteado, jacarandás, el obelisco |
| 5 | La maqueta (`modeltown`) | rayas blanco y negro, neón, gusanos rayados, una lamparita en vez de luna |
| 6 | Polo Norte (`northpole`) | nieve, carámbanos, guirnaldas, pinos, auroras boreales |
| 7 | Transilvania (`transylvania`) | almenas, gárgolas, antorchas, luna roja enorme |
| 8 | Ciudad cyberpunk (`cyberpunk`) | casas apiladas en torres con neón y carteles, rascacielos, mega-torre con reloj, **autos voladores, taxis y patrulleros** |
| — | El pueblo clásico (`classic`) | el original (rondas de nivel) |
| — | La Luna (`moon`) | cúpulas, cohete, cráteres (era la noche 8; queda de extra) |

El plano es el mismo en todos los barrios (casas, puertas, calles, colisiones), así que las reglas no cambian.

## Qué hay en cada carpeta

- `Models/QuestVillages/village-<id>.glb`: cada barrio **completo y con texturas** (1024 px, con normal maps):
  piso, calles, plaza, casas, árboles, faroles, monumento, adornos. Cortado a 39 m de radio, como en Spectacles.
  Sin cielo, sin luces y sin el tránsito (ver abajo). 1 unidad = 1 metro.
- `Models/QuestVillages/vehicles.glb`: los autos voladores, uno de cada uno, a 5 m entre sí sobre +X, la trompa hacia
  +Z: `vehicle-car-0`, `vehicle-car-1`, `vehicle-car-2` (rojo, turquesa, plateado), `vehicle-taxi`,
  `vehicle-police` (con `police-red` y `police-blue`, las dos mitades de la baliza, para prender una y otra).
- `Models/ghost.glb`, `Models/creature-<nombre>.glb` (catgirl, goggles, lips, catman, longneck): los monstruos.
- `Models/pickups.glb` (caramelos, orbes de poder, gemas), `Models/fx.glb` (niebla, luna, estrellas, fuegos
  fatuos, murciélagos, nube de tormenta y rayos, brillos, anillos de poder), `Models/costumes.glb` (sombrero de
  bruja, calabaza, cuernos, capa de vampiro), `Models/ui.glb` (las placas de los menús, como en Spectacles).
- `Audio/*.wav`: sonidos y música (todos sintetizados por el juego) y `night.wav`, el ambiente de noche en loop.
  `Audio/voice-*.mp3`: los gritos del avatar (ver permisos abajo).
- `Fonts/*.ttf`: Griffy y Mystery Quest (licencia OFL).
- `Animation/TrickOrTreatMoves.fbx`: los movimientos del juego (idle, walk, run, knock, hit, cheer, sad) como FBX
  **Humanoid** (nombres de huesos estilo Mixamo), para reasignar en Unity al rig que uses (Meta Avatars incluido).
- `Data/*.json`: todas las reglas (`rules.json`: niveles, noches, estrellas, destrezas, gemas, poderes, monstruos),
  el plano del pueblo (`layout.json`: casas, puertas, colisionadores, lugares de caramelos y orbes, recorridos de
  los monstruos, spawns, faroles, árboles), los barrios (`neighbourhoods.json`), el tránsito (`traffic.json`) y los
  textos en inglés, español, francés y alemán (`texts.json`).
- `CSharp/Rules/`: **las reglas del juego en C#** (namespace `TrickOrTreat.Rules`, C# puro, sin Unity, con su
  `.asmdef`): `Authority.cs` (decide todo: reloj, casas, caramelos, monstruos, poderes, gemas, Madness, ranking),
  `View.cs` (lo que ve cada dispositivo), `PlayerController.cs`, `Collide.cs`, `Rng.cs`, `Config.cs`, etc., y en
  `Generated/` los números de las reglas y el plano (`RulesData.cs`), los textos (`TextsData.cs`) y los paneles
  (`UiData.cs`). Es el puerto a mano del juego web, **comprobado línea por línea contra 13 partidas de referencia
  del juego actual** (3 niveles, las 8 noches, 2 y 3 jugadores).
- `CSharp/Look/`: para Unity (usa `UnityEngine`, namespace `TrickOrTreat.Look`): `NeighbourhoodsData.cs` (colores
  de cielo, niebla, luz de luna y faroles de cada barrio, en calma y en la Madness) y `TrafficData.cs` (los
  carriles y una función `Pose` que ya da posición y rotación en el espacio de Unity).
- `CSharp/Examples/FlyingTraffic.cs`: el ejemplo de abajo.
- `Reference/src/...`: el código del juego que arma todo eso (JavaScript): `world/` (el pueblo, los barrios
  `themes.js` + `hoods.js`, las casas, el tránsito `traffic.js`), `game/` (las reglas: `authority.js` decide todo,
  `config.js` los números), el jugador, los monstruos, los caramelos, los efectos. Es para leer y portar.
- `Previews/`: capturas de los barrios, para ver cómo se ven.

## En Unity

1. Instalá **glTFast** (`com.unity.cloud.gltfast`) y arrastrá los `.glb` a `Assets/`. Los colores de cada pieza
   vienen como **colores de vértice** multiplicados por la textura: si algo se ve todo blanco o gris, el shader no
   está usando los colores de vértice.
2. **Ejes:** glTFast pasa glTF (mano derecha) a Unity invirtiendo X. Un punto del juego `(x, y, z)` queda en
   `(-x, y, z)` en Unity, y los giros alrededor de Y y de Z van al revés. Los datos (`layout.json`,
   `RulesData.cs`) están en los ejes del juego: aplicá ese cambio al ubicar cosas. `TrafficData.Pose` ya lo aplica.
3. **Lo que se anima** (por nombre de nodo dentro de cada `village-<id>`):
   - `door-<id>` (id 0 a 7): la bisagra de cada puerta. En el juego abre girando en Y local hasta 105° (en Unity, con
     el cambio de ejes, para el otro lado).
   - `porch-lamp-<id>` (dorado: se puede golpear) y `porch-cool-<id>` (violeta, apagado de entrada: la casa está en
     espera de 15 s). Se muestra uno u otro.
   - `clock-<f>-minute` y `clock-<f>-hour` (f = 0 a 3, una por cara): las agujas del reloj de la plaza, que van de
     las 11:57 a medianoche durante la noche. Algunos monumentos no tienen reloj (la torre inclinada, la torre de
     hierro, el obelisco, el cohete).
   - `halo-<i>`: la cabeza de cada farol (ahí va una luz cálida y un brillo).
4. **Luz de cada barrio:** `Neighbourhoods.Of(id)` da el color del cielo (horizonte, medio, cenit), la niebla
   (color y densidad exponencial al cuadrado), la luz ambiente, la luz de luna y la de los faroles, tranquila y
   en la Monster Madness. La noche n se juega en `Neighbourhoods.OfNight(n)`.
5. **El tránsito de la ciudad cyberpunk:** instanciá un auto por cada entrada de `Traffic.FLEET` (su modelo es
   `car.Model`) y movelo así:

```csharp
using TrickOrTreat.Look;
using UnityEngine;

public class FlyingTraffic : MonoBehaviour {
  public Transform vehicles; // vehicles.glb ya instanciado (se usa como molde, queda oculto)
  Transform[] cars; Transform[] red, blue;

  void Start() {
    int n = Traffic.FLEET.Length;
    cars = new Transform[n]; red = new Transform[n]; blue = new Transform[n];
    for (int i = 0; i < n; i++) {
      var car = Instantiate(vehicles.Find(Traffic.FLEET[i].Model), transform);
      car.localPosition = Vector3.zero;
      cars[i] = car; red[i] = car.Find("police-red"); blue[i] = car.Find("police-blue");
    }
    vehicles.gameObject.SetActive(false);
  }

  void Update() {
    for (int i = 0; i < cars.Length; i++) {
      Traffic.Pose(Traffic.FLEET[i], Time.time, out var p, out var r);
      cars[i].localPosition = p; cars[i].localRotation = r;
      if (red[i] != null) { bool on = Traffic.PoliceRed(Time.time, Traffic.FLEET[i]); red[i].gameObject.SetActive(on); blue[i].gameObject.SetActive(!on); }
    }
  }
}
```

   (Este ejemplo compila contra Unity 6 pero no se probó en Unity; poné el objeto en el mismo lugar que el pueblo,
   que es donde se miden los carriles. Los autos son solo decorado: ninguna regla los usa.)

## Permisos y licencias

- Texturas: fotos de **Poly Haven** (CC0). Fuentes: **OFL**. Modelos, sonidos y código: del equipo (ver `CREDITS.md`).
- Los **gritos** (`voice-*`) salen de un video de Lenslist, usados con su permiso para el juego. Confirmen que ese
  permiso cubre también la versión de Quest.
- **No está el Bitmoji**: el avatar por defecto es de Snap y no se puede usar fuera de Snapchat. En Quest va el
  avatar del jugador (Meta Avatars) u otro personaje.
- "La maqueta" y la "ciudad cyberpunk" están inspiradas en un estilo, no copian ninguna película: no usen nombres
  de películas en el juego.
