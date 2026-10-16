# Diagnóstico de la búsqueda por ISBN y comparación con Google Books (2026-10-15)

Encargo: evaluar la fiabilidad de la búsqueda por ISBN (manual y con cámara), que según el usuario no devuelve resultados ni con *Harry Potter* ni con *Dune*, y compararla con una migración a Google Books API. **No se cambió código**: este documento recoge lo medido, lo que no se pudo comprobar y la estrategia recomendada.

## 1. Resumen

| Pregunta | Respuesta |
|---|---|
| ¿Falla el servicio actual desde el código? | **No se reproduce.** Con la red real, el servicio actual (Open Library) devolvió datos correctos para los 7 ISBN de Harry Potter, Dune y otros libros que sí están en su catálogo (el octavo, tomado de memoria, no está), con 0 fallos en 12 consultas repetidas |
| ¿Entonces por qué falla en el celular? | **Causa identificada (§9): cobertura.** El mensaje que ve el usuario es «no encontrado» (HTTP 200 con `{}`, no un fallo de red) y el ISBN `9789585234048` es válido pero **Open Library no lo tiene** en ninguna de sus tres rutas. El otro ISBN probado (`9799585579972`) tiene un dígito de control incorrecto |
| ¿Es culpa del escáner? | **Muy improbable.** Falla igual a mano y con la cámara, y ambos caminos terminan en la misma consulta; el escáner entrega el ISBN ya validado |
| ¿Google Books arregla esto? | **No está demostrado.** Sin clave responde `429` con cuota diaria `0`; con clave no se pudo probar (no se creó ninguna sin permiso) |
| Recomendación | No migrar a ciegas. Primero obtener la causa real; si es de cobertura, **combinar**: Open Library primero y Google Books como segunda consulta (ver §7) |

## 2. Cómo está hecho hoy

- Proveedor: **Open Library**, endpoint `https://openlibrary.org/api/books?bibkeys=ISBN:<isbn13>&jscmd=data&format=json`, sin clave. Solo `services/bookCatalogService.ts` lo conoce (`findBookByIsbn`, `parseOpenLibraryResponse`).
- Cabeceras: `Accept: application/json` y `User-Agent: Lectoria` (`EXPO_PUBLIC_OPENLIBRARY_CONTACT` **no** está definido en `.env`, así que no se añade contacto).
- Tiempo máximo: 8 s (`AbortController`). Respuesta `429` → «demasiadas consultas»; cualquier otro fallo (sin red, tiempo agotado, HTTP ≠ 2xx, JSON ilegible) → `lectoria/catalog-unavailable`.
- Un ISBN que Open Library no conoce llega como `{}` con HTTP 200 → «No encontramos ese ISBN. Rellena los datos a mano.»
- `fetch` en SDK 57 es el de `expo/fetch` (cliente nativo), no el de React Native clásico.
- Dos mensajes distintos que el usuario puede estar llamando «sin resultados»: **«No encontramos ese ISBN…»** (el catálogo no tiene esa edición) y **«No se pudo consultar el catálogo…»** (fallo de red o del servicio). Tienen causas y arreglos diferentes.

## 3. Qué se midió (todo ejecutado el 2026-10-15, desde un PC con la red real)

### 3.1 El servicio actual, tal cual, contra Open Library

Se ejecutó `findBookByIsbn` real (con una petición `https` de Node y las mismas cabeceras):

| ISBN | Obra | Resultado |
|---|---|---|
| 9788478884452 | Harry Potter y la piedra filosofal (es) | Título, autor, 254 págs., portada |
| 9780747532743 | Harry Potter and the Philosopher's Stone | Título, autor, portada |
| 9780439708180 | Harry Potter and the Sorcerer's Stone | Título, autor, 784 págs., portada |
| 9780441172719 | Dune (Ace) | Título, autor, 896 págs., portada |
| 9780593099322 | Dune: Deluxe Edition | Título, autor, 688 págs., portada |
| 9788478887194 / 9788437604947 | El principito / Cien años de soledad | Datos correctos |
| 9788497596268 | Dune (supuesto Debolsillo, ISBN tomado de memoria) | **No encontrado** (`{}`) |

