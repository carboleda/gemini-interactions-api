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

    response = client.models.generate_content(
        model=args.model,
        contents=[image, build_prompt(args.prompt)],
        config=GenerateContentConfig(
            response_modalities=[Modality.TEXT, Modality.IMAGE]
        ),
    )

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

    if not saved:
        raise RuntimeError("No image data was returned by the model.")

    print(f"Saved edited image to {args.output}")


if __name__ == "__main__":
    main()
