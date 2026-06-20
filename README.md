# Bonds

PWA para cuidar tus relaciones. Cuenta + sync en la nube, importación inicial con IA (Gemini), y push diario.

## Qué se guarda dónde

| Dato | Dónde |
|---|---|
| Personas, interacciones, notas | Redis (nube) + caché local en el dispositivo |
| Cuenta (email, hash de contraseña) | Redis |
| Suscripción push | Redis |
| Párrafo de importación IA | **No se guarda** — solo se procesa y se descarta |

## Deploy en Vercel

### 1. Upstash Redis

**Storage → Upstash for Redis → Connect** (crea `KV_REST_API_URL` y `KV_REST_API_TOKEN`).

### 2. Variables de entorno (Production)

| Variable | Valor |
|---|---|
| `PUBLIC_APP_URL` | `https://bonds-ten.vercel.app` |
| `JWT_SECRET` | string aleatorio largo |
| `GEMINI_API_KEY` | API key de Google AI Studio |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npm run server:vapid` |
| `VAPID_SUBJECT` | `mailto:tu@email.com` |
| `CRON_SECRET` | string aleatorio |
| `KV_REST_API_*` | los crea Vercel al conectar Redis |

### 3. Verificar

- `/api/health` → `pushReady` y `storeReady` en `true`
- `/api/ai/status` → `geminiReady: true`

### 4. Flujo de usuario

1. `/bienvenida` → crear cuenta
2. Importar red con IA **o** tutorial manual
3. Sync automático al editar personas
4. Push en Ajustes (PWA instalada)

---

## Desarrollo local

```bash
npm start          # frontend (sin SW)
npm run build
npm run server     # API local con server/.env
```

Copiá `server/.env.example` → `server/.env` y completá Redis, JWT, Gemini y VAPID.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run server:vapid` | Generar claves push |
| `npm run build:pwa` | Build + servidor estático simple |