- **Fiabilidad y latencia:** 12 consultas seguidas de Dune → 0 fallos; 184 ms mínimo, 269 ms mediana, 603 ms máximo (una consulta suelta tardó 3,9 s, dentro del límite de 8 s).
- **Procesamiento:** `parseOpenLibraryResponse` extrae bien todos los casos; las 634+ pruebas unitarias del proyecto, que incluyen las del catálogo, pasan.

### 3.2 Alternativas dentro de Open Library

Para 48 ISBN reales de ediciones de Harry Potter y Dune (en español e inglés, tomados de su propia búsqueda) se probaron tres rutas: `api/books` (la actual), `/isbn/{isbn}.json` y `search.json?q=isbn:`. Las tres resolvieron **48/48**. **Limitación importante:** al salir los ISBN del propio catálogo, esto prueba que las rutas son coherentes entre sí, **no** mide la cobertura real frente a libros que la persona tiene en la mano.

Con 10 ISBN de ediciones tomados de memoria (todos con dígito de control válido, que no prueba que existan): 6 se resolvieron y 4 (ediciones españolas/latinoamericanas de Dune) **no** salieron en ninguna de las tres rutas. Es un indicio, no una conclusión: pueden ser ISBN inventados por la memoria o ediciones ausentes de Open Library. Sí confirma que **cambiar de ruta dentro de Open Library no aumentaría la cobertura**: las tres coinciden.

### 3.3 Google Books API

- Sin clave (`GET https://www.googleapis.com/books/v1/volumes?q=isbn:9780441172719`): **HTTP 429**, `RESOURCE_EXHAUSTED`, cuota `defaultPerDayPerProject` con **límite 0**. Es decir, el uso anónimo está bloqueado en la práctica.
- Documentación oficial: las peticiones de datos públicos «must be accompanied by an identifier, which can be an API key or an access token»; buscar «does not require authentication». No indica precios ni cuotas numéricas.
- Condiciones de uso oficiales: «You may not charge users any fee for the use of your application» salvo acuerdo escrito con Google; obliga a retirar contenido bajo requerimiento y a ofrecer un contacto. No hay texto sobre caché ni portadas en esa página.
- Cuota por clave: fuentes no oficiales (foros) apuntan a **1000 consultas al día por proyecto** (no confirmado en documentación). La cuota sería **del proyecto, compartida por todos los usuarios de la app**, a diferencia de Open Library, que limita por IP/dispositivo.
- **No se pudo probar** con clave: crear una exige un cambio en la cuenta de Google Cloud (proyecto `lectoria-1208a`), que no se hizo sin autorización. Por tanto **no hay medición de cobertura, portadas ni latencia de Google Books**; lo que se dice de ellas arriba y abajo es conocimiento general sin verificar en este proyecto.

## 4. Revisión del escáner

Cadena: `CameraView` (solo `ean13`) → `parseIsbn(data)` → `navigation.popTo('AddBook', { scannedIsbn })` → `BookForm.runLookup` → **la misma `findBookByIsbn`** que el campo manual.

- Lectura: `ean13` es el tipo correcto de los códigos de barras de libros (978/979). Un código que no es de libro da «Ese código no es de un libro»; un dígito de control erróneo, «No se leyó bien».
- Validación: `parseIsbn` normaliza ISBN-10/13, comprueba el dígito de control y devuelve ISBN-13; cubierta por pruebas unitarias.
- Consulta: idéntica a la manual.
- **Conclusión:** como fallan los dos caminos y comparten solo la consulta, el origen está en la consulta (red, servicio o cobertura), no en la cámara. La cámara no se pudo ejercitar en este entorno (no hay dispositivo), así que su comportamiento físico queda sin verificar.

