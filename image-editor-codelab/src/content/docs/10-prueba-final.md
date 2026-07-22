---
title: Prueba de extremo a extremo
description: Checklist completa para validar el flujo y guía de troubleshooting de los errores más comunes.
---

## Checklist

Con los 6 pasos completos y el servidor corriendo (`npm run dev`), verifica en el navegador:

- [ ] **Subir imagen**: al subir una foto, aparece en el panel principal.
- [ ] **Sugerencias**: aparecen al menos 4 chips con sugerencias de edición en español, generadas a partir del contenido real de la imagen (Paso 1).
- [ ] **Primera edición**: al elegir una sugerencia (o escribir tu propio prompt) y confirmar, ves los mensajes de progreso ("Inicializando sandbox remoto...", "Ejecutando Python script en sandbox...", "Llamando a Nano Banana...", "Descargando resultado del sandbox...") y al final la imagen editada.
- [ ] **Comparador antes/después**: puedes alternar entre la imagen original y la editada.
- [ ] **Segunda edición sobre el resultado**: pide una nueva edición sobre la imagen ya editada. Deberías ver "Reutilizando sandbox remoto..." en vez de "Inicializando..." — confirma que `environment_id` se está reutilizando (Paso 4) en vez de crear un sandbox nuevo.
- [ ] **Historial de versiones**: puedes volver a una versión anterior y editar a partir de ella.

Si todos estos puntos funcionan, completaste correctamente los 6 pasos.

## Troubleshooting

**Error 400 al crear la interacción, mencionando `environment_id` y `sources`**
La Interactions API rechaza cualquier llamada que combine `environment.environment_id` con `environment.sources` en el mismo request. Revisa el [Paso 4](../07-paso-4-managed-agent/): `environment` debe ser *o* `{ type: "remote", environment_id: ... }` (continuación) *o* el resultado de `buildEnvironment(...)` (primera edición) — nunca ambos combinados.

**El agente responde pero `previous_interaction_id` parece ignorarse**
Ese campo va en el nivel superior de `createParams` (junto a `agent`, `input`, `environment`), no anidado dentro de `environment`. Revisa el [Paso 4](../07-paso-4-managed-agent/).

**"No image data was returned by the model" al editar**
Viene de `edit_image.py`, ejecutándose dentro del sandbox. Revisa el [Paso 6](../09-paso-6-nano-banana/): confirma que `config=GenerateContentConfig(response_modalities=[Modality.TEXT, Modality.IMAGE])` está presente — sin `Modality.IMAGE`, el modelo puede responder solo con texto y ninguna `part` tendrá `inline_data`.

**"El sandbox no generó el archivo /workspace/output.jpg esperado"**
Puede ser un fallo real de Nano Banana (revisa el Paso 6), o que la descarga del snapshot en el [Paso 5](../08-paso-5-descarga/) no esté extrayendo la ruta correcta con `tar`. Confirma que el argumento pasado a `execFileSync("tar", [...])` es exactamente `./workspace/output.jpg` (con el `./` inicial).

**401 / 403 al llamar a la API de Gemini desde el sandbox**
Revisa el [Paso 3](../06-paso-3-credenciales/): la regla de `network.allowlist` para `generativelanguage.googleapis.com` debe incluir el `transform` con `"x-goog-api-key": apiKey`, y `apiKey` debe estar leyendo un valor real desde tu `.env` (`GEMINI_API_KEY`).

**El error sigue mencionando "Completa el Paso N..."**
Ese `throw`/`raise` es justamente el marcador que puso el proyecto starter — significa que ese bloque específico todavía no se reemplazó, o que la sustitución dejó el `throw` original sin borrar. Repasa la página de ese paso.

Cuando todo funcione, continúa a la [Conclusión](../11-conclusion/).
