# 🏥 Sistema Clínica — Gestión de Turnos y Atención

Sistema integral de gestión clínica para centros de salud con **turnero electrónico en tiempo real**, admisión (APS), atención médica, laboratorio, imágenes, administración de personal/roles/permisos y pantalla pública de sala de espera.

> **Stack:** Angular 21 (standalone) · Node.js/Express 5 · PostgreSQL 15 · Socket.io · Nginx · Docker

---

## ✨ Características principales

- **Turnero electrónico público**: pantalla de sala de espera con llamadas por voz, dividida por sedes (Plaza Sucre, Santa Mónica), actualizada en tiempo real vía WebSocket.
- **Admisión / APS**: registro de pacientes, asignación de turnos, pase a caja y sala de espera, gestión de ausencias y reincorporación.
- **Atención médica**: cola de pacientes por consultorio, llamar siguiente, inicio y finalización de atención.
- **Laboratorio e Imágenes**: flujo de caja → sala de espera → atención, reutilizando el componente de atención con `tipo` (`laboratorio` / `imagenes`).
- **Administración**: gestión de personal, roles por sede, permisología granular, especialidades, consultorios, aseguradoras y reportes (exportación PDF/Excel).
- **Multi-sede**: roles, consultorios y turnos aislados por sede (`id_sede`).
- **Seguridad**: JWT con refresh token, rate limiting, Helmet, auditoría, sanitización de entradas y logs estructurados.

---

## 🏗️ Arquitectura

```
┌──────────────┐     REST (JWT)      ┌───────────────┐      ┌────────────┐
│   Angular 21 │ ──────────────────▶ │  Express API  │ ───▶ │ PostgreSQL │
│  (Standalone │ ◀────────────────── │   (REST+WS)   │      │     15     │
│  + Tailwind) │  WebSocket (SIO)    │  Socket.io    │ ◀─── │            │
└──────┬───────┘                     └──────┬────────┘      └────────────┘
       │                                    │
       │ Nginx (proxy inverso, HTTPS)       │ Redis (cache opcional, ioredis)
       │                                    │
  Pantalla pública del turnero (sin auth)   Prometheus /api/metrics
```

### Flujo de datos en tiempo real

1. El **backend** publica eventos por **Socket.io** (lista de espera, llamados, cambios de estado).
2. El **frontend** (turnero y módulos de atención) se suscribe y actualiza la interfaz sin recargar.
3. La pantalla pública del turnero es una ruta **sin autenticación** (`/turnero/:sede`) que solo recibe eventos.

### Eventos Socket.io

| Evento | Significado |
|--------|-------------|
| `nuevo-turno` | Se registró un paciente y se asignó un turno |
| `nuevo-llamado` | Se llamó a un paciente a un consultorio |
| `estado-actualizado` | Cambio de estado general (`retirado`, `estado-cambiado`, …) |
| `liberacion` | Se liberó un consultorio |
| `permisos-actualizados`, `rol-cambiado`, `rol-desactivado`, `sede-cambiada`, `usuario-desactivado`, `sesion-cerrada`, `especialidad-desactivada` | Cambios administrativos que fuerzan recarga/cierre de sesión en los clientes conectados |

---

## 🧩 Módulos y rutas

| Ruta | Módulo | Descripción | Acceso |
|------|--------|-------------|--------|
| `/` | Inicio | Redirección según rol | Autenticado |
| `/login` | Login | Autenticación con JWT | Público |
| `/turnero` · `/turnero/:sede` | Turnero | Pantalla pública de sala de espera (voz) | Público |
| `/recepcion` | Recepción | Registro y turnos de admisión | admision |
| `/aseguradoras` | Aseguradoras | Gestión de aseguradoras (reutiliza recepción en modo `aseguradorasMode`) | aseguradoras |
| `/aps` | APS (Admisión) | Alta de pacientes, edición, ausencias | aps |
| `/atencion` | Atención médica | Cola y consulta por consultorio (`tipo: medico`) | atencion_medica |
| `/atencion-laboratorio` | Atención laboratorio | Flujo de atención de laboratorio | laboratorio |
| `/atencion-imagenes` | Atención imágenes | Flujo de atención de imágenes | imagenes |
| `/laboratorio` | Laboratorio | Caja y sala de espera de laboratorio | laboratorio |
| `/imagenes` | Imágenes | Caja y sala de espera de imágenes | imagenes |
| `/administrador` | Administración | Personal, roles, permisología, especialidades, reportes | personal / roles / permisologia / especialidades / reportes |

