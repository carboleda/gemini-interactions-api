# Especificación Técnica: Editor de Imágenes con Managed Agents y Nano Banana

Esta especificación técnica detalla los requerimientos de arquitectura, flujos de datos, APIs y diseño de UI para implementar y replicar el editor de imágenes inteligente.

---

## 1. Arquitectura del Sistema

La aplicación sigue una arquitectura cliente-servidor apoyada por un Agente Administrado (Managed Agent) en la nube de Google Gemini, que ejecuta un sandbox remoto persistente por sesión de edición.

```
+---------------------------------------+
|          Cliente (Navegador)          |
|      (HTML5, Vanilla CSS, JS SPA)     |
+-------------------+-------------------+
                    | (Multipart POST: Imagen + Prompt)
                    | (SSE: progreso en tiempo real)
                    v
+-------------------+-------------------+
|         Servidor Express.js           |
|      - sharp (compresión <1MB)        |
|      - @google/genai (Interactions)   |
|      - sseProgressBus (SSE)           |
|      - agentEnvironment (sesión)      |
+-------------------+-------------------+
                    | (Interactions API: environment/sources
                    |  en la 1ª llamada; environment_id +
                    |  previous_interaction_id en las siguientes)
                    v
+-------------------+-------------------+
|        Managed Agent (Remote)         |
|      (antigravity-preview-05-2026)    |
|      Sandbox persistente:             |
|      - /workspace (script + input)    |
|      - /history (versiones, fuera     |
|        de /workspace)                 |
|      - egress allowlist -> Gemini API |
|        (header x-goog-api-key         |
|        inyectado automáticamente)     |
+-------------------+-------------------+
                    | (Gemini API, vía egress permitido)
                    v
+-------------------+-------------------+
|        Gemini Nano Banana             |
|      (gemini-3.1-flash-image)         |
+-------------------+-------------------+
```

El sandbox remoto conserva su filesystem completo entre interacciones mientras se reutilice el mismo `environment_id`: una vez creado en la primera edición de una imagen, nunca se vuelve a provisionar, sin importar cuántas ediciones o restauraciones de historial ocurran después.

---

## 2. Requerimientos del Servidor Backend (Node.js/Express)

El servidor Express actúa como intermediario que procesa la imagen para adaptarla a los límites de tamaño, coordina la ejecución remota del sandbox, y retransmite su progreso al cliente en tiempo real.

### 2.1. Endpoints de la API

#### `POST /api/edit`
Procesa la imagen, interactúa con el agente de Gemini y devuelve la imagen editada.

- **Request Body** (`multipart/form-data`):
  - `image`: Archivo de imagen (PNG, JPEG, WebP). Solo se envía en la **primera** edición de una sesión; las ediciones siguientes sobre la misma imagen no lo incluyen.
  - `prompt`: Instrucción en texto plano para la edición (ej. *"Haz que el carro sea rojo"*).
  - `model` (Opcional): El modelo de edición a usar, por defecto `gemini-3.1-flash-image`.
  - `sessionId`: UUID generado por el cliente al cargar la imagen (`crypto.randomUUID()`), constante durante toda la vida de esa imagen en el cliente. Identifica el sandbox/sesión en el servidor.
  - `requestId`: UUID generado por el cliente para esta petición concreta, usado para correlacionar el canal de progreso SSE (ver más abajo).
  - `baseVersion` (Opcional, entero): número de versión del historial desde la que debe partir esta edición. Si se omite, se usa la última versión generada. Solo tiene efecto a partir de la segunda edición de una sesión.

- **Response**:
  - `200 OK`: Archivo de imagen binario (JPEG) con el resultado de la edición. Incluye la cabecera `X-Edit-Version` con el número de versión resultante (entero como string), ya que el cuerpo de la respuesta es el binario y no puede llevar metadatos.
  - `500 Internal Server Error`: JSON con el error detallado (ej. `{ "error": "Versión de historial inválida." }`).

#### `GET /api/edit/events/:requestId`
Canal de Server-Sent Events (SSE) para el progreso en tiempo real de una petición de edición en curso, identificada por el mismo `requestId` enviado a `POST /api/edit`. El cliente debe abrir este canal (`EventSource`) antes o al mismo tiempo que dispara la petición de edición.

