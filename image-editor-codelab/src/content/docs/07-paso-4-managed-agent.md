---
title: "Paso 4 — Invoca al Managed Agent"
description: Crea o continúa una interacción con el Managed Agent, reutilizando el sandbox entre ediciones sucesivas.
---

## Objetivo

`editImage` es la función central del proyecto: decide si esta edición **crea un sandbox nuevo** (primera edición de una sesión) o **reutiliza uno existente** (ediciones siguientes sobre la misma imagen), construye el comando de shell que el agente debe ejecutar, y llama a `client.interactions.create(...)` para disparar al Managed Agent. Hay dos bloques pendientes dentro de esta función.

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

## Bloque 2: crear la interacción

Más abajo en la misma función, después de que se construye `command` y `input`, encontrarás:

```js
    progressBus.emit(requestId, "Ejecutando Python script en sandbox...");
    progressBus.emit(requestId, "Llamando a Nano Banana...");

    // TODO (Paso 4): declara aquí `createParams` con los campos que exige el
    // Managed Agent (`agent`, `input`, `environment`, y
    // `previous_interaction_id: session.lastInteractionId` únicamente cuando
    // `isContinuation` es true) y llama a
    // `await client.interactions.create(createParams, { timeout: DOWNLOAD_TIMEOUT_MS })`,
    // guardando el resultado en `interaction`.
    // Código completo y explicación -> Paso 4 del codelab.
    throw new Error(
      "Completa el Paso 4 del codelab en editImage() (lib/geminiAgent.js).",
    );
```

Reemplázalo por:

```js
    const createParams = {
      agent: AGENT_NAME,
      input,
      environment,
      ...(isContinuation
        ? { previous_interaction_id: session.lastInteractionId }
        : {}),
    };

    const interaction = await client.interactions.create(createParams, {
      timeout: DOWNLOAD_TIMEOUT_MS,
    });
```

## Cómo funciona

- `agent: AGENT_NAME` (`"antigravity-preview-05-2026"`) le dice a la Interactions API qué Managed Agent ejecutar.
- `input` es literalmente el comando de shell a correr (`Run this exact command in the workspace and wait for it to finish: python /workspace/edit_image.py ...`), construido más arriba en la función según si es primera edición o continuación.
- `previous_interaction_id` es un campo **de nivel superior** de `createParams` — no vive dentro de `environment` — y solo se incluye cuando `isContinuation` es verdadero. Le indica al agente que esta interacción continúa la conversación/estado de una interacción anterior en el mismo sandbox.
- `client.interactions.create(createParams, { timeout: DOWNLOAD_TIMEOUT_MS })` es la llamada que efectivamente crea el sandbox (si `environment` no tenía `environment_id`) o lo reutiliza, ejecuta el comando, y espera (hasta 5 minutos, `DOWNLOAD_TIMEOUT_MS`) a que termine.
- El resultado (`interaction`) trae `environment_id` e `id` (el id de esta interacción), que el código ya existente debajo guarda con `agentEnvironment.save(...)` para la próxima edición de esta misma sesión.

## Verifica

Sube una imagen y pide una edición. Ahora debería avanzar más — pero fallará al intentar descargar el resultado, porque `downloadAndExtractOutput` todavía tiene su propio bloque pendiente. Eso es el [Paso 5](../08-paso-5-descarga/).
