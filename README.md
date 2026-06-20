# Bonds

PWA para cuidar tus relaciones. Los datos viven en el dispositivo; el servidor push solo guarda la suscripción y un resumen mínimo (nombres + días sin contacto) para enviar recordatorios diarios.

## Deploy en Vercel (recomendado)

El repo ya incluye `vercel.json` y las funciones en `/api`. La PWA y el API push comparten el mismo dominio HTTPS.

### 1. Upstash Redis (almacenamiento persistente)

En Vercel el filesystem es efímero; las suscripciones push se guardan en Redis.

1. Entrá a [vercel.com](https://vercel.com) → tu proyecto **bonds**
2. **Storage** → **Create Database** → **Upstash for Redis**
3. Conectala al proyecto (Vercel agrega `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` solo)

### 2. Claves VAPID

En tu máquina:

```bash
npm run server:vapid
```

Copiá `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (ej. `mailto:tu@email.com`).

### 3. Variables de entorno en Vercel

**Settings → Environment Variables** (Production):

| Variable | Valor |
|---|---|
| `VAPID_PUBLIC_KEY` | de `npm run server:vapid` |
| `VAPID_PRIVATE_KEY` | de `npm run server:vapid` |
| `VAPID_SUBJECT` | `mailto:tu@email.com` |
| `PUBLIC_APP_URL` | `https://tu-proyecto.vercel.app` |
| `CRON_SECRET` | string aleatorio largo (ej. `openssl rand -hex 32`) |
| `DEFAULT_DIGEST_HOUR` | `9` |
| `UPSTASH_REDIS_REST_*` | las crea Vercel al conectar Upstash |

`PUBLIC_APP_URL` debe ser la URL **final** con HTTPS (iconos en las notificaciones).

### 4. Redeploy

```bash
git push
```

O **Deployments → Redeploy** en Vercel.

Build command: `npm run build`  
Output: `dist/bonds-app/browser` (ya está en `vercel.json`)

### 5. Verificar

Abrí `https://tu-proyecto.vercel.app/api/health`. Deberías ver:

```json
{
  "ok": true,
  "pushReady": true,
  "storeReady": true,
  "publicAppUrl": "https://tu-proyecto.vercel.app"
}
```

Si `storeReady` es `false`, falta conectar Upstash Redis.

### 6. Activar push en el teléfono

1. Abrí la URL de Vercel en el navegador
2. **Instalá** la PWA (en iPhone: Safari → Compartir → Agregar a inicio)
3. Abrí desde el ícono → **Ajustes** → activar recordatorios
4. Tocá **Probar notificación ahora**

El cron de Vercel llama `/api/cron/digest` **una vez al día** (~17:00 UTC, compatible con plan Hobby) y envía **como máximo un digest por día** por dispositivo. En plan Pro podés cambiar el schedule en `vercel.json` a cada hora (`0 * * * *`) para avisos más precisos por zona horaria.

---

## Desarrollo local (solo frontend)

```bash
npm start
```

En modo dev el service worker está desactivado; push no aplica.

## Push local (opcional)

```bash
npm run server:install
npm run server:vapid   # → server/.env
npm run build
npm run server
```

## Scripts útiles

| Comando | Qué hace |
|---|---|
| `npm run build:pwa` | Build + servidor estático simple (sin push) |
| `npm run server:dev` | Express local con recarga |
| `npm run icons` | Regenerar íconos PWA |

## Privacidad

- Personas, interacciones y notas: **solo en tu dispositivo**
- Servidor / Redis: `deviceId`, suscripción Web Push, nombres en riesgo y días sin contacto