- **Eventos emitidos**:
  - `phase`: `{ phase: "<mensaje>", at: <timestamp> }` — una fase del proceso (ver lista de fases en 2.2).
  - `error`: `{ message: "<mensaje de error>" }` — si la edición falla.
  - `done`: `{ at: <timestamp> }` — la petición terminó (con éxito o error); el servidor cierra la conexión SSE después de este evento.

#### `POST /api/suggest-prompts`
Genera una lista de al menos 4 sugerencias rápidas de prompts para editar basados en el contenido de la imagen subida.

- **Request Body** (`multipart/form-data`):
  - `image`: Archivo de imagen (PNG, JPEG, WebP).

- **Response**:
  - `200 OK`: JSON con un array conteniendo al menos 4 sugerencias rápidas en español (ej. `["Haz que el carro sea rojo", "Haz que la camiseta de la persona sea azul", "Haz que la pelota sea verde"]`).
  - `500 Internal Server Error`: JSON con el error detallado.

### 2.2. Lógica de Procesamiento del Servidor

1. **Compresión**: usar `sharp` para redimensionar y comprimir la imagen subida. Se intenta con anchos decrecientes — `1920, 1600, 1200, 900, 700, 500` px — reduciendo hasta que el resultado JPEG (calidad 85) pese menos de **1 MB**; si ningún ancho lo logra, se aplica un último intento al ancho mínimo con calidad 60. El resultado se convierte a Base64 para montarlo en el sandbox.

2. **Gestión de sesión y del entorno remoto (Sandbox)**:
   - Por cada `sessionId`, el servidor persiste en disco (`.data/agent-sessions.json`) el registro `{ environmentId, lastInteractionId, nextVersion }`.
   - **Primera edición de una sesión** (`environmentId` no existe todavía): se crea un sandbox nuevo, montando archivos vía `sources`. El objeto `environment` de la llamada es plano: `{ sources: [...], type: "remote", network: { allowlist: [...] } }`.
     - `sources` (montados como fuentes `inline`): `input.base64` (la imagen comprimida) → `/workspace/input.base64`, y el script `edit_image.py` → `/workspace/edit_image.py`. **No** se monta ningún archivo `.env`.
     - `network.allowlist` controla el egress de red del sandbox y resuelve la autenticación sin que el script gestione ninguna clave:
       ```json
       [
         { "domain": "*" },
         { "domain": "generativelanguage.googleapis.com", "transform": { "x-goog-api-key": "<GEMINI_API_KEY>" } }
       ]
       ```
       La primera entrada permite el resto del egress que el script necesite; la segunda inyecta automáticamente el header `x-goog-api-key` en cualquier llamada del script hacia el dominio de la API de Gemini, sin que el script tenga que leer ni exponer la clave él mismo.
   - **Ediciones siguientes** (`environmentId` ya existe): se reutiliza el mismo sandbox, sin volver a montar `sources` (la API rechaza combinar `environment.environment_id` con `environment.sources` — error 400). El objeto `environment` es `{ type: "remote", environment_id: "<id>" }`, y `previous_interaction_id: "<id de la última interacción>"` se envía como **campo de nivel superior de la llamada** (hermano de `environment`, `agent`, `input`), nunca anidado dentro de `environment`.

3. **Historial de versiones y ramificación**: cada edición exitosa guarda una copia versionada del resultado en `/history` (fuera de `/workspace`, dentro del mismo filesystem persistente del sandbox), además de sobrescribir siempre `/workspace/output.jpg` (que es lo único que se descarga).
   - **Por qué fuera de `/workspace`**: la API de descarga de archivos no permite pedir un archivo suelto, siempre trae el snapshot completo de `/workspace` como un `.tar`. Si el historial viviera dentro de `/workspace`, cada descarga pesaría más que la anterior a medida que se acumulan ediciones. Al vivir en `/history`, el agente lo lee/escribe con normalidad entre interacciones, pero nunca forma parte de lo que se descarga — el tamaño del tar descargado no depende del número de versiones acumuladas.
   - **Numeración**: `v0` = imagen original subida; `v1, v2, ...` = resultado de cada edición sucesiva, en el orden en que se crean (el número solo crece, incluso si el usuario "ramifica" desde una versión antigua). El contador `nextVersion` se persiste por sesión.
   - **Comando de la primera edición**:
     ```
     mkdir -p /history &&
     python /workspace/edit_image.py --decode --output /workspace/output.jpg --prompt "<prompt>" --model "<model>" &&
     cp /workspace/input.jpg /history/v0.jpg &&
     cp /workspace/output.jpg /history/v1.jpg
     ```
   - **Comando de cualquier edición siguiente** (continuar desde la última versión o restaurar/ramificar desde una anterior es exactamente el mismo comando, solo cambia qué archivo se usa como `--input`):
     ```
     python /workspace/edit_image.py --input /history/v<baseVersion>.jpg --output /workspace/output.jpg --prompt "<prompt>" --model "<model>" &&
     cp /workspace/output.jpg /history/v<newVersion>.jpg
     ```
     `baseVersion` viene del cliente (o la última versión por defecto); debe validarse en rango `[0, nextVersion - 1]` antes de interpolarlo en la ruta, devolviendo un error claro si no lo está.
   - El texto enviado al agente como `input` es una instrucción en lenguaje natural que incluye el comando exacto: `Run this exact command in the workspace and wait for it to finish: <comando>`.

