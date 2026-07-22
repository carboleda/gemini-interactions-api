---
title: Configuración del entorno
description: Descarga el proyecto base, configura tu API key e instala las dependencias.
---

## 1. Descarga el proyecto base

<a href="../downloads/image-editor-starter.zip" download>Descarga `image-editor-starter.zip`</a> y descomprímelo donde prefieras. Es una copia completa del proyecto con la interfaz, el servidor y el frontend ya funcionando — solo faltan 6 bloques de código relacionados con la Interactions API y los Managed Agents, que completarás en los siguientes pasos.

```bash
unzip image-editor-starter.zip -d image-editor-starter
cd image-editor-starter
```

## 2. Configura tu API key

Copia el archivo de ejemplo y agrega tu API key de Gemini:

```bash
cp .env.example .env
```

Edita `.env`:

```
GEMINI_API_KEY=tu_api_key_aqui
PORT=3000
```

:::caution
No subas `.env` a ningún repositorio. El `.gitignore` del proyecto ya lo excluye.
:::

## 3. Instala las dependencias

```bash
npm install
```

## 4. Arranca el servidor

```bash
npm run dev
```

Esto debería levantar el servidor en `http://localhost:3000`. La interfaz cargará y podrás subir una imagen — pero al intentar generar sugerencias o editar, la aplicación **fallará intencionalmente** con un error como:

```
Completa el Paso 1 del codelab en generateSuggestions() (lib/geminiAgent.js).
```

Esto es exactamente lo esperado: son los bloques que vas a completar en los próximos pasos. Continúa a [Tour del proyecto base](../03-arquitectura/) para orientarte en el código antes de empezar.
