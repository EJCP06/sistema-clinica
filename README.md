# Sistema Clínica

Sistema de gestión clínica con turnero electrónico, panel médico, admisión (APS), administración y pantalla pública. Desarrollado con Angular 21 standalone + Node.js/Express + PostgreSQL + Socket.io.

## Arquitectura

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│  Angular 21 │────▶│  Express API │────▶│ PostgreSQL │
│  (Standalone│     │  (REST+WS)   │     │            │
│   + Nginx)  │◀────│  Socket.io   │◀────│            │
└─────────────┘     └──────────────┘     └────────────┘
```

## Módulos

| Ruta | Módulo | Rol |
|------|--------|-----|
| `/login` | Login | Público |
| `/admin` | Administración | admin |
| `/recepcion` | Recepción | recepcionista, admin |
| `/aps` | APS (Admisión) | aps, admin |
| `/atencion` | Atención médica | medico |
| `/turnero` | Turnero público | Público |

## Stack

- **Frontend:** Angular 21 standalone, Tailwind CSS, Lucide icons, Chart.js
- **Backend:** Node.js, Express 5, Socket.io, bcryptjs, jsonwebtoken
- **Base de datos:** PostgreSQL 15, pg (node-postgres)
- **Tiempo real:** Socket.io (eventos: `estado-actualizado`, `nuevo-llamado`)
- **Contenedores:** Docker Compose (PostgreSQL + API + Nginx)

## Requisitos

- Node.js 20+
- PostgreSQL 15+
- npm

## Configuración inicial

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd sistema-clinica

# 2. Copiar y configurar variables de entorno
cp .env.example .env
cp backend/.env.example backend/.env
# Editar .env con tus credenciales reales

# 3. Instalar dependencias
npm install

# 4. Crear la base de datos
createdb clinica_colas

# 5. Iniciar en desarrollo
npm start        # Inicia Angular (4200) + API (3001) concurrentemente
```

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm start` | Inicia frontend + backend en desarrollo |
| `npm run start:backend` | Solo backend con nodemon |
| `npm run build` | Build de producción (Angular) |
| `npm test` | Tests unitarios Angular |
| `npm run test:backend` | Tests unitarios backend (Jest) |
| `npm run test:e2e` | Tests e2e (Cypress) |

## Despliegue con Docker

```bash
# Asegúrate de tener las variables de entorno configuradas
export DB_PASSWORD=tu_password_seguro
export JWT_SECRET=tu_secreto_jwt

# Iniciar todos los servicios
docker compose up -d

# Servicios:
# - PostgreSQL: puerto 5432
# - API: puerto 3000
# - Frontend (Nginx): puerto 80
```

### Producción (HTTPS)

1. Configurar SSL en `nginx.conf` descomentando el bloque `server` de HTTPS
2. Colocar los certificados en `/etc/ssl/certs/` y `/etc/ssl/private/`
3. Descomentar `return 301 https://$host$request_uri` en el bloque HTTP
4. Configurar `CORS_ORIGIN` con el dominio real

```bash
CORS_ORIGIN=https://midominio.com,https://admin.midominio.com docker compose up -d
```

## Variables de Entorno

Ver `.env.example` para la lista completa:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del backend | `3001` |
| `DB_HOST` | Host PostgreSQL | `localhost` |
| `DB_PORT` | Puerto PostgreSQL | `5432` |
| `DB_USER` | Usuario de PostgreSQL | `postgres` |
| `DB_PASSWORD` | Contraseña DB | *(secreto)* |
| `DB_NAME` | Nombre de la base de datos | `clinica_colas` |
| `JWT_SECRET` | Secreto para tokens JWT | *(secreto)* |
| `CORS_ORIGIN` | Orígenes CORS permitidos | `http://localhost:4200,http://localhost:4201` |
| `NODE_ENV` | Entorno | `development` |
| `EMAIL_HOST` | Servidor SMTP para emails (ej: smtp.gmail.com) | `smtp.gmail.com` |
| `EMAIL_PORT` | Puerto SMTP (ej: 587 para TLS) | `587` |
| `EMAIL_USER` | Usuario para autenticación SMTP | `tuemail@gmail.com` |
| `EMAIL_PASS` | Contraseña o App Password para SMTP | *(secreto)* |
| `EMAIL_FROM` | Email remitente que aparece en los correos | `clinica@tuemail.com` |

## Pruebas

```bash
# Backend (14 tests)
npm run test:backend

# Frontend
npm test

# E2E
npm run test:e2e
```

## Estructura del proyecto

```
├── backend/
│   ├── db/                  # SQL init + test flow
│   ├── src/
│   │   ├── config/          # DB pool, logger
│   │   ├── controllers/     # Controladores Express
│   │   ├── middleware/      # Auth JWT + roles
│   │   └── routes/          # Definición de rutas
│   └── tests/               # Tests Jest
├── src/
│   └── app/
│       ├── core/            # Servicios, guards, interceptors, modelos
│       ├── features/        # Módulos (admin, aps, atencion, etc.)
│       └── shared/          # Componentes compartidos (sidebar, header)
├── nginx.conf               # Configuración Nginx
├── docker-compose.yml       # Orquestación Docker
└── .env.example             # Template de variables de entorno
```

## Seguridad

- Autenticación JWT con expiración de 24h
- Rate limiting en login (10 intentos/15 min por IP)
- Headers de seguridad (Helmet + Nginx)
- Input sanitization vía parameterized queries
- CORS dinámico por variable de entorno
- Logs estructurados con Winston
- Interceptor global de errores HTTP

## Licencia

Uso interno.