4. **Ejecución en background y progreso en tiempo real**: la interacción con el Managed Agent se crea con `background: true` (no bloquea la petición) y el servidor hace *polling* de su estado con `client.interactions.get(...)` cada `POLL_INTERVAL_MS` (5s) hasta que deja de ser `"queued"`/`"in_progress"`, con un límite total de espera `MAX_WAIT_MS` (5 min). El servidor emite fases al canal SSE (`GET /api/edit/events/:requestId`) a medida que avanza: *"Comprimiendo imagen..."*, *"Inicializando sandbox remoto..."* (o *"Reutilizando sandbox remoto..."* en continuaciones), *"Lanzando ejecución en background..."*, y luego, en cada intento de polling, *"Agente trabajando en el sandbox (Nano Banana)... (Ns transcurridos)"* con el tiempo transcurrido, y finalmente *"Descargando resultado del sandbox..."*. Si el estado final no es `"completed"` (por ejemplo `"failed"` o `"cancelled"`), o si se supera `MAX_WAIT_MS`, se lanza un error explícito. Al terminar (con éxito o error) se emite `done` y se cierra la conexión.
   - **Resiliencia del polling**: `client.interactions.get(...)` puede fallar de forma transitoria al ser una API preview (se observó un `403 permission_denied` puntual que no se repitió en ediciones posteriores). Cada llamada a `get(...)` está envuelta en un `try`/`catch` que cuenta errores *consecutivos*; un `get()` exitoso reinicia el contador a cero, y solo se relanza el error (abortando la edición) tras superar `MAX_GET_RETRIES` (3) fallos consecutivos. Mientras reintenta, emite `"Error temporal consultando el estado del agente, reintentando (N/MAX_GET_RETRIES)..."` por el canal SSE.

5. **Descarga y extracción**:
   - Petición GET a la API de Archivos de Gemini para descargar el snapshot del entorno: `https://generativelanguage.googleapis.com/v1beta/files/environment-${envId}:download?alt=media`. A diferencia de las llamadas que hace el script *dentro* del sandbox, esta petición la hace el propio servidor Node desde fuera del sandbox, por lo que **no** se beneficia de la inyección automática de header de la allowlist — debe enviar explícitamente `x-goog-api-key` en sus headers.
   - Guardar el tarball temporalmente y extraer únicamente `./workspace/output.jpg` (el resto del snapshot incluye archivos de sistema del sandbox que no son necesarios y pueden fallar al extraerse en un filesystem normal).
   - Registrar `{ environmentId, lastInteractionId, nextVersion: nextVersion + 1 }` para la sesión, y devolver `{ buffer, version }` al endpoint HTTP, que expone `version` en la cabecera `X-Edit-Version`.

6. **Generación de Sugerencias de Prompts**:
   - Al recibir una imagen en `POST /api/suggest-prompts`, el backend usa `sharp` para redimensionarla a un tamaño reducido para análisis rápido (máx. 512px, ajuste `inside`, calidad 80).
   - El backend invoca al modelo `gemini-3.5-flash` a través de la **Interactions API** (`client.interactions.create({...})`, sin `agent` ni `environment` — una interacción puntual, sin estado), enviando un `input` con dos partes: un bloque de texto con el prompt en español que solicita al menos 4 sugerencias concisas y realistas de edición basadas estrictamente en los elementos detectados (ej. cambiar el color de un objeto o prenda, agregar un accesorio, modificar el cielo o el fondo), y un bloque de imagen (`{ type: "image", data, mime_type }`) con la imagen redimensionada.
   - Se solicita salida estructurada vía `response_format` (JSON Schema, array de strings, mínimo 4 elementos) para un formato de respuesta consistente; el resultado se lee de `interaction.output_text`.