## 5. Comparación

| Criterio | Open Library (actual) | Google Books |
|---|---|---|
| Clave | No | **Sí** (sin ella, cuota 0); iría dentro de la app |
| Coste | Gratis; sin facturación | La documentación no da precio; sin facturar, cuota por defecto del proyecto (≈1000/día según foros, sin confirmar) |
| Cuota | Por IP; 1 petición/s (3 si se identifica con contacto) | Del proyecto, **compartida por todos los usuarios** |
| Cobertura bibliográfica | Muy buena en obras populares; **huecos en ediciones concretas, sobre todo en español** (indicio, §3.2) | **Sin medir.** Suele citarse como más amplia; no verificado aquí |
| Portada | Sí (`covers.openlibrary.org`, funciona) | Sin medir |
| Límites de calidad | Datos irregulares; sin géneros útiles | Sin medir |
| Restricciones de uso | Política: no servir un servicio comercial de mucho tráfico; el endpoint `api/books` se califica en su documentación de **«legacy… may be phased out»** | No cobrar a los usuarios por la app sin permiso; retirar contenido bajo requerimiento |
| Integración | Ya hecha y probada | Cliente nuevo + clave restringida. Una clave restringida por Android exige que cada petición lleve `X-Android-Package` y `X-Android-Cert` (el `fetch` de JS no los envía solo) (conocimiento general, sin verificar aquí) |
| Seguridad | Sin secretos | Clave en el APK: debe restringirse (aplicación y API) como las demás del proyecto |

## 6. Lo que falta saber (no asumido)

Para fijar la causa hace falta, en el celular:

1. **El mensaje exacto** que sale: «No encontramos ese ISBN…» o «No se pudo consultar el catálogo…».
2. **Los ISBN** (los 13 dígitos de la contraportada) de los libros que fallan, y si son ediciones en español.
3. Si falla con **todos** (incluido uno que aquí sí funciona, p. ej. `9780441172719`) o solo con algunos.
4. Qué build usa: la app de desarrollo de EAS o Expo Go, y si el celular tiene conexión normal (wifi vs datos).

Interpretación:
- Falla **también** `9780441172719` con «No se pudo consultar…» → problema de red o de cliente en el dispositivo (no de cobertura): Google Books no lo arreglaría.
- Solo fallan ediciones concretas con «No encontramos…» → problema de **cobertura**: ahí sí un segundo proveedor ayuda.

**Lagunas del código que impiden hoy saberlo:** el `catch` de `findBookByIsbn` descarta el error original (no hay `console.warn` ni estado HTTP), y todos los fallos se muestran con el mismo mensaje. En dispositivo no hay forma de distinguir un `429`, un tiempo agotado o un fallo de TLS.

## 7. Recomendación

1. **No migrar a Google Books a ciegas.** No hay prueba de que sea mejor para este problema y trae una clave pública, una cuota compartida y restricciones de uso.
2. **Primero, diagnóstico en dispositivo (barato, no cambia el comportamiento):** registrar con `console.warn` (solo en desarrollo) el estado HTTP o el error al fallar la consulta, y obtener los datos de §6. Con eso se sabe en una prueba si es red o cobertura.
3. **Si es cobertura, combinar proveedores** (cambia solo `bookCatalogService.ts`, que ya aísla al proveedor): consultar Open Library; si responde «no encontrado», consultar Google Books; si ambos fallan, formulario manual (ya existe). Ventajas: sin clave ni cuota en el caso habitual, y la cuota compartida de Google solo se gasta en los huecos. Antes hay que **medir** Google Books con una clave restringida y los ISBN reales del usuario (requiere autorización para crear la clave y activar la API en el proyecto).
4. **Si es red/cliente**, corregir ahí (tiempo máximo, reintentos, `User-Agent`/contacto, o un segundo endpoint de Open Library como respaldo) sin sumar proveedor.
5. Mejoras menores a valorar con el arreglo: ruta `search.json`/`/isbn` como respaldo del endpoint «legacy», y mensajes diferenciados por causa.

