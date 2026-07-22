---
title: "Paso 5 — Descarga el resultado"
description: Descarga un snapshot del sandbox y extrae únicamente el archivo de imagen editada.
---

## Objetivo

El Managed Agent dejó `output.jpg` dentro de `/workspace` en el sandbox remoto. Para poder mostrárselo al usuario, tu servidor tiene que descargar ese archivo usando la **API de Archivos de Gemini**, que expone un snapshot en formato `tar` de todo el entorno — no hay forma de pedir un solo archivo directamente, así que después de descargar el tar hay que extraer solo lo que necesitas.

Hay dos bloques pendientes en `downloadAndExtractOutput`.

## Bloque 1: descargar el snapshot

```js
async function downloadAndExtractOutput({ environmentId, requestId }) {
  progressBus.emit(requestId, "Descargando resultado del sandbox...");

  // TODO (Paso 5): construye `url` apuntando al endpoint de descarga de la
  // API de Archivos de Gemini para este `environmentId`, y haz
  // `await fetch(url, { headers: { "x-goog-api-key": apiKey } })`, guardando
  // la respuesta en `response`.
  // Código completo y explicación -> Paso 5 del codelab.
  throw new Error(
    "Completa el Paso 5 del codelab en downloadAndExtractOutput() (lib/geminiAgent.js).",
  );

  if (!response.ok) {
    ...
```

Reemplaza el bloque comentado y el `throw` por:

```js
  const url = `https://generativelanguage.googleapis.com/v1beta/files/environment-${environmentId}:download?alt=media`;

  const response = await fetch(url, {
    headers: { "x-goog-api-key": apiKey },
  });
```

Fíjate que aquí **sí** pasas `x-goog-api-key` explícitamente en el header del `fetch`. Esto no contradice lo que viste en el Paso 3: la regla de `network.allowlist` inyecta la clave automáticamente solo para las llamadas que salen **desde dentro del sandbox**. Esta llamada, en cambio, la hace tu propio servidor Express, fuera del sandbox — por eso aquí tienes que poner la clave tú mismo, igual que en cualquier llamada normal a la API de Gemini.

## Bloque 2: extraer solo el archivo que necesitas

Un poco más abajo, después de que el tar descargado ya se guardó en disco (`fs.writeFileSync(tarPath, buffer)`):

```js
  // TODO (Paso 5): usa `execFileSync("tar", [...])` para extraer únicamente
  // `./workspace/output.jpg` del tar descargado (`tarPath`) hacia
  // `extractDir`. Solo ese archivo: el snapshot completo incluye archivos
  // del propio sandbox que no necesitamos y que fallarían al extraerse en un
  // filesystem normal.
  // Código completo y explicación -> Paso 5 del codelab.
```

Reemplaza ese comentario por:

```js
  execFileSync("tar", [
    "-xf",
    tarPath,
    "-C",
    extractDir,
    "./workspace/output.jpg",
  ]);
```

## Cómo funciona

- La URL de descarga usa el prefijo especial `environment-${environmentId}` como si fuera el nombre de un archivo en la API de Files de Gemini — es la convención que expone un snapshot completo de ese entorno.
- `alt=media` le pide a la API que devuelva el contenido binario directamente, no metadatos JSON.
- El snapshot es un `.tar` de **todo** el sandbox, incluyendo archivos internos del propio entorno con permisos/hardlinks especiales que fallarían al extraerse completos en tu sistema de archivos normal. Por eso `execFileSync("tar", [...])` pide explícitamente solo `./workspace/output.jpg`, en vez de extraer todo con `-xf tarPath -C extractDir` sin más argumentos.
- El código que ya existía debajo (comprobar que `output.jpg` se extrajo, leerlo a un buffer, limpiar los archivos temporales) no necesita cambios — solo esperaba que `response` y la extracción del tar ya hubieran ocurrido.

## Verifica

Sube una imagen y pide una edición de nuevo. Ahora debería completar todo el flujo del lado de Express — pero el propio Managed Agent fallará al ejecutar `edit_image.py`, porque ese script todavía tiene su bloque de Nano Banana pendiente. Ese es el [Paso 6](../09-paso-6-nano-banana/), el último.
