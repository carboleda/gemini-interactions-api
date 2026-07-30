---
title: "Paso 1 — Sugerencias con Gemini"
description: Pide a Gemini sugerencias de edición estructuradas en JSON a partir de la imagen subida, usando la Interactions API.
---

## Objetivo

Cuando el usuario sube una imagen, la aplicación le muestra "chips" con sugerencias de edición (por ejemplo, "Haz que el carro sea rojo"). Esas sugerencias no son texto libre: son un arreglo JSON generado por Gemini a partir del contenido real de la imagen, usando **salida estructurada** (`response_format`).

Esta llamada usa la **Interactions API** (`client.interactions.create(...)`), igual que el Managed Agent que verás en el Paso 4 — pero en su forma más simple: sin `agent` ni `environment`, solo un `model` y un `input` con texto e imagen. Es una interacción puntual, sin estado que continuar entre llamadas; te sirve de calentamiento antes de usar la misma API con Managed Agents.

## Dónde va

Abre `lib/geminiAgent.js` y busca la función `generateSuggestions`, cerca del final del archivo. Verás este bloque:

```js
export async function generateSuggestions({
  base64Image,
  mimeType = "image/jpeg",
}) {
  // TODO (Paso 1): llama a `client.interactions.create({...})` pidiendo el
  // modelo "gemini-3.5-flash", con un `input` de dos partes — un
  // { type: "text", text: "..." } con el prompt que pide al menos 4
  // sugerencias en español, y un { type: "image", data: base64Image,
  // mime_type: mimeType } con la imagen — y `response_format` para forzar
  // salida JSON (array de al menos 4 strings). Guarda el resultado en
  // `interaction`.
  // Código completo y explicación -> Paso 1 del codelab.
  throw new Error(
    "Completa el Paso 1 del codelab en generateSuggestions() (lib/geminiAgent.js).",
  );

  const suggestions = JSON.parse(interaction.output_text);
  ...
```

Reemplaza **todo el bloque comentado y el `throw`** (deja intacto lo que viene después, `const suggestions = JSON.parse(interaction.output_text);` y el resto de la función) por:

```js
  const interaction = await client.interactions.create({
    model: "gemini-3.5-flash",
    input: [
      {
        type: "text",
        text:
          "Analiza el contenido de esta imagen y genera al menos 4 sugerencias " +
          "cortas y realistas de ediciones en español, basadas estrictamente en " +
          "los elementos detectados (por ejemplo, cambiar el color de un objeto o " +
          "prenda, agregar un accesorio, o modificar el cielo o el fondo). " +
          'Ejemplos de formato: "Haz que el carro sea rojo", ' +
          '"Haz que la camiseta de la persona sea azul".',
      },
      {
        type: "image",
        data: base64Image,
        mime_type: mimeType,
      },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: {
        type: "array",
        items: { type: "string" },
        minItems: 4,
      },
    },
  });
```

## Cómo funciona

- `input` es un arreglo de partes heterogéneas: un bloque `{ type: "text" }` con el prompt y un bloque `{ type: "image" }` con la imagen en base64 (`data`) y su `mime_type`. Gemini analiza ambas partes juntas en una sola interacción.
- `response_format` es, en la Interactions API, el equivalente a `responseSchema`/`responseMimeType` de la Generation API: fuerza a que `interaction.output_text` sea un JSON válido con la forma exacta que describes — un arreglo de al menos 4 strings.
- Como no se pasan `agent` ni `environment`, esta interacción no crea ningún sandbox: es una llamada directa a un modelo, en el mismo estilo que verás en el Paso 4 pero sin estado que mantener entre llamadas.
- El código que ya estaba debajo del bloque (`JSON.parse(...)` + la validación de longitud) queda igual, solo que ahora lee `interaction.output_text` en vez de `response.text`.

## Verifica

Guarda el archivo, recarga la aplicación en el navegador y sube una imagen. Deberías ver aparecer al menos 4 chips de sugerencia debajo de la imagen. Si ves un error, revisa que copiaste el bloque completo y que la indentación de llaves quedó balanceada.

Con las sugerencias funcionando, sigue a [Paso 2 — Monta el sandbox](../05-paso-2-sandbox/).
