---
title: "Paso 3 — Protege la API key"
description: Usa network.allowlist para inyectar la API key solo en las llamadas salientes del sandbox hacia Gemini, sin exponerla como archivo.
---

## Objetivo

El script `edit_image.py` que corre dentro del sandbox necesita autenticarse contra la API de Gemini para llamar a Nano Banana. La forma ingenua de resolver esto sería montar un archivo `.env` con `GEMINI_API_KEY` dentro del sandbox junto a los demás `sources` — pero eso deja la clave escrita en el sistema de archivos del entorno remoto, legible por cualquier comando que el agente ejecute ahí.

En vez de eso, este proyecto usa **`network.allowlist` con `transform`**: una regla de red a nivel de entorno, documentada en [Credentials — Gemini Agent Environment](https://ai.google.dev/gemini-api/docs/agent-environment#credentials"), que le dice a la plataforma "inyecta este header automáticamente cuando el sandbox llame a este dominio". La clave nunca se escribe dentro del sandbox — solo viaja en el tráfico de red saliente.

## Dónde va

Sigue en `buildEnvironment`, justo debajo del bloque de `sources` que completaste en el Paso 2:

```js
  const sources = [ /* ... del Paso 2 ... */ ];

  // TODO (Paso 3): declara aquí la constante `environment`, que activa
  // `network.allowlist` para inyectar la GEMINI_API_KEY (`apiKey`) solo en
  // las llamadas que el sandbox haga hacia generativelanguage.googleapis.com,
  // sin exponer la clave dentro del propio sandbox.
  // Código completo y explicación -> Paso 3 del codelab.

  throw new Error(
    "Completa los Pasos 2 y 3 del codelab en buildEnvironment() (lib/geminiAgent.js).",
  );

  return { sources, ...environment };
```

Reemplaza el bloque del Paso 3 **y borra ahora sí el `throw`** (ya completaste también el Paso 2) por:

```js
  // https://ai.google.dev/gemini-api/docs/agent-environment#credentials
  // Add credentials to the allowlist so they are include in the request during the network egress.
  // This is necessary for the sandbox to be able to call the Gemini API.
  // Using this approach the api key is never exposed to the agent sandbox.
  const environment = {
    type: "remote",
    network: {
      allowlist: [
        { domain: "*" },
        {
          domain: "generativelanguage.googleapis.com",
          transform: {
            "x-goog-api-key": apiKey,
          },
        },
      ],
    },
  };
```

La función completa debe quedar así (sin ningún `throw`):

```js
function buildEnvironment({ base64Image }) {
  const scriptContent = fs.readFileSync(SCRIPT_PATH, "utf-8");

  const sources = [ /* del Paso 2 */ ];

  const environment = { /* del Paso 3, arriba */ };

  return { sources, ...environment };
}
```

## Cómo funciona

- `network.allowlist` es una lista de reglas de egreso: qué dominios puede alcanzar el sandbox por red.
- `{ domain: "*" }` permite salida general (necesaria para que `pip`/dependencias del sandbox funcionen con normalidad).
- La segunda regla es la que importa: para el dominio exacto `generativelanguage.googleapis.com`, `transform` inyecta el header `x-goog-api-key` con el valor de `apiKey` en **cada request saliente** que el sandbox haga a ese dominio — automáticamente, sin que el script Python tenga que leer ninguna variable de entorno ni archivo de credenciales.
- `apiKey` ya está declarada arriba del archivo como constante de módulo (`const apiKey = process.env.GEMINI_API_KEY || "";`), leída de tu `.env` local. Nunca se copia al sandbox: solo vive en tu proceso Node y en la configuración de red que le pasas a la API.

Esto significa que si alguien lograra listar los archivos dentro del sandbox, no encontraría la API key en ninguna parte — solo el script Python haciendo llamadas HTTPS normales, sin credenciales visibles en su propio código ni en disco.

## Verifica

En este punto `buildEnvironment` ya no lanza ningún error propio. Pero la aplicación seguirá fallando al editar una imagen, porque `editImage` (el llamador de esta función) todavía tiene sus propios bloques pendientes — eso es el [Paso 4](../07-paso-4-managed-agent/).
