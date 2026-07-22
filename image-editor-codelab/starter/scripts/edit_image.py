import argparse
import base64

from google import genai
from google.genai.types import GenerateContentConfig, Modality
from PIL import Image
from io import BytesIO


def parse_args():
    parser = argparse.ArgumentParser(description="Edit an image using Gemini Nano Banana.")
    parser.add_argument("--decode", action="store_true", help="Decode --input_base64 into --input first.")
    parser.add_argument("--input_base64", default="/workspace/input.base64")
    parser.add_argument("--input", default="/workspace/input.jpg")
    parser.add_argument("--output", default="/workspace/output.jpg")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--model", default="gemini-3.1-flash-image")
    return parser.parse_args()


def decode_input(input_base64_path, input_path):
    with open(input_base64_path, "r") as f:
        encoded = f.read()
    with open(input_path, "wb") as f:
        f.write(base64.b64decode(encoded))


FACE_PRESERVATION_INSTRUCTION = (
    "No modifiques los rasgos faciales, la identidad, la expresion ni la "
    "estructura del rostro de ninguna persona presente en la imagen, salvo que "
    "la instruccion de edicion lo solicite explicitamente. Aplica el resto de "
    "la instruccion de edicion con normalidad."
)


def build_prompt(user_prompt):
    return f"{FACE_PRESERVATION_INSTRUCTION}\n\nInstruccion de edicion: {user_prompt}"


def main():
    args = parse_args()

    if args.decode:
        decode_input(args.input_base64, args.input)

    client = genai.Client()

    image = Image.open(args.input)

    # TODO (Paso 6): llama a `client.models.generate_content(...)` pasando
    # `model=args.model`, `contents=[image, build_prompt(args.prompt)]` y
    # `config=GenerateContentConfig(response_modalities=[Modality.TEXT, Modality.IMAGE])`.
    # Guarda el resultado en `response`.
    # Código completo y explicación -> Paso 6 del codelab.
    raise NotImplementedError("Completa el Paso 6 del codelab en edit_image.py.")

    # TODO (Paso 6): recorre `response.candidates` / `candidate.content.parts`
    # buscando la parte con `part.inline_data` (los bytes de la imagen
    # generada), ábrela con `PIL.Image.open(BytesIO(part.inline_data.data))`,
    # conviértela a RGB y guárdala en `args.output` como JPEG. Marca
    # `saved = True` cuando lo logres.
    # Código completo y explicación -> Paso 6 del codelab.
    saved = False

    if not saved:
        raise RuntimeError("No image data was returned by the model.")

    print(f"Saved edited image to {args.output}")


if __name__ == "__main__":
    main()
