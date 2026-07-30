---
title: "Paso 4 — Invoca al Managed Agent"
description: Crea o continúa una interacción con el Managed Agent, reutilizando el sandbox entre ediciones sucesivas.
---

## Objetivo

`editImage` es la función central del proyecto: decide si esta edición **crea un sandbox nuevo** (primera edición de una sesión) o **reutiliza uno existente** (ediciones siguientes sobre la misma imagen), construye el comando de shell que el agente debe ejecutar, y llama a `client.interactions.create(...)` para disparar al Managed Agent. Hay dos bloques pendientes dentro de esta función.

El agente puede tardar varios minutos en terminar, así que esta llamada se hace en **background** (`background: true`) en vez de bloquear la petición HTTP: `editImage` lanza la interacción, y luego hace **polling** (`client.interactions.get(...)`) hasta que termina, avisando al usuario del progreso en cada intento.

## Bloque 1: decidir el entorno

Busca este fragmento, justo después de los mensajes de progreso:

```js
    // Reusing an environment_id only works when no `sources` are sent in the
    // same call (verified against the live API: combining both always 400s).
    // So on a continuation we skip re-mounting input.base64 entirely and just
    // point the script at a file already sitting on disk in that environment
    // (either the latest output.jpg, or an older /history/vN.jpg entry when
    // the user restores a previous version).
    // `previous_interaction_id` is a top-level field of the interaction, not
    // part of `environment` (confirmed against the SDK's Environment_2 type,
    // which only has environment_id/network/sources/type).
    // TODO (Paso 4): declara aquí la constante `environment`. Si es una
    // continuación de sesión (`isContinuation`), reutiliza el sandbox
    // existente con `{ type: "remote", environment_id: session.environmentId }`;
    // si es la primera edición, créalo con `buildEnvironment({ base64Image })`.
    // Código completo y explicación -> Paso 4 del codelab.
    throw new Error(
      "Completa el Paso 4 del codelab en editImage() (lib/geminiAgent.js).",
    );
```

Reemplázalo (conservando el comentario explicativo de arriba si quieres, es útil) por:

```js
    const environment = isContinuation
      ? { type: "remote", environment_id: session.environmentId }
      : buildEnvironment({ base64Image });
```

Esto conecta directamente con lo que viste en el [Paso 2](../05-paso-2-sandbox/): como no se puede combinar `sources` con `environment_id`, solo llamas a `buildEnvironment` (que declara `sources`) cuando es la primera edición. En continuaciones, apuntas al mismo sandbox por `environment_id` y confías en que los archivos de ediciones anteriores (`/history/vN.jpg`) ya están ahí.

## Bloque 2: crear la interacción en background y esperar el resultado

Más abajo en la misma función, después de que se construye `command` y `input`, encontrarás:

```js
    // TODO (Paso 4): declara aquí `createParams` con los campos que exige el
    // Managed Agent (`agent`, `input`, `environment`, `background: true` para
    // no bloquear la petición mientras el agente trabaja, y
    // `previous_interaction_id: session.lastInteractionId` únicamente cuando
    // `isContinuation` es true). Llama a
    // `let interaction = await client.interactions.create(createParams)` y
    // luego haz polling con `client.interactions.get(interaction.id)` hasta
    // que `interaction.status` deje de ser `"queued"`/`"in_progress"`,
    // emitiendo progreso (con `progressBus.emit`) en cada intento. Envuelve el
    // `get(...)` en un try/catch: es una API preview y puede fallar de forma
    // transitoria, así que reintenta hasta `MAX_GET_RETRIES` veces (con el
    // mismo `POLL_INTERVAL_MS` como espera entre intentos) antes de relanzar
    // el error.
    // Código completo y explicación -> Paso 4 del codelab.
    throw new Error(
      "Completa el Paso 4 del codelab en editImage() (lib/geminiAgent.js).",
    );
```

No solo reemplaza este bloque con la implementación completa de background execution y polling, sino que también agrega mensajes de progreso al usuario en la consola del navegador, para que vea que el agente está trabajando en el sandbox (Nano Banana) en vez de quedarse en silencio durante varios minutos. Reemplaza el `throw` por:

