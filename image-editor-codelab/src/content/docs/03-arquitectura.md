---
title: Tour del proyecto base
description: Qué archivos ya están completos y cuáles bloques de código vas a completar.
---

## Estructura del proyecto

```
image-editor-starter/
├── server.js                  # Rutas Express (subir imagen, sugerencias, editar)
├── lib/
│   ├── geminiAgent.js          # ← 5 bloques a completar (Pasos 1-5)
│   ├── agentEnvironment.js     # Guarda/recupera el estado de sesión (ya completo)
│   ├── imageProcessing.js      # Compresión de imágenes con sharp (ya completo)
│   └── sseProgressBus.js       # Progreso en vivo vía Server-Sent Events (ya completo)
├── scripts/
│   └── edit_image.py           # ← 1 bloque a completar (Paso 6), corre DENTRO del sandbox
└── public/                     # Frontend (HTML/CSS/JS ya completo)
```

## Lo que ya funciona

Todo lo que **no** es el foco de este codelab ya está implementado y no necesitas tocarlo:

- El servidor Express y sus rutas (`server.js`).
- La compresión y conversión de imágenes con `sharp` (`lib/imageProcessing.js`).
- El seguimiento de progreso en vivo con Server-Sent Events (`lib/sseProgressBus.js`).
- El estado de sesión por usuario, que recuerda a qué sandbox (`environmentId`) y a qué interacción (`lastInteractionId`) pertenece cada edición (`lib/agentEnvironment.js`).
- Todo el frontend en `public/` (subida de imagen, chips de sugerencias, comparador antes/después, historial de versiones).

## Lo que vas a completar

Todos los bloques pendientes están marcados con un comentario `// TODO (Paso N): ...` seguido de un `throw`/`raise` que detiene la ejecución con un mensaje claro, indicando exactamente qué paso del codelab lo resuelve.

| Paso | Archivo | Función | Qué hace ese bloque |
|---|---|---|---|
| [1](../04-paso-1-sugerencias/) | `lib/geminiAgent.js` | `generateSuggestions` | Pide a Gemini sugerencias de edición para la imagen subida |
| [2](../05-paso-2-sandbox/) | `lib/geminiAgent.js` | `buildEnvironment` | Monta la imagen y el script Python en un sandbox nuevo |
| [3](../06-paso-3-credenciales/) | `lib/geminiAgent.js` | `buildEnvironment` | Protege la API key con `network.allowlist` |
| [4](../07-paso-4-managed-agent/) | `lib/geminiAgent.js` | `editImage` | Invoca al Managed Agent y crea/continúa la interacción |
| [5](../08-paso-5-descarga/) | `lib/geminiAgent.js` | `downloadAndExtractOutput` | Descarga y extrae el resultado generado en el sandbox |
| [6](../09-paso-6-nano-banana/) | `scripts/edit_image.py` | `main` | Llama a Nano Banana **desde dentro del sandbox** y guarda la imagen editada |

Los Pasos 1 a 5 viven en `lib/geminiAgent.js`, el módulo que corre en tu servidor Express y habla con la Interactions API. El Paso 6 vive en `scripts/edit_image.py`, el script que el Managed Agent ejecuta remotamente dentro del sandbox — ese archivo nunca se ejecuta en tu máquina ni en tu servidor, viaja como contenido de texto hasta el sandbox.

Sigue en orden: cada paso depende de variables que declaraste en el anterior. Empieza con [Paso 1 — Sugerencias con Gemini](../04-paso-1-sugerencias/).
