---
title: "Paso 1 — Sugerencias con Gemini"
description: Pide a Gemini sugerencias de edición estructuradas en JSON a partir de la imagen subida.
---

## Objetivo

Cuando el usuario sube una imagen, la aplicación le muestra "chips" con sugerencias de edición (por ejemplo, "Haz que el carro sea rojo"). Esas sugerencias no son texto libre: son un arreglo JSON generado por Gemini a partir del contenido real de la imagen, usando **salida estructurada** (`responseSchema`).

Esta llamada es una petición normal, sin estado, a `client.models.generateContent(...)` — no usa la Interactions API todavía. La usarás como calentamiento antes de los Managed Agents.

## Dónde va

Abre `lib/geminiAgent.js` y busca la función `generateSuggestions`, cerca del final del archivo. Verás este bloque:

```js
export async function generateSuggestions({
  base64Image,
  mimeType = "image/jpeg",
}) {
  // TODO (Paso 1): llama a `client.models.generateContent({...})` pidiendo
  // el modelo "gemini-3.5-flash", enviando la imagen (`inlineData` con
  // `mimeType`/`base64Image`) junto con un prompt de texto que pida al menos
  // 4 sugerencias de edición en español, y configurando salida estructurada
  // (`responseMimeType: "application/json"` + `responseSchema` de un array
  // de strings con `minItems: 4`). Guarda el resultado en `response`.
  // Código completo y explicación -> Paso 1 del codelab.
  throw new Error(
    "Completa el Paso 1 del codelab en generateSuggestions() (lib/geminiAgent.js).",
  );

  const suggestions = JSON.parse(response.text);
  ...
```

Reemplaza **todo el bloque comentado y el `throw`** (deja intacto lo que viene después, `const suggestions = JSON.parse(response.text);` y el resto de la función) por:

```js
  const response = await client.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64Image } },
          {
            text:
              "Analiza el contenido de esta imagen y genera al menos 4 sugerencias " +
              "cortas y realistas de ediciones en español, basadas estrictamente en " +
              "los elementos detectados (por ejemplo, cambiar el color de un objeto o " +
              "prenda, agregar un accesorio, o modificar el cielo o el fondo). " +
              'Ejemplos de formato: "Haz que el carro sea rojo", ' +
              '"Haz que la camiseta de la persona sea azul".',
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "array",
        items: { type: "string" },
        minItems: 4,
      },
    },
  });
```

## Cómo funciona

- `contents` mezcla dos `parts` en el mismo mensaje: la imagen como `inlineData` (base64 + `mimeType`) y el prompt de texto. Gemini analiza ambos juntos.
- `config.responseSchema` fuerza a que `response.text` sea un JSON válido con la forma exacta que describes — un arreglo de al menos 4 strings — sin que tengas que parsear texto libre ni lidiar con formatos inconsistentes.
- El código que ya estaba debajo del bloque (`JSON.parse(response.text)` + la validación de longitud) queda igual: solo dependía de que existiera la variable `response`.

## Verifica

Guarda el archivo, recarga la aplicación en el navegador y sube una imagen. Deberías ver aparecer al menos 4 chips de sugerencia debajo de la imagen. Si ves un error, revisa que copiaste el bloque completo y que la indentación de llaves quedó balanceada.

Con las sugerencias funcionando, sigue a [Paso 2 — Monta el sandbox](../05-paso-2-sandbox/).