---

## 3. Especificación del Script de Python (`edit_image.py`)

El script se ejecuta dentro de la sandbox remota (Ubuntu, Python 3.12, SDK `google-genai` y PIL preinstalados).

### 3.1. Parámetros del Script
Debe aceptar los siguientes argumentos mediante `argparse`:
- `--decode`: Flag booleano para decodificar primero el archivo base64.
- `--input_base64`: Ruta del archivo base64 (por defecto `/workspace/input.base64`).
- `--input`: Ruta de la imagen de entrada (por defecto `/workspace/input.jpg`). En ediciones encadenadas o al restaurar/ramificar desde una versión anterior, el servidor apunta este flag a un archivo `/history/vN.jpg` distinto en cada llamada — el script no necesita ninguna lógica especial para soportar esto, solo abre el archivo que se le indique.
- `--output`: Ruta de la imagen resultante (por defecto `/workspace/output.jpg`).
- `--prompt`: Prompt de edición (obligatorio).
- `--model`: Modelo de Gemini a invocar (por defecto `gemini-3.1-flash-image`).

### 3.2. Lógica de Ejecución
1. Si `--decode` está activo:
   - Leer el contenido de `--input_base64`.
   - Decodificar los bytes base64.
   - Guardar el archivo binario resultante en la ruta `--input`.
2. Inicializar el cliente `genai.Client()`. La autenticación hacia la API de Gemini queda resuelta por la allowlist de red del sandbox (ver §2.2), no por variables de entorno gestionadas por el script.
3. Abrir la imagen en la ruta `--input` usando `PIL.Image`.
4. Componer el prompt final anteponiendo siempre una instrucción fija de preservación facial al prompt del usuario, para evitar que las ediciones alteren identidad/rasgos faciales salvo que se pida explícitamente:
   ```python
   FACE_PRESERVATION_INSTRUCTION = (
       "No modifiques los rasgos faciales, la identidad, la expresion ni la "
       "estructura del rostro de ninguna persona presente en la imagen, salvo que "
       "la instruccion de edicion lo solicite explicitamente. Aplica el resto de "
       "la instruccion de edicion con normalidad."
   )

   def build_prompt(user_prompt):
       return f"{FACE_PRESERVATION_INSTRUCTION}\n\nInstruccion de edicion: {user_prompt}"
   ```
5. Llamar a `client.models.generate_content`:
   ```python
   response = client.models.generate_content(
       model=args.model,
       contents=[image, build_prompt(args.prompt)],
       config=GenerateContentConfig(
           response_modalities=[Modality.TEXT, Modality.IMAGE]
       ),
   )
   ```
6. Iterar por las partes del contenido de la respuesta. Buscar `inline_data`.
7. Convertir los bytes de `inline_data` a imagen utilizando `PIL.Image`, forzar a RGB y guardarla como JPEG en la ruta `--output`. Si ninguna parte de la respuesta trae `inline_data`, lanzar un error (no se generó imagen).

---

## 4. Requerimientos del Frontend (SPA)

El cliente web es una interfaz estética y fluida construida en Vanilla HTML, CSS y JS.

### 4.1. Diseño Visual (Glassmorphism & Neon Accent)
- **Fondo**: Degradado oscuro profundo (`#0d0e12` a `#151821`).
- **Contenedores**: Tarjetas con bordes semi-transparentes, fondo con opacidad baja (`rgba(255,255,255,0.03)`) y desenfoque de fondo (`backdrop-filter: blur(12px)`).
- **Acentos**: Colores vibrantes HSL para interactivos (Violeta/Morado eléctrico: `hsl(265, 85%, 60%)`).
- **Efectos**: Sombras suaves y resplandores de neón sutiles al pasar el mouse por encima de los botones y la zona de arrastre.

### 4.2. Layout
Grid de 3 columnas (`grid-template-columns: 40% 40% 20%`): zona de carga/edición, comparador antes/después, y panel de historial (ver 4.4) ocupando la columna más angosta a modo de "minimapa". Debajo, a lo ancho completo, la consola del agente. En pantallas estrechas (`max-width: 860px`) el grid colapsa a una sola columna.