> **Nota:** `/atencion-laboratorio` y `/atencion-imagenes` reutilizan el mismo componente de atención con un parámetro `tipo`, igual que `/aseguradoras` reutiliza recepción.

---

## 👥 Roles y permisos

Los roles son **por sede** (`Roles.nombre + key + id_sede` únicos). Roles precargados por sede:

| Rol | Key | Módulos típicos |
|-----|-----|-----------------|
| Administrador | `administrador` | Todos (personal, roles, permisología, especialidades, reportes, llamado) |
| Recepcionista | `recepcionista` | admision |
| Médico | `medico` | atencion_medica |
| Coordinador | `coordinador` | admision (marcar ausente) |
| Analista | `analista` | aps |
| Laboratorio | `laboratorio` | laboratorio |
| Imágenes | `imagenes` | imagenes |
| Enfermero | `enfermero` | admision / aps |

Los permisos siguen el patrón `<recurso>:<accion>` (ej. `admision:crear`, `atencion_medica:llamar_siguiente`, `laboratorio:*`) y se agrupan en *sets* predefinidos (`backend/src/config/permission-sets.js`) que el administrador asigna a cada rol. La validación en tiempo real ocurre en `backend/src/middleware/permission.js` y en el guard Angular `modulePermissionGuard`.

---

## 🔄 Máquina de estados de la atención

El flujo de un paciente se modela con la tabla `Estado` (9 estados):

```
Registrado (1) → En Caja (2) → Sala de Espera (3) → Llamado (4) → En Atencion (5) → Atendido (6)
      │               │               │                  │              │
      │               │               │                  └── Ausente (7) ──→ Reincorporar → Sala de Espera
      │               │               └── Ausente (7) ──→ Reincorporar ──┘
      │               │
      └── Retirado (9) ┘              Espera de clave (8) → En Atencion (5)
```

| # | Estado | Uso |
|---|--------|-----|
| 1 | Registrado | Paciente recién registrado en admisión |
| 2 | En Caja | En cola para caja |
| 3 | Sala de Espera | Esperando el llamado |
| 4 | Llamado | Fue llamado al consultorio/servicio |
| 5 | En Atencion | Siendo atendido |
| 6 | Atendido | Atención finalizada |
| 7 | Ausente | No respondió al llamado (marcar ausente) |
| 8 | Espera de clave | Esperando clave/resultado intermedio |
| 9 | Retirado | Se retiró del establecimiento |

> Las transiciones se ejecutan con **transacciones SQL** (`FOR UPDATE` / `SKIP LOCKED`) para evitar carreras entre usuarios; la numeración de turnos es **atómica** por servicio y sede. Ver `backend/src/repositories/atencion.repository.js`.

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | Angular 21 (standalone), Tailwind CSS, Lucide icons, Chart.js, jsPDF, SheetJS (xlsx), SweetAlert2, Tesseract.js (OCR) |
| Backend | Node.js, Express 5, Socket.io, bcryptjs, jsonwebtoken, express-validator, express-rate-limit, helmet, winston, prom-client, nodemailer, swagger-jsdoc |
| Base de datos | PostgreSQL 15, `pg` (node-postgres), migraciones SQL versionadas (`backend/migrate.js`) |
| Cache (opcional) | Redis / ioredis |
| Infraestructura | Nginx (proxy inverso + HTTPS), Docker Compose, GitHub Actions (CI) |

---

## 📋 Requisitos

- Node.js **20+** y npm
- PostgreSQL **15+**
- Docker + Docker Compose (para despliegue contenedorizado)
- Navegador moderno (Chrome, Edge, Firefox)

---

## 🚀 Configuración inicial (desarrollo)

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd sistema-clinica

