---
description: Instrucciones para crear aplicaciones con MCP
globs: *
alwaysApply: true
---

# Documentación del SDK de InsForge - Descripción general

## ¿Qué es InsForge?

Plataforma Backend-as-a-Service (BaaS) que ofrece:

- **Base de datos**: PostgreSQL con API PostgREST
- **Autenticación**: Email/contraseña + OAuth (Google, GitHub)
- **Almacenamiento**: Subida/descarga de archivos
- **IA**: Aprovisionamiento de clave OpenRouter y catálogo de modelos para integraciones directas compatibles con OpenAI
- **Funciones**: Despliegue de funciones serverless
- **Tiempo real**: Pub/sub por WebSocket (eventos de base de datos + cliente)

## Instalación

La siguiente es una guía paso a paso para instalar y usar el SDK TypeScript de InsForge en aplicaciones web. Si estás creando otros tipos de aplicaciones, consulta:
- [Documentación del SDK de Swift](/sdks/swift/overview) para aplicaciones iOS, macOS, tvOS y watchOS.
- [Documentación del SDK de Kotlin](/sdks/kotlin/overview) para aplicaciones Android.
- [Documentación de la API REST](/sdks/rest/overview) para acceso directo por HTTP.

### 🚨 CRÍTICO: Sigue estos pasos en orden

### Paso 1: Descargar la plantilla

Usa la herramienta MCP `download-template` para crear un proyecto nuevo con tu URL de backend y tu anon key ya configuradas.

### Paso 2: Instalar el SDK

```bash
npm install @insforge/sdk@latest
```

### Paso 3: Crear el cliente del SDK

Debes crear una instancia del cliente con `createClient()` usando tu URL base y tu anon key:

```javascript
import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://your-app.region.insforge.app',  // URL de tu backend InsForge
  anonKey: 'your-anon-key-here'       // Obtén esto de los metadatos del backend
});

```

**URL BASE DE LA API**: Tu URL base de la API es `https://your-app.region.insforge.app`.

## Obtener documentación detallada

### 🚨 CRÍTICO: Consulta siempre la documentación antes de escribir código

InsForge proporciona SDKs oficiales y APIs REST; úsalos para interactuar con los servicios de InsForge desde el código de tu aplicación.

- [SDK de TypeScript](/sdks/typescript/overview) - JavaScript/TypeScript
- [SDK de Swift](/sdks/swift/overview) - iOS, macOS, tvOS y watchOS
- [SDK de Kotlin](/sdks/kotlin/overview) - Android y Kotlin Multiplatform
- [API REST](/sdks/rest/overview) - Acceso directo por HTTP

Antes de escribir o editar cualquier código de integración con InsForge, **DEBES** llamar a la herramienta MCP `fetch-docs` o `fetch-sdk-docs` para obtener la documentación más reciente del SDK. Así te aseguras de tener patrones de implementación precisos y actualizados.

### Usa la herramienta MCP `fetch-docs` de InsForge para obtener documentación específica del SDK:

Tipos de documentación disponibles:

- `"instructions"` - Configuración esencial del backend (EMPIEZA AQUÍ)
- `"real-time"` - Pub/sub en tiempo real (eventos de base de datos + cliente) mediante WebSockets
- `"db-sdk-typescript"` - Operaciones de base de datos con el SDK de TypeScript
- **Autenticación** - Elige según la implementación:
  - `"auth-sdk-typescript"` - Métodos del SDK de TypeScript para flujos de autenticación personalizados
  - `"auth-components-react"` - UI de autenticación preconstruida para React+Vite (aplicación de una sola página)
  - `"auth-components-react-router"` - UI de autenticación preconstruida para React (Vite+React Router) (aplicación multipágina)
  - `"auth-components-nextjs"` - UI de autenticación preconstruida para Next.js (aplicación SSR)
- `"storage-sdk"` - Operaciones de almacenamiento de archivos
- `"functions-sdk"` - Invocación de funciones serverless
- `"ai-integration-sdk"` - Integración de IA con la clave OpenRouter aprovisionada y el SDK de OpenAI
- `"deployment"` - Desplegar aplicaciones frontend mediante la herramienta MCP
- `"payments"` - Stripe Checkout, Billing Portal, proyecciones de webhooks y patrones de fulfillment

Esta documentación es principalmente para el SDK de TypeScript. Para otros lenguajes, también puedes usar la herramienta MCP `fetch-sdk-docs` para obtener documentación específica.

### Usa la herramienta MCP `fetch-sdk-docs` de InsForge para obtener documentación específica del SDK

Puedes obtener la documentación del SDK con la herramienta MCP `fetch-sdk-docs` indicando un tipo de característica y un lenguaje.

