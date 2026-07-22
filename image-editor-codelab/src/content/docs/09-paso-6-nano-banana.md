---
title: "Paso 6 — Nano Banana en el sandbox"
description: Llama a Gemini Nano Banana desde dentro del sandbox para generar la imagen editada.
---

## Objetivo

Este es el único paso que no vive en `lib/geminiAgent.js`. `scripts/edit_image.py` es el script que el Managed Agent ejecuta **dentro del sandbox remoto** — nunca corre en tu servidor ni en tu máquina local. Viaja como texto plano montado por `sources` en el [Paso 2](../05-paso-2-sandbox/), y es aquí donde finalmente se llama a Nano Banana para editar la imagen.

Abre `scripts/edit_image.py`. Hay dos bloques pendientes dentro de `main()`.

## Bloque 1: llamar a Nano Banana

```python
    image = Image.open(args.input)

    # TODO (Paso 6): llama a `client.models.generate_content(...)` pasando
    # `model=args.model`, `contents=[image, build_prompt(args.prompt)]` y
    # `config=GenerateContentConfig(response_modalities=[Modality.TEXT, Modality.IMAGE])`.
    # Guarda el resultado en `response`.
    # Código completo y explicación -> Paso 6 del codelab.
    raise NotImplementedError("Completa el Paso 6 del codelab en edit_image.py.")
```

Reemplaza el comentario y el `raise` por:

```python
    response = client.models.generate_content(
        model=args.model,
        contents=[image, build_prompt(args.prompt)],
        config=GenerateContentConfig(
            response_modalities=[Modality.TEXT, Modality.IMAGE]
        ),
    )
```

## Bloque 2: extraer y guardar la imagen resultante

Justo debajo:

```python
    # TODO (Paso 6): recorre `response.candidates` / `candidate.content.parts`
    # buscando la parte con `part.inline_data` (los bytes de la imagen
    # generada), ábrela con `PIL.Image.open(BytesIO(part.inline_data.data))`,
    # conviértela a RGB y guárdala en `args.output` como JPEG. Marca
    # `saved = True` cuando lo logres.
    # Código completo y explicación -> Paso 6 del codelab.
    saved = False

    if not saved:
        raise RuntimeError("No image data was returned by the model.")
```

Reemplaza solo el bloque de comentario y `saved = False` (deja el `if not saved: raise ...` tal cual, es la validación final) por:

```python
    saved = False
    for candidate in response.candidates:
        for part in candidate.content.parts:
            if part.inline_data is not None:
                result_image = Image.open(BytesIO(part.inline_data.data))
                result_image.convert("RGB").save(args.output, "JPEG")
                saved = True
                break
        if saved:
            break
```

## Cómo funciona

- `contents=[image, build_prompt(args.prompt)]` envía la imagen ya decodificada (un objeto `PIL.Image`, no base64) junto con el prompt final, que `build_prompt` compone agregando siempre la instrucción de preservación facial (`FACE_PRESERVATION_INSTRUCTION`) antes de la instrucción del usuario.
- `response_modalities=[Modality.TEXT, Modality.IMAGE]` es lo que hace que Nano Banana pueda devolver **datos de imagen binarios** en la respuesta, no solo texto. Sin esto, el modelo respondería con texto describiendo el cambio, en vez de generar la imagen editada.
- La respuesta puede traer varias `parts` por candidato (por ejemplo, texto explicativo y la imagen). El bucle recorre `response.candidates` → `candidate.content.parts` buscando específicamente la parte con `inline_data` (los bytes crudos de la imagen), ignorando cualquier parte de texto.
- `Image.open(BytesIO(part.inline_data.data))` decodifica esos bytes como imagen; `.convert("RGB")` normaliza el modo de color antes de guardarla como JPEG (algunos formatos de salida usan RGBA, que JPEG no soporta directamente).
- El script guarda el resultado en `args.output` (`/workspace/output.jpg` por defecto) — la misma ruta que, de vuelta en Express, `downloadAndExtractOutput` (Paso 5) descarga y extrae del snapshot del sandbox.

## Verifica

Con los 6 pasos completos, el flujo entero debería funcionar de extremo a extremo. Sigue a [Prueba de extremo a extremo](../10-prueba-final/) para confirmarlo con una checklist completa.
