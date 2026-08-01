# Gemini Interactions API

Sandbox de proyectos y ejemplos para explorar la **Interactions API** de Gemini: agentes gestionados (Managed Agents), ejecución en background, sandboxes remotos y generación/edición de imágenes con Nano Banana.

## Configuración común

La mayoría de los proyectos leen las variables de entorno desde un archivo `.env` en la raíz del repositorio (ver los scripts `--env-file ../.env` en cada `package.json`).

```bash
cp .env.example .env   # si no existe, créalo con al menos:
# GEMINI_API_KEY=tu_api_key_aqui
```

Puedes obtener una API key en [Google AI Studio](https://aistudio.google.com/api-keys).

## Estructura del repositorio

### [`first-steps/`](first-steps)

Ejemplos mínimos en Node.js para empezar con la Interactions API: crear un agente (`antigravity-preview-05-2026`), lanzarlo en modo `background`, hacer polling de una interacción y listar agentes.

```bash
cd first-steps
npm install
npm run first:start      # crea/ejecuta el agente de ejemplo
npm run first:download    # descarga resultados generados por el agente
```

### [`image-editor/`](image-editor)

Aplicación completa: un **editor de imágenes** con frontend (HTML/CSS/JS) y backend Express que usa un Managed Agent remoto (con sandbox persistente por sesión) más el modelo `gemini-3.1-flash-image` (Nano Banana) para aplicar ediciones descritas en lenguaje natural, con progreso en tiempo real vía SSE.

```bash
cd image-editor
npm install
npm run setup:agent   # crea el agente administrado
npm start             # arranca el servidor en http://localhost:3000
```

Ver [`image-editor/specs/specification.md`](image-editor/specs/specification.md) para la especificación técnica completa (arquitectura, endpoints, flujos de sandbox).

### [`image-editor-codelab/`](image-editor-codelab)

Sitio Astro/Starlight con el **codelab paso a paso** para construir el editor de imágenes desde cero (sugerencias con Interactions API, sandbox remoto, credenciales, Managed Agent con background execution + polling, integración con Nano Banana). Se despliega automáticamente a GitHub Pages ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) en cada push a `main` que modifique esta carpeta.

```bash
cd image-editor-codelab
npm install
npm run dev      # sirve el codelab localmente
npm run build    # genera el sitio estático (dist/)
```

El proyecto [`image-editor-codelab/starter/`](image-editor-codelab/starter) es el punto de partida (starter kit) que los usuarios del codelab descargan para seguir los pasos; se empaqueta automáticamente como `.zip` durante `predev`/`prebuild` (ver [`scripts/build-downloads.mjs`](image-editor-codelab/scripts/build-downloads.mjs)).

### [`custom-agent/`](custom-agent)

Espacio de trabajo en progreso para definir un agente personalizado (`.agents/AGENT.md`) usando el sistema de skills.

### [`.agents/skills/gemini-interactions-api/`](.agents/skills/gemini-interactions-api)

Skill de referencia con las reglas y modelos vigentes de la Interactions API (modelos actuales, agentes gestionados disponibles, SDKs) pensada para asistir a agentes de código al escribir integraciones con Gemini.

## Notas

- Los scripts npm de cada subproyecto asumen un `.env` compartido en la raíz (`../.env`); no lo subas al repositorio (ya está en `.gitignore`).