```js
    progressBus.emit(requestId, "Lanzando ejecución en background...");

    const createParams = {
      agent: AGENT_NAME,
      input,
      environment,
      background: true,
      ...(isContinuation
        ? { previous_interaction_id: session.lastInteractionId }
        : {}),
    };

    let interaction = await client.interactions.create(createParams);
    const startedAt = Date.now();
    let consecutiveGetErrors = 0;

    while (
      interaction.status === "queued" ||
      interaction.status === "in_progress"
    ) {
      if (Date.now() - startedAt > MAX_WAIT_MS) {
        throw new Error(
          "El agente no terminó a tiempo (timeout de 5 minutos).",
        );
      }
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
      progressBus.emit(
        requestId,
        `Agente trabajando en el sandbox (Nano Banana)... (${elapsedSeconds}s transcurridos)`,
      );
      await sleep(POLL_INTERVAL_MS);

      try {
        interaction = await client.interactions.get(interaction.id);
        consecutiveGetErrors = 0;
      } catch (error) {
        consecutiveGetErrors += 1;
        if (consecutiveGetErrors > MAX_GET_RETRIES) {
          throw error;
        }
        progressBus.emit(
          requestId,
          `Error temporal consultando el estado del agente, reintentando (${consecutiveGetErrors}/${MAX_GET_RETRIES})...`,
        );
      }
    }

    if (interaction.status !== "completed") {
      throw new Error(
        `El Managed Agent terminó con estado "${interaction.status}".`,
      );
    }
```

## Cómo funciona

- `agent: AGENT_NAME` (`"antigravity-preview-05-2026"`) le dice a la Interactions API qué Managed Agent ejecutar.
- `input` es literalmente el comando de shell a correr (`Run this exact command in the workspace and wait for it to finish: python /workspace/edit_image.py ...`), construido más arriba en la función según si es primera edición o continuación.
- `previous_interaction_id` es un campo **de nivel superior** de `createParams` — no vive dentro de `environment` — y solo se incluye cuando `isContinuation` es verdadero. Le indica al agente que esta interacción continúa la conversación/estado de una interacción anterior en el mismo sandbox.
- `background: true` le dice a la Interactions API que no bloquee la petición: `client.interactions.create(createParams)` devuelve casi de inmediato con un `id` y un `status` (normalmente `"queued"` o `"in_progress"`), sin esperar a que el sandbox termine de ejecutar el comando.
- El `while` sondea (*polling*) el estado de la interacción llamando a `client.interactions.get(interaction.id)` cada `POLL_INTERVAL_MS` (5 segundos), y en cada intento emite un mensaje de progreso al canal SSE (`GET /api/edit/events/:requestId`) con los segundos transcurridos, para que la consola del agente en el navegador siga mostrando actividad en vez de quedarse en silencio hasta 5 minutos.
- `MAX_WAIT_MS` (5 minutos, igual que antes) ya no es el timeout de una llamada HTTP: es un límite de espera del lado de Node. Si se supera, se lanza un error explícito en vez de dejar la conexión colgada sin explicación.
- Cuando `interaction.status` deja de ser `"queued"`/`"in_progress"`, puede haber terminado bien (`"completed"`) o mal (por ejemplo `"failed"` o `"cancelled"`) — por eso se valida explícitamente que sea `"completed"` antes de seguir.
- `client.interactions.get(...)` está envuelto en un `try`/`catch`: al ser una API preview, puede fallar de forma transitoria (por ejemplo un `403 permission_denied` puntual) sin que eso signifique que el agente realmente falló. En vez de abortar la edición completa ante el primer error, el código cuenta errores consecutivos (`consecutiveGetErrors`) y solo relanza el error una vez que supera `MAX_GET_RETRIES` (3 intentos); mientras tanto, avisa por el bus de progreso que está reintentando. Un `get()` exitoso reinicia el contador a cero, así que solo se abandona tras fallos *consecutivos*, no acumulados a lo largo de toda la espera.
- El resultado final (`interaction`) trae `environment_id` e `id` (el id de esta interacción), que el código ya existente debajo guarda con `agentEnvironment.save(...)` para la próxima edición de esta misma sesión.

## Verifica

Sube una imagen y pide una edición. En la consola de la aplicación deberías ver "Lanzando ejecución en background..." seguido de varios mensajes "Agente trabajando en el sandbox (Nano Banana)..." con el tiempo transcurrido, en vez de una espera silenciosa. Al final debería avanzar más — pero fallará al intentar descargar el resultado, porque `downloadAndExtractOutput` todavía tiene su propio bloque pendiente. Eso es el [Paso 5](../08-paso-5-descarga/).
