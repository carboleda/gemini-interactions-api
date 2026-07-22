import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// NOTE: `base` asume que este sitio se publica como GitHub Pages de
// *proyecto* en https://<usuario>.github.io/image-editor-codelab/.
// - Si el repositorio real tiene otro nombre, cambia `PROD_BASE` (y `SITE`)
//   para que coincida.
// - Si en cambio se publica como página raíz de usuario/organización
//   (repo `<usuario>.github.io`), usa `PROD_BASE = "/"`.
// En `astro dev` siempre se usa "/": Astro aplica `base` también en local, y
// no tiene sentido navegar a http://localhost:4321/image-editor-codelab/ para
// probar cambios. `astro preview` sirve el `dist/` ya compilado, así que debe
// usar el mismo base que `astro build` para que las rutas coincidan.
const SITE = "https://TU-USUARIO.github.io";
const PROD_BASE = "/image-editor-codelab";
const isDev = process.argv.includes("dev");

export default defineConfig({
  site: SITE,
  base: isDev ? "/" : PROD_BASE,
  integrations: [
    starlight({
      title: "Editor de Imágenes con Interactions API",
      description:
        "Construye un Editor de Imágenes usando Interactions API y Managed Agents",
      defaultLocale: "es",
      locales: {
        root: { label: "Español", lang: "es" },
      },
      social: [
        {
          icon: "external",
          label: "Documentación de Gemini",
          href: "https://ai.google.dev/gemini-api/docs/agent-environment",
        },
      ],
      sidebar: [
        {
          label: "Codelab",
          items: [
            { label: "Introducción y conceptos", slug: "01-introduccion" },
            { label: "Configuración del entorno", slug: "02-configuracion" },
            { label: "Tour del proyecto base", slug: "03-arquitectura" },
            {
              label: "Paso 1 — Sugerencias con Gemini",
              slug: "04-paso-1-sugerencias",
            },
            {
              label: "Paso 2 — Monta el sandbox",
              slug: "05-paso-2-sandbox",
            },
            {
              label: "Paso 3 — Protege la API key",
              slug: "06-paso-3-credenciales",
            },
            {
              label: "Paso 4 — Invoca al Managed Agent",
              slug: "07-paso-4-managed-agent",
            },
            {
              label: "Paso 5 — Descarga el resultado",
              slug: "08-paso-5-descarga",
            },
            {
              label: "Paso 6 — Nano Banana en el sandbox",
              slug: "09-paso-6-nano-banana",
            },
            { label: "Prueba de extremo a extremo", slug: "10-prueba-final" },
            { label: "Conclusión", slug: "11-conclusion" },
          ],
        },
      ],
    }),
  ],
});