## 8. Limitaciones de este diagnóstico

- Medido desde un PC, no desde el celular del usuario ni su red.
- La cámara y el comportamiento de `expo/fetch` en Android no se ejercitaron.
- La cobertura de Open Library frente a libros reales no se midió con una muestra independiente; la de Google Books, en absoluto.
- La cuota por defecto de Google Books con clave proviene de foros, no de la documentación oficial.

## 9. Actualización con los datos del usuario (2026-10-15)

Datos aportados: mensaje «No encontrado ese ISBN. Rellena los datos a mano» (la app dice «No encontramos ese ISBN…»: es el aviso de ISBN **no encontrado**, no el de fallo de red), ISBN `9789585234048` y `9799585579972`, app de desarrollo instalada en el celular.

| ISBN | Dígito de control (`parseIsbn` de la app) | Open Library: `api/books` | `/isbn/{isbn}.json` | `search.json?q=isbn:` |
|---|---|---|---|---|
| 9789585234048 (prefijo 978-958: editorial colombiana) | **Válido** | `{}` (HTTP 200) | 404 | 0 resultados |
| 9799585579972 | **Inválido** (el dígito esperado sería 1) | `{}` | 404 | 0 resultados |

Conclusiones:

1. **Primer ISBN: es un hueco de cobertura de Open Library.** La app lo valida bien, lo convierte bien y consulta bien; Open Library responde correctamente que no lo tiene. Las tres rutas coinciden, así que **corregir la integración actual no lo resolvería**. Coincide con el indicio de §3.2: ediciones locales (aquí, colombianas) poco cubiertas. Tampoco figura en Wikidata (propiedad P212).
2. **Segundo ISBN: no es un ISBN-13 válido.** Con un dígito de control incorrecto, la app no llega a consultar: en el formulario mostraría «Ese ISBN no es válido. Revisa los dígitos» y el escáner, «No se leyó bien». Si el libro lo tiene impreso así, hay que revisar los dígitos de la contraportada (o puede ser una lectura/anotación errónea). Con este dato la app no puede ser la causa del «no encontrado» de ese código.
3. Hasta aquí, **el problema no es del escáner ni de la integración, sino de que el catálogo único no cubre ediciones locales**. Es el escenario para el que §7 recomienda un segundo proveedor, pero la eficacia de Google Books sigue **sin medirse** (ver abajo).

### Google Books con clave: medición (2026-10-15)

Tras aceptar el propietario los términos de la API, se activó `books.googleapis.com` en `lectoria-1208a` (billing sigue **deshabilitado**; sin coste) y se probó con una clave temporal restringida solo a esa API. Unas 130 consultas a `GET /books/v1/volumes?q=…&key=…`:

| Observación | Resultado |
|---|---|
| Fallos del servicio | **≈ 50 % de las consultas devolvieron `503 Service temporarily unavailable`** (29 de 60 en la prueba repetida; con 5 reintentos seguidos muchas siguieron en 503) |
| `isbn:9780441172719` (Dune, Ace) | **0 resultados** en 7 de 10 intentos (el resto, 503) y nunca lo encontró, pese a ser un ISBN de uso masivo |
| La misma consulta sin operador (`q=9780441172719`) | Sí encontró «Dune», Frank Herbert, 897 págs., con portada, pero es **búsqueda de texto libre**: con otros ISBN devolvió libros **sin relación** (p. ej. un manual de programación coreano para el ISBN de *Harry Potter and the Philosopher's Stone*). Usarla rellenaría el formulario con un libro equivocado |
| `9789585234048` (el ISBN del usuario) | **No encontrado** (`totalItems: 0` en las respuestas 200 con `isbn:`, con y sin `country`, y con su equivalente ISBN-10) |
| `9788478884452` (HP en español, que Open Library sí tiene) | `isbn:` → 0 resultados / 503: **no lo encontró** |
| Cuota | No se llegó a ningún `429` con clave; la cuota por defecto sigue sin confirmarse |
| Portadas y páginas | Cuando respondió bien (Dune), trae `pageCount` e `imageLinks` |

Otras fuentes gratuitas consultadas para `9789585234048`: Library of Congress (SRU) y Deutsche Nationalbibliothek (SRU), **0 registros** en ambas; Wikidata, sin resultado.

**Conclusión de la medición:** con los datos de hoy, Google Books **no resuelve el caso del usuario** y su fiabilidad actual es mala para este uso (503 frecuentes, `isbn:` que falla con ISBN conocidos, búsqueda libre con falsos positivos). Es una foto de un día y de un proyecto nuevo; no prueba que sea siempre así, pero **no justifica integrarlo como fallback hoy**.

### Revisión de la recomendación del §7

- El punto 3 (combinar proveedores) estaba condicionado a «medir primero». La medición **no respalda** hacerlo ahora.
- Lo que sí está respaldado: el fallo del usuario es de **cobertura** (§9) y el comportamiento de la app es correcto (el aviso «no encontrado» y el formulario manual son la salida prevista).

### Cobertura medida con una muestra independiente de Open Library (2026-10-15)

Se reunieron 60 ISBN-13 de ediciones en español (autores y temas colombianos y latinoamericanos) **tomados del índice de Google Books**, para no sesgar a favor de Open Library, y se consultó a cada proveedor:

| Proveedor y forma de consulta | Resuelve |
|---|---|
| Open Library (`api/books`, el endpoint actual) | **18 de 60 (30 %)** |
| Google Books (`q=isbn:…`, o el número como texto libre, comprobando que el volumen declare ese ISBN-13) | **0 de 60** |

Comprobaciones adicionales: con volúmenes que Google **lista él mismo** con su ISBN-13, consultar por ese ISBN devolvió `totalItems: 0` tanto con `isbn:` como en texto libre; incluso `intitle:dune` o `inauthor:herbert` solos devuelven 0 (con un término normal delante sí responde). Es decir, **desde este entorno la búsqueda por ISBN de Google Books no funciona**, y la intermitencia (≈ 50 % de 503) la empeora. Dos lecturas posibles: un fallo del servicio en este momento o una restricción por país/región; **no se pudo distinguir**. El celular del usuario (en Colombia) puede comportarse distinto; por eso se deja el respaldo implementado y con traza en desarrollo, para comprobarlo allí.

Lectura útil para el problema real: **Open Library solo resuelve el 30 % de estas ediciones en español**, lo que explica el aviso «no encontrado» del usuario.

## 10. Decisión e implementación (2026-10-15)

Decisión del usuario, a pesar de la medición desfavorable: **implementar Google Books como respaldo** de Open Library (`bookCatalogService.ts`).

- **Orden:** Open Library primero; si no lo conoce, o falla (sin red, 429, 5xx), se consulta Google Books **solo si hay clave** (`EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY`). Si Open Library lo encuentra, Google no se toca.
- **Respaldo «lo mejor posible»:** nunca lanza. Un fallo suyo no convierte «no encontrado» en error; si Open Library falló y Google tampoco lo halla, se lanza el error de Open Library como antes.
- **Sin falsos positivos:** solo se acepta un volumen que declare **ese mismo ISBN-13** en `industryIdentifiers` (la búsqueda libre devolvió libros ajenos en las pruebas).
- **503:** un reintento inmediato (400 ms); no se reintenta con 4xx (clave rechazada, cuota). Máximo 5 s por intento; el peor caso añade unos 10 s a los 8 s de Open Library.
- **Portadas:** `http://` → `https://` y sin la esquina doblada (`edge=curl`).
- **Clave:** restringida a **Books API** y a la **app Android** (paquete `com.lectoria.app` + huella SHA-1 del certificado de EAS). El `fetch` de JavaScript no envía esos datos, así que el servicio añade `X-Android-Package` y `X-Android-Cert` (`EXPO_PUBLIC_ANDROID_CERT_SHA1`); verificado: sin ellos o con una huella equivocada Google responde `403 API_KEY_ANDROID_APP_BLOCKED`, y con ellos acepta la clave. Consecuencias: en **Expo Go** (otro paquete y certificado) y en **iOS** (no hay restricción iOS configurada) el respaldo queda inactivo sin avisar; al añadir iOS habrá que revisar la restricción (una clave admite un solo tipo de restricción de aplicación).
- **Coste:** `billingEnabled: false` en `lectoria-1208a`; la API y la clave no generan coste. La cuota por defecto con clave no se ha confirmado (los foros hablan de 1000 consultas/día **para todo el proyecto**).
- **Condiciones de uso de Google (a cumplir antes de publicar):** no cobrar a los usuarios por la app sin permiso escrito de Google; retirar contenido de Books API si Google lo pide y **ofrecer un contacto** para titulares de derechos; revisar sus pautas de marca/atribución.
- **Traza:** en desarrollo (`__DEV__`, nunca en producción ni en pruebas) se imprime en la consola `[catálogo] …` con el resultado de cada proveedor y el estado HTTP de Google, para ver en el dispositivo qué ocurre.
- **Pruebas:** 40 unitarias del servicio (parser de Google con falsos positivos, cabeceras por plataforma, orden de proveedores, reintento de 503, 4xx sin reintento, fallos del respaldo, sin clave). Con la red real el flujo funciona de extremo a extremo (cabeceras enviadas, clave aceptada, reintento tras 503), pero **devuelve «no encontrado» para el ISBN del usuario**, como anticipaba la medición.

**Qué esperar:** el respaldo está listo, pero con lo medido **probablemente no resolverá** el caso del usuario ni muchos de los demás. Si en el celular tampoco aporta resultados (la traza lo mostrará: `Google Books, intento 1: HTTP 200` y «no encontrado»), conviene retirarlo o sustituirlo; la cobertura de ediciones locales sigue siendo el problema de fondo. Para esos libros la salida prevista es el formulario manual.

## 11. Prueba en el dispositivo (2026-10-15)

Traza `[catálogo]` en el celular del usuario (app de desarrollo, Colombia):

| ISBN | Open Library | Google Books |
|---|---|---|
| `9789585579972` | no encontrado | intento 1: **HTTP 503**; intento 2: **HTTP 503** → no encontrado |
| `9789585234048` | no encontrado | intento 1: **HTTP 503**; intento 2: **HTTP 503** → no encontrado |
| `9788413143194` | **encontrado** (no se consultó Google) | — |

Lectura:

- **El flujo funciona en el dispositivo:** la consulta, el orden de proveedores, el reintento y la traza se comportan como se diseñó. Que un ISBN sí se encuentre confirma que la integración con Open Library es correcta.
- **Los dos ISBN colombianos no están en Open Library** (y desde el PC tampoco en Google ni en las otras fuentes probadas). El `9789585579972` es el mismo caso que el `9799585579972` mal anotado antes: era un error de transcripción del primer dígito de control; ahora es un ISBN válido, igualmente ausente.
- **Google Books devolvió 503 en 4 de 4 intentos desde el dispositivo**, igual que ≈ 50 % de las consultas desde el PC: la inestabilidad **no es del PC ni de la red de pruebas**. No se pudo consultar la cuota del proyecto (se descartó llamar a la API de uso de servicios con un token) y por tanto no se sabe si la causa es la cuota, el proyecto o el servicio.

**Decisión del usuario (2026-10-15):** mantener el respaldo activo y **repetir la prueba otro día** para ver si los 503 desaparecen. Criterio para la próxima revisión: si Google Books sigue devolviendo 503 o 0 resultados con ISBN que sí existen, retirar el respaldo (código, clave y variables); si responde bien, medir otra vez cuántos ISBN que Open Library no conoce rescata.