Tipos de características disponibles:
- `db` - Operaciones de base de datos
- `storage` - Operaciones de almacenamiento de archivos
- `functions` - Invocación de funciones serverless
- `auth` - Autenticación de usuarios
- `ai` - Integración de IA con la clave OpenRouter aprovisionada y el SDK de OpenAI
- `realtime` - Pub/sub en tiempo real (eventos de base de datos + cliente) mediante WebSockets
- `payments` - Stripe Checkout y Billing Portal con fulfillment basado en webhooks

Lenguajes disponibles:
- `typescript` - SDK de JavaScript/TypeScript
- `swift` - SDK de Swift (para iOS, macOS, tvOS y watchOS)
- `kotlin` - SDK de Kotlin (para aplicaciones Android y JVM)
- `rest-api` - API REST

Actualmente Payments solo tiene documentación del SDK de TypeScript. Usa la referencia de la API de Payments para clientes que no sean TypeScript.

## Cuándo usar el SDK y cuándo las herramientas MCP

### Usa siempre el SDK para la lógica de la aplicación:

- Autenticación (registro, inicio y cierre de sesión, perfiles)
- CRUD de base de datos (select, insert, update, delete)
- Operaciones de almacenamiento (subir y descargar archivos)
- Integración de IA mediante la clave OpenRouter aprovisionada con el SDK de OpenAI o la API HTTP de OpenRouter
- Invocación de funciones serverless
- Creación de sesiones de checkout de pagos y del portal de cliente

### Usa las herramientas MCP para la infraestructura:

- Scaffolding del proyecto (`download-template`) - Descargar plantillas de inicio con integración de InsForge
- Configuración y metadatos del backend (`get-backend-metadata`)
- Gestión del esquema de base de datos (`run-raw-sql`, `get-table-schema`)
- Creación de buckets de almacenamiento (`create-bucket`, `list-buckets`, `delete-bucket`)
- Despliegue de funciones serverless (`create-function`, `update-function`, `delete-function`)
- Despliegue de frontend (`create-deployment`) - Desplegar aplicaciones frontend en el hosting de InsForge

## Notas importantes

- Para autenticación: usa `auth-sdk` para UI personalizada, o componentes específicos del framework para UI preconstruida
- El SDK devuelve una estructura `{data, error}` en todas las operaciones
- Las inserciones en base de datos requieren formato de array: `[{...}]`
- Las funciones serverless tienen un único endpoint y no admiten rutas anidadas
- Almacenamiento: sube archivos a buckets y guarda las URL en la base de datos
- Las integraciones de IA deben llamar directamente a OpenRouter con `baseURL: "https://openrouter.ai/api/v1"` y una `OPENROUTER_API_KEY` en el servidor
- **MUY IMPORTANTE**: Usa Tailwind CSS 3.4 (no actualices a v4). Fija estas dependencias en `package.json`

<!-- INSFORGE:START -->
## Backend de InsForge

Este proyecto usa [InsForge](https://insforge.dev): un backend todo-en-uno, de código abierto y basado en Postgres (BaaS) que proporciona a esta aplicación base de datos, autenticación, almacenamiento de archivos, funciones edge, tiempo real, una pasarela de modelos de IA y pagos a través de una sola plataforma.

- **Proyecto:** **oss-project** (base de la API `https://insforge.benicolo.com`)
- **Skills:** estas skills de InsForge están instaladas para los agentes de código compatibles. Recurre a ellas antes de implementar cualquier característica de InsForge en lugar de adivinar la API:
  - `insforge`: código de aplicación con el cliente `@insforge/sdk` (CRUD de base de datos, autenticación, almacenamiento, funciones edge, tiempo real, IA, email y pagos con Stripe).
  - `insforge-cli`: backend e infraestructura mediante la CLI `insforge` (proyectos, SQL, migraciones, políticas RLS, buckets de almacenamiento, funciones, secretos, configuración de pagos, programaciones, despliegues).
  - `insforge-debug`: diagnóstico de fallos (errores del SDK/HTTP, denegaciones de RLS, problemas de autenticación y OAuth) y ejecución de auditorías de seguridad o rendimiento.
  - `insforge-integrations`: conectar proveedores de autenticación externos (Clerk, Auth0, WorkOS, Better Auth, etc.) para RLS basado en JWT, o el facilitador de pagos OKX x402.
  - `find-skills`: descubrir skills adicionales a demanda.
- **Credenciales:** el código de la aplicación lee las claves de `.env.local`; la CLI las lee de `.insforge/project.json`. Nunca escribas ni subas claves al repositorio.

Patrones clave:

- Las inserciones en base de datos toman un array: `insert([{ ... }])`.
- Referencia a los usuarios con `auth.users(id)`; usa `auth.uid()` en las políticas RLS.
- Para subidas a almacenamiento, conserva tanto la `url` como la `key` devueltas.
<!-- INSFORGE:END -->
