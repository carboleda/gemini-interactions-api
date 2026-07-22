---
title: Introducción y conceptos
description: Qué es la Interactions API, qué es un Managed Agent y qué papel juega Nano Banana en este proyecto.
---

## Qué vas a construir

Un editor de imágenes con IA: el usuario sube una foto, la aplicación genera automáticamente sugerencias de edición, y cada edición se ejecuta en un **Managed Agent** que corre un script de Python dentro de un **sandbox remoto en la nube de Google**. Ese script llama a Gemini "Nano Banana" para transformar la imagen y el resultado vuelve al navegador.

<img src="../images/architecture.png" alt="Arquitectura de la aplicación" width="800" />

El servidor nunca procesa píxeles con Nano Banana directamente: solo orquesta la sesión, sube los archivos de entrada al sandbox, dispara el agente, y descarga el resultado cuando termina. Todo el trabajo de IA ocurre remotamente.

## Interactions API: llamadas con estado

La mayoría de las integraciones con LLMs son *stateless*: cada llamada lleva todo el contexto necesario (historial, instrucciones, archivos) porque el servidor no recuerda nada entre peticiones.

La **Interactions API** (`client.interactions.create(...)`) funciona distinto: es **con estado**. Cada llamada crea (o continúa) una **interacción** dentro de un **entorno** — en este proyecto, un sandbox remoto — y la plataforma se encarga de mantener viva esa sesión entre llamadas. Esto te permite:

- Montar archivos una sola vez al crear el entorno, y reutilizarlos en interacciones posteriores sin volver a enviarlos.
- Encadenar interacciones con `previous_interaction_id`, para que el agente recuerde lo que hizo antes en el mismo sandbox.
- Delegar la ejecución real (correr comandos, invocar otros modelos, leer/escribir archivos) al agente, en vez de tener que orquestarla tú mismo turno por turno.

## Managed Agents: agentes que la plataforma ejecuta por ti

Un **Managed Agent** es un agente autónomo — en este caso `antigravity-preview-05-2026` — que la plataforma de Gemini orquesta y ejecuta dentro de un entorno aislado (un sandbox con su propio sistema de archivos y reglas de red), sin que tengas que escribir tú el bucle de razonamiento del agente.

Tú le das:
- Un **entorno** (`environment`): qué archivos montar de entrada, y qué dominios puede alcanzar por red.
- Una **instrucción** (`input`): en este proyecto, literalmente el comando de shell que debe ejecutar (`python /workspace/edit_image.py ...`).

El Managed Agent se encarga de arrancar el sandbox, ejecutar el comando, y dejar los archivos resultantes en el sistema de archivos del entorno para que los descargues después.

## Nano Banana: el modelo que edita la imagen

**Nano Banana** es el nombre informal de la familia de modelos de imagen de Gemini (`gemini-3.1-flash-image`, `gemini-3.1-pro-image`). Es el modelo que de verdad transforma los píxeles, invocado con `response_modalities=[TEXT, IMAGE]` para que la respuesta incluya la imagen editada como datos binarios (`inline_data`).

Un detalle importante de la arquitectura: Nano Banana **no se llama desde tu servidor Express** — se llama desde *dentro* del sandbox, por el script `edit_image.py` que el Managed Agent ejecuta. Tu servidor nunca ve los bytes de la imagen de entrada llegar a Nano Banana directamente; solo ve el resultado final una vez que lo descarga del sandbox.

## Protegiendo la API key sin exponerla en el sandbox

Si el script dentro del sandbox necesita llamar a la API de Gemini, ¿cómo obtiene la API key sin que quede expuesta en el sistema de archivos del sandbox? En este proyecto se usa **`network.allowlist` con `transform`**: una regla de red del entorno que le dice a la plataforma "cuando el sandbox llame a `generativelanguage.googleapis.com`, inyecta este header automáticamente". La clave nunca se escribe en un archivo dentro del sandbox — solo viaja en el tráfico de red saliente, inyectada por la plataforma. Verás el detalle exacto en el [Paso 3](../06-paso-3-credenciales/).

## Lo que vas a aprender

Al completar este codelab sabrás:

- Preparar un `environment` con `sources` inline para montar archivos en `/workspace` dentro de un sandbox nuevo.
- Proteger credenciales con `network.allowlist` en vez de exponerlas como archivos.
- Invocar un Managed Agent con `client.interactions.create(...)` y encadenar interacciones con `previous_interaction_id`.
- Descargar artefactos generados dentro de un sandbox remoto.
- Invocar Gemini Nano Banana con `response_modalities=[TEXT, IMAGE]` para editar imágenes.

## Prerrequisitos

- Node.js 20 o superior.
- Una API key de Gemini (desde [Google AI Studio](https://aistudio.google.com/)).
- Conocimientos básicos de JavaScript/Express asíncrono. No necesitas saber Python de antemano — el script que completarás es corto y se explica línea por línea.

Cuando estés listo, continúa a [Configuración del entorno](../02-configuracion/).
