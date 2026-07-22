---
title: Conclusión
description: Resumen de lo aprendido y próximos pasos.
---

## Lo que construiste

Un editor de imágenes completo donde cada edición se ejecuta en un Managed Agent, corriendo un script Python dentro de un sandbox remoto, que a su vez llama a Gemini Nano Banana para transformar la imagen. En el camino:

- Usaste `client.models.generateContent` con `responseSchema` para obtener sugerencias estructuradas a partir de una imagen (**Paso 1**).
- Montaste archivos en un sandbox nuevo con `sources` de tipo `inline` (**Paso 2**).
- Protegiste una API key con `network.allowlist` y `transform`, sin exponerla nunca dentro del sandbox (**Paso 3**).
- Invocaste un Managed Agent con `client.interactions.create(...)`, y encadenaste ediciones sucesivas reutilizando el mismo sandbox vía `environment_id` y `previous_interaction_id` (**Paso 4**).
- Descargaste un snapshot de un entorno remoto y extrajiste selectivamente el archivo que necesitabas (**Paso 5**).
- Llamaste a Nano Banana con `response_modalities=[TEXT, IMAGE]` desde dentro del sandbox, y procesaste la imagen binaria de la respuesta (**Paso 6**).

## Para seguir explorando

- Documentación de la Interactions API y Managed Agents: [ai.google.dev/gemini-api/docs/agent-environment](https://ai.google.dev/gemini-api/docs/agent-environment)
- Configuración de credenciales por `network.allowlist`: [ai.google.dev/gemini-api/docs/agent-environment#credentials](https://ai.google.dev/gemini-api/docs/agent-environment#credentials)
- Modelos de imagen de Gemini ("Nano Banana"): [ai.google.dev/gemini-api/docs/image-generation](https://ai.google.dev/gemini-api/docs/image-generation)

Algunas ideas para extender el proyecto por tu cuenta:

- Agregar soporte para editar varias imágenes en paralelo, cada una con su propio sandbox.
- Exponer en la interfaz el historial completo de versiones guardado en `/history` dentro del sandbox.
- Restringir el `network.allowlist` a solo los dominios estrictamente necesarios, en vez de `{ domain: "*" }`, si vas a llevar este patrón a producción.

Gracias por completar el codelab. Este formato — página de conceptos, pasos guiados con el código completo y explicado, y prueba final — está inspirado en el [codelab oficial de la Interactions API](https://codelabs.developers.google.com/gemini-interactions-java-sdk).
