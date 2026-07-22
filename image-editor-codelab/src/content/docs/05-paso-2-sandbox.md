---
title: "Paso 2 — Monta el sandbox"
description: Declara los archivos que el Managed Agent necesita dentro de /workspace al crear un sandbox nuevo.
---

## Objetivo

Antes de poder ejecutar `edit_image.py` remotamente, ese script y la imagen de entrada tienen que existir dentro del sandbox. Esto se hace con `sources`: una lista de archivos que la Interactions API monta en el sistema de archivos del entorno al crearlo.

## Dónde va

En `lib/geminiAgent.js`, dentro de `buildEnvironment`, verás:

```js
function buildEnvironment({ base64Image }) {
  const scriptContent = fs.readFileSync(SCRIPT_PATH, "utf-8");

  // TODO (Paso 2): declara aquí la constante `sources`, un arreglo con los
  // dos archivos que el Managed Agent necesita en /workspace: la imagen del
  // usuario (`base64Image` -> /workspace/input.base64) y el script de
  // edición (`scriptContent` -> /workspace/edit_image.py).
  // Código completo y explicación -> Paso 2 del codelab.

  // TODO (Paso 3): ...

  throw new Error(
    "Completa los Pasos 2 y 3 del codelab en buildEnvironment() (lib/geminiAgent.js).",
  );

  return { sources, ...environment };
}
```

Reemplaza el bloque del **Paso 2** (déjalo debajo de `const scriptContent = ...` y encima del TODO del Paso 3, que resolverás en la próxima página) por:

```js
  const sources = [
    {
      type: "inline",
      content: base64Image,
      target: "/workspace/input.base64",
    },
    {
      type: "inline",
      content: scriptContent,
      target: "/workspace/edit_image.py",
    },
  ];
```

No borres todavía el `throw` ni el TODO del Paso 3 — los completarás en la siguiente página. Es normal que el archivo no compile/funcione hasta terminar ambos.

## Cómo funciona

- Cada entrada de `sources` es de tipo `"inline"`: el `content` viaja como texto dentro del propio request de creación del entorno (no es una URL ni una referencia a un archivo ya subido).
- `target` es la ruta absoluta donde ese contenido aparecerá dentro del sandbox. Aquí usamos `/workspace`, la carpeta de trabajo estándar del agente.
- La imagen viaja como **base64 sin decodificar** (`/workspace/input.base64`) porque `sources` solo transporta texto — el propio `edit_image.py` se encargará de decodificarla a JPEG dentro del sandbox (verás el flag `--decode` más adelante).
- El script Python (`scriptContent`) se lee del disco local con `fs.readFileSync(SCRIPT_PATH, ...)` **cada vez que se crea un sandbox nuevo** — así cualquier cambio que hagas en `scripts/edit_image.py` se refleja automáticamente en la próxima edición, sin necesidad de "desplegar" el script por separado.

:::note
Hay una restricción importante de la API: **no puedes combinar `environment.sources` con `environment.environment_id` en la misma llamada** — intentarlo devuelve un error 400. `sources` solo se puede usar al crear un entorno nuevo desde cero. Por eso `buildEnvironment` solo se invoca para la primera edición de una sesión; verás cómo se reutiliza el sandbox en ediciones siguientes en el [Paso 4](../07-paso-4-managed-agent/).
:::

Continúa a [Paso 3 — Protege la API key](../06-paso-3-credenciales/) para terminar `buildEnvironment`.