# 2. Configurar variables de entorno
cp .env.example .env
cp backend/.env.example backend/.env
# Editar backend/.env con credenciales reales (DB, JWT_SECRET, SMTP…)

# 3. Instalar dependencias
npm install

# 4. Crear la base de datos e inicializar el esquema
createdb clinica_colas
psql -d clinica_colas -f backend/db/init.sql     # esquema + datos base
npm run migrate                                   # aplica migraciones versionadas

# 5. Iniciar en desarrollo (Angular :4200 + API :3001)
npm start
```

> **Endpoint de desarrollo:** `POST /api/dev/token/:id` genera un JWT para un usuario por ID (solo fuera de producción). Útil para probar la pantalla pública.

---

## 🗃️ Migraciones de base de datos

Las migraciones viven en `backend/src/migrations/*.sql` y se aplican en orden con:

```bash
npm run migrate
```

Cada archivo sigue el patrón `NNN_descripcion.sql` y es **idempotente** en la medida de lo posible. El esquema base (tablas, estados, servicios, roles, usuarios iniciales) está en `backend/db/init.sql`.

---

## 🔑 Variables de entorno

Plantillas completas y comentadas en `.env.example` (frontend) y `backend/.env.example` (API).

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del backend | `3001` |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `DB_HOST` / `DB_PORT` | Host y puerto de PostgreSQL | `localhost` / `5432` |
| `DB_USER` / `DB_PASSWORD` | Credenciales de la BD | `postgres` / *(secreto)* |
| `DB_NAME` | Nombre de la base de datos | `clinica_colas` |
| `JWT_SECRET` | Secreto para firmar tokens JWT | *(secreto)* |
| `CORS_ORIGIN` | Orígenes permitidos (separados por coma) | `http://localhost:4200,http://localhost` |
| `EMAIL_HOST` / `EMAIL_PORT` | Servidor SMTP para recuperación de contraseña | `smtp.gmail.com` / `587` |
| `EMAIL_USER` / `EMAIL_PASS` | Credenciales SMTP (App Password) | *(secreto)* |
| `EMAIL_FROM` | Remitente de los correos | `"Clínica Nueva Caracas"` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Ventana y máximo de peticiones por IP | `60000` / `60` |

---

## 📜 Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm start` | Frontend (:4200) + API (:3001) en paralelo (concurrently) |
| `npm run start:backend` | Solo API con nodemon (hot reload) |
| `npm run build` | Build de producción del frontend (Angular) |
| `npm run migrate` | Aplica las migraciones SQL pendientes |
| `npm test` | Tests unitarios del frontend |
| `npm run test:backend` | Tests unitarios del backend (Jest) |
| `npm run test:e2e` | Tests e2e (Cypress) |

**Scripts de operación** (`scripts/`):

| Script | Uso |
|--------|-----|
| `backup-db.ps1` | Backup de PostgreSQL a archivo |
| `ssl-init.ps1` | Genera certificados SSL para desarrollo |
| `iniciar-turnero.bat` / `.sh` | Lanza el turnero en modo kiosco |
| `habilitar-autoplay-turnero.reg` | Habilita autoplay de audio en Windows para el turnero |

---

## 🐳 Despliegue con Docker

```bash
# Configurar secretos
export DB_PASSWORD=tu_password_seguro
export JWT_SECRET=tu_secreto_jwt

# Levantar todos los servicios
docker compose up -d
```

| Servicio | Puerto |
|----------|--------|
| PostgreSQL | `5432` |
| API (Express) | `3000` |
| Frontend (Nginx) | `80` |

El stack incluye un **servicio de integración** que ejecuta el flujo de pruebas del turnero al iniciar (`backend/db/`).

### Producción con HTTPS

1. Descomentar el bloque `server` HTTPS en `nginx.conf` y colocar los certificados en `/etc/ssl/certs/` y `/etc/ssl/private/`.
2. Descomentar `return 301 https://$host$request_uri` en el bloque HTTP para redirigir.
3. Configurar `CORS_ORIGIN` con el dominio real:

```bash
CORS_ORIGIN=https://midominio.com,https://admin.midominio.com docker compose up -d
```

---

## 📁 Estructura del proyecto

```
├── backend/                        # API REST + WebSocket
│   ├── db/
│   │   ├── init.sql                # Esquema base + datos semilla
│   │   └── ...                     # Flujo de pruebas de integración
│   ├── src/
│   │   ├── config/                 # DB pool, logger, swagger, rate limit, permisos
│   │   ├── controllers/            # Lógica de endpoints (auth, admin, turnos, …)
│   │   ├── middleware/             # Auth JWT, permisos, auditoría, métricas, sanitización
│   │   ├── repositories/           # Capa de acceso a datos (SQL con parámetros)
│   │   ├── migrations/             # Migraciones SQL versionadas
│   │   ├── routes/                 # Definición de rutas Express
│   │   └── utils/                  # Helpers (sanitize, …)
│   ├── migrate.js                  # Aplicador de migraciones
│   └── index.js                    # Punto de entrada de la API
├── src/                            # Frontend Angular
│   └── app/
│       ├── core/                   # Servicios, guards, interceptors, modelos, config
│       ├── features/               # Módulos: login, admin, recepcion, aps,
│       │                           #   atencion, laboratorio, imagenes, turnero, inicio
│       └── shared/                 # Componentes/pipes compartidos (header, sidebar, pagination)
├── scripts/                        # Operación: backup, SSL, kiosco del turnero
├── nginx.conf                      # Proxy inverso, HTTPS, rate limiting
├── docker-compose.yml              # PostgreSQL + API + Nginx + test de integración
├── Dockerfile.backend / .frontend  # Builds multi-stage
├── proxy.conf.js                   # Proxy de desarrollo (Angular → API)
└── .env.example                    # Plantillas de variables de entorno
```

---

## 📚 Documentación de la API

- **Swagger UI** (solo desarrollo): `http://localhost:3001/api/docs`
- **Métricas Prometheus**: `GET http://localhost:3001/api/metrics`

### Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Autenticación (JWT + refresh token) |
| `POST` | `/api/auth/refresh` | Renovar access token |
| `POST` | `/api/auth/recuperacion/solicitar` | Solicitar OTP de recuperación (email) |
| `POST` | `/api/auth/recuperacion/verificar` | Validar el OTP recibido |
| `POST` | `/api/auth/recuperacion/restablecer` | Restablecer la contraseña |
| `GET` | `/api/turnero/pacientes` · `/sala-espera` · `/ultimo-llamado` | Pantalla pública del turnero (**sin auth**) |
| `GET/POST/PUT/DELETE` | `/api/admin/*` | Personal, roles, permisología, especialidades |
| `GET/POST/PUT` | `/api/turnos/*` | Registro de pacientes y cambios de estado |
| `GET/POST/PUT` | `/api/recepcion/*`, `/api/medico/*`, `/api/consultorios/*`, `/api/especialidades/*`, `/api/shared/*` | Flujos por módulo y recursos compartidos |

> Todos los endpoints (excepto los públicos del turnero y las rutas de auth/recuperación) requieren el header `Authorization: Bearer <token>`.

---

## 🔒 Seguridad

- **JWT** con expiración de 24h + **refresh token** persistido en BD.
- **Rate limiting** por IP en login y en la API general (`express-rate-limit`).
- **Helmet** (headers HTTP seguros) + headers de seguridad en Nginx.
- **Inyección SQL** mitigada con consultas parametrizadas (`pg` con `$1, $2…`).
- **CORS** dinámico desde `CORS_ORIGIN`.
- **Sanitización** de entradas en logs (`backend/src/utils/sanitize.js`).
- **Auditoría** de acciones sensibles (`middleware/audit.js`).
- **Logs estructurados** con Winston y rotación.

---

## 🧪 Pruebas

```bash
# Backend (tests unitarios con Jest)
npm run test:backend

# Frontend (Karma/Jasmine)
npm test

# End-to-end (Cypress)
npm run test:e2e

# Verificación rápida de sintaxis/compilación
node --check backend/index.js
npx tsc --noEmit -p tsconfig.app.json
```

La **CI** (GitHub Actions, `.github/workflows/ci.yml`) ejecuta lint + build + tests en cada push.

---

## 📄 Licencia

Uso interno.