### 4.3. Elementos Clave de la Interfaz
1. **Zona de Carga (Drag and Drop Zone)**:
   - Área punteada reactiva al arrastre de archivos con animaciones de transición.
   - Muestra miniatura de la imagen cargada; se actualiza también después de cada edición exitosa para reflejar el resultado más reciente.
2. **Panel de Edición**:
   - Caja de entrada de texto enriquecida para el prompt de edición de imagen.
   - **Sugerencias de Edición (Chips)**: al cargar una imagen se dispara `POST /api/suggest-prompts` y, mientras está en curso, se muestran 4 placeholders pulsantes (`chip-skeleton` dentro de un contenedor `chips-loading`) en lugar de las sugerencias reales. Al recibir la respuesta, se reemplazan por chips con el texto sugerido (clic → escribe el prompt en el input); si la petición falla o no devuelve sugerencias, se muestra un mensaje de texto visible en la misma fila en vez de fallar en silencio.
   - Selector desplegable para elegir el modelo (Flash Image o Pro Image).
   - Botón de acción con spinner animado para el estado de procesamiento, deshabilitado mientras no haya imagen/prompt o mientras una edición esté en curso.
3. **Comparador Antes / Después**:
   - Renderiza la imagen original al lado de la imagen editada.
   - Incluye un controlador deslizante (split slider) táctil e interactivo para comparar los cambios.
   - Botón de descarga del resultado, visible una vez generada la imagen final.
4. **Panel de Historial** (columna derecha, estilo minimapa):
   - Lista de tarjetas, una por versión generada en la sesión (incluida la v0 = imagen original subida al cargar el archivo), cada una con: miniatura, etiqueta numérica (`Version #N`, con el prompt completo como `title` para verlo al pasar el mouse), y el texto "👁 Ver en lienzo".
   - La tarjeta correspondiente a la versión activa queda resaltada; todas las tarjetas quedan deshabilitadas (sin interacción) mientras hay una edición en curso.
   - Botón "Reiniciar todo" (icono de papelera) que descarta todo el historial salvo la versión original y vuelve a esa versión.
   - Hacer clic en una tarjeta **no dispara ninguna llamada de red**: solo cambia localmente cuál es la versión activa (thumbnail del dropzone, estado del comparador vuelto a placeholder, sugerencias ocultas) y qué `baseVersion` se enviará en la próxima edición — permitiendo ramificar desde cualquier punto del historial sin volver a subir la imagen ni salir del mismo sandbox.
5. **Consola del Agente**:
   - Panel de consola que muestra, en tiempo real (vía `EventSource` contra `GET /api/edit/events/:requestId`), las fases del proceso mientras dura la edición (ver lista de fases en §2.2), y un mensaje de error si la edición falla.

### 4.4. Continuidad de sesión (cliente)
- Al cargar una imagen, el cliente genera un `sessionId` (`crypto.randomUUID()`) que se mantiene constante mientras esa imagen esté activa, y reinicia el historial local a solo la versión original.
- Solo la primera edición de una sesión envía el archivo `image` en el `FormData`; las ediciones siguientes solo envían `prompt`, `model`, `sessionId`, `requestId` y `baseVersion` (la versión activa localmente) — nunca se re-sube la imagen.
- Cada edición exitosa lee la cabecera `X-Edit-Version` de la respuesta para saber qué número de versión añadir al historial local.

---

## 5. Guía de Replicación Rápida

Para replicar este proyecto en cualquier entorno local:

1. **Clonar/Configurar el proyecto base**:
   Asegurar un entorno Node.js v20+.
2. **Variables de Entorno**:
   Si todavía no tienes una API key de Gemini, genera una gratis en [Google AI Studio](https://aistudio.google.com/api-keys). Crear un archivo `.env` en la raíz del proyecto:
   ```env
   GEMINI_API_KEY=tu_api_key_aqui
   PORT=3000
   ```
3. **Instalación de Dependencias**:
   ```bash
   npm install express multer sharp @google/genai
   ```
4. **Ejecución**:
   ```bash
   node --env-file .env image-editor/server.js
   ```
5. **Estado local de sesión**: el servidor persiste el estado de cada sandbox activo (`environmentId`, `lastInteractionId`, `nextVersion`) en `.data/agent-sessions.json`. Borrar ese archivo fuerza a que la siguiente edición provisione un sandbox completamente nuevo — útil para pruebas o para descartar un entorno remoto que haya quedado en mal estado.
