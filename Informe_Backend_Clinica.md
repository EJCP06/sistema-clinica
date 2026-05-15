# INFORME TÉCNICO: BACKEND DEL SISTEMA DE GESTIÓN DE COLAS PARA CLÍNICA

## 1. VISIÓN GENERAL DE LA ARQUITECTURA

El backend es una **API REST** construida con **Node.js** y el framework **Express**. Se comunica con una base de datos relacional **PostgreSQL** y proporciona servicios tanto al frontend Angular como a la pantalla pública mediante **WebSockets**. La autenticación y autorización se manejan con **JSON Web Tokens (JWT)**.

**Componentes principales:**

| Componente    | Tecnología         | Función                                                                |
| :------------ | :----------------- | :--------------------------------------------------------------------- |
| Servidor HTTP | Node.js + Express  | Recibir peticiones, ejecutar lógica, devolver respuestas JSON.         |
| Base de Datos | PostgreSQL         | Almacenar usuarios, servicios, consultorios, turnos y sus estados.     |
| Autenticación | JWT (jsonwebtoken) | Proteger endpoints y diferenciar roles (recepcionista, médico, admin). |
| Tiempo Real   | Socket.IO          | Notificar a la pantalla pública cuando un turno es llamado.            |
| Pruebas       | Postman            | Verificar cada endpoint antes de conectarlo al frontend.               |

## 2. BASE DE DATOS POSTGRESQL

### 2.1. Esquema Relacional

La base de datos se llama `clinica_colas` y contiene cuatro tablas principales. Su diseño refleja exactamente las entidades del diagrama de flujo.

**Tabla `servicios`**
Representa cada especialidad o área de la clínica. Es la "cola" a la que se asignan los pacientes.

| Columna     | Tipo                  | Descripción                                          |
| :---------- | :-------------------- | :--------------------------------------------------- |
| `id`        | SERIAL PRIMARY KEY    | Identificador único.                                 |
| `nombre`    | VARCHAR(100) NOT NULL | Ej: 'Pediatría', 'Ginecología'.                      |
| `ubicacion` | VARCHAR(50)           | Ej: 'Piso 1', 'Piso 2'.                              |
| `prefijo`   | VARCHAR(5) UNIQUE     | Prefijo para generar números de turno: 'PED', 'GIN'. |

**Tabla `consultorios`**
Cada consultorio físico donde un médico atiende. Está vinculado a un servicio (cola) y tiene un estado dinámico.

| Columna       | Tipo                                  | Descripción                                              |
| :------------ | :------------------------------------ | :------------------------------------------------------- |
| `id`          | SERIAL PRIMARY KEY                    | Identificador único.                                     |
| `nombre`      | VARCHAR(50) NOT NULL                  | Ej: 'Consultorio 101'.                                   |
| `estado`      | ENUM('LIBRE','OCUPADO','EN_DESCANSO') | Controla si puede llamar pacientes. Por defecto 'LIBRE'. |
| `servicio_id` | INT REFERENCES servicios(id)          | La cola de pacientes que atiende este consultorio.       |

**Tabla `usuarios`**
Almacena las credenciales y el rol de cada persona que usa el sistema. La contraseña se guarda encriptada con bcrypt.

| Columna          | Tipo                                   | Descripción                                      |
| :--------------- | :------------------------------------- | :----------------------------------------------- |
| `id`             | SERIAL PRIMARY KEY                     | Identificador único.                             |
| `username`       | VARCHAR(50) UNIQUE NOT NULL            | Nombre de usuario para login.                    |
| `password_hash`  | VARCHAR(255) NOT NULL                  | Hash de la contraseña (nunca texto plano).       |
| `rol`            | ENUM('recepcionista','medico','admin') | Determina permisos.                              |
| `consultorio_id` | INT REFERENCES consultorios(id)        | Solo para médicos, los vincula a un consultorio. |

**Tabla `turnos`**
Es la tabla de trabajo principal. Cada fila es un ticket generado en recepción que atraviesa todos los estados del flujo.

| Columna              | Tipo                                                                                    | Descripción                                                   |
| :------------------- | :-------------------------------------------------------------------------------------- | :------------------------------------------------------------ |
| `id`                 | SERIAL PRIMARY KEY                                                                      | Identificador único.                                          |
| `numero`             | VARCHAR(20) NOT NULL                                                                    | Ej: 'PED-005', generado automáticamente.                      |
| `estado`             | ENUM('EN_ESPERA','LLAMADO','EN_ATENCION','EN_PAUSA','AUSENTE','ATENDIDO','TRANSFERIDO') | Refleja el nodo actual del diagrama. Por defecto 'EN_ESPERA'. |
| `servicio_id`        | INT REFERENCES servicios(id)                                                            | La cola a la que pertenece.                                   |
| `consultorio_id`     | INT REFERENCES consultorios(id)                                                         | Se asigna cuando es llamado.                                  |
| `nombre_paciente`    | VARCHAR(100) NOT NULL                                                                   | Nombre del paciente.                                          |
| `documento_paciente` | VARCHAR(20)                                                                             | Documento de identidad.                                       |
| `telefono_paciente`  | VARCHAR(20)                                                                             | Para notificaciones SMS.                                      |
| `hora_llegada`       | TIMESTAMP DEFAULT NOW()                                                                 | Cuándo se registró en recepción.                              |
| `hora_llamado`       | TIMESTAMP                                                                               | Cuándo el médico presionó "Llamar Siguiente".                 |
| `hora_inicio`        | TIMESTAMP                                                                               | Cuándo el médico presionó "Iniciar Atención".                 |
| `hora_fin`           | TIMESTAMP                                                                               | Cuándo se finalizó o marcó ausente.                           |

**Relaciones clave:**

- Un `servicio` tiene muchos `turnos` y muchos `consultorios`.
- Un `consultorio` pertenece a un `servicio` y puede tener muchos `turnos` a lo largo del día.
- Un `usuario` con rol 'medico' está vinculado a un `consultorio`.

### 2.2. Integridad y Reglas de Negocio en la BD

- **FIFO estricto:** Al llamar al siguiente paciente, la consulta SQL ordena por `hora_llegada ASC` y filtra por `servicio_id` y `estado = 'EN_ESPERA'`. No hay prioridades.
- **Estados válidos:** El ENUM garantiza que solo se usen los estados del diagrama de flujo.
- **Unicidad de turno activo:** Antes de insertar, se verifica que no exista otro turno para el mismo documento y servicio en estado diferente a ATENDIDO o AUSENTE.

## 3. ESTRUCTURA DEL PROYECTO NODE.JS

Aunque no se incluye código, la organización de carpetas recomendada es:

backend/
├── src/
│ ├── config/ # Conexión a PostgreSQL (pool)
│ ├── middleware/ # auth.js (JWT), roles.js
│ ├── routes/ # auth.routes.js, turnos.routes.js, consultorios.routes.js
│ ├── controllers/ # Lógica de cada endpoint
│ ├── models/ # (Opcional) consultas SQL crudas o uso de Knex
│ └── socket/ # Configuración de Socket.IO
├── .env # Variables de entorno (DB_HOST, JWT_SECRET, etc.)
├── package.json
└── server.js # Punto de entrada

## 4. ENDPOINTS DE LA API REST

Cada endpoint se agrupa por módulo funcional. Todos requieren el token JWT en el header `Authorization: Bearer <token>`, excepto el login.

### 4.1. Autenticación

| Método | Ruta              | Descripción                                                                                                                                                |
| :----- | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/auth/login` | Recibe `username` y `password`. Verifica credenciales y rol. Devuelve un token JWT que contiene `id`, `username`, `rol` y `consultorio_id` (si es médico). |

**Lógica de negocio:**

- Busca al usuario en la tabla `usuarios`.
- Compara la contraseña con bcrypt.
- Si es exitoso, firma el token con una clave secreta y lo envía.
- El frontend debe almacenar este token en `localStorage` y adjuntarlo en cada petición.

### 4.2. Módulo de Recepción (Registro de Pacientes)

| Método | Ruta          | Permisos                 |
| :----- | :------------ | :----------------------- |
| POST   | `/api/turnos` | `recepcionista`, `admin` |

**Datos recibidos:** `nombre_paciente`, `documento_paciente`, `telefono_paciente`, `servicio_id`, `notificar` (opcional).

**Flujo de backend (refleja nodos del diagrama):**

1. Valida que el `servicio_id` exista.
2. **Validación anti-duplicado:** Ejecuta `SELECT` en `turnos` donde `documento_paciente` = dato, `servicio_id` = dato y `estado` no sea 'ATENDIDO' ni 'AUSENTE'. Si encuentra, responde con error.
3. **Generación de número secuencial:**
   - Obtiene el último turno registrado para ese servicio con `SELECT numero FROM turnos WHERE servicio_id = ? ORDER BY id DESC LIMIT 1`.
   - Extrae el número, lo incrementa y formatea con el prefijo (ej: 'PED-005').
4. Inserta el nuevo turno con estado 'EN_ESPERA' y `hora_llegada` automática.
5. (Pendiente) Si `notificar` es true, aquí se integraría un servicio de envío de SMS.
6. Responde con el `id` y `numero` generado.

### 4.3. Módulo de Atención Médica (Panel del Médico)

**Obtener estado del consultorio:**

| Método | Ruta                          | Permisos |
| :----- | :---------------------------- | :------- |
| GET    | `/api/consultorios/mi-estado` | `medico` |

Devuelve el `estado` actual y `servicio_id` del consultorio asignado al médico autenticado. El panel usa esto para mostrar/ocultar botones.

**Llamar siguiente paciente:**

| Método | Ruta                                 | Permisos |
| :----- | :----------------------------------- | :------- |
| POST   | `/api/consultorios/llamar-siguiente` | `medico` |

**Flujo:**

1. Obtiene el `consultorio_id` del token.
2. Verifica que el consultorio esté 'LIBRE'.
3. Busca el turno más antiguo en estado 'EN_ESPERA' para el `servicio_id` de ese consultorio.
4. Si no hay turnos, responde con un mensaje informativo.
5. Si hay, **inicia una transacción**:
   - Cambia el estado del turno a 'LLAMADO', asigna `consultorio_id` y establece `hora_llamado`.
   - Cambia el estado del consultorio a 'OCUPADO'.
6. Emite un evento de Socket.IO `nuevo-llamado` con el número de turno y el nombre del consultorio para que la pantalla pública se actualice.
7. Responde con el número de turno.

**Iniciar atención (clic clave):**

| Método | Ruta                                 | Permisos |
| :----- | :----------------------------------- | :------- |
| POST   | `/api/consultorios/iniciar-atencion` | `medico` |

**Flujo:**

1. Busca el turno más reciente en estado 'LLAMADO' asociado a su `consultorio_id`.
2. Si no hay, error.
3. Cambia el estado a 'EN_ATENCION' y registra `hora_inicio`.
4. Responde confirmación.

**Finalizar atención:**

| Método | Ruta                                   | Permisos |
| :----- | :------------------------------------- | :------- |
| POST   | `/api/consultorios/finalizar-atencion` | `medico` |

**Flujo:**

1. Busca el turno en estado 'EN_ATENCION' de su consultorio.
2. Cambia estado a 'ATENDIDO', registra `hora_fin`.
3. Cambia estado del consultorio a 'LIBRE'.
4. Responde confirmación.

**Pausar consultorio (descanso):**

| Método | Ruta                            | Permisos |
| :----- | :------------------------------ | :------- |
| PUT    | `/api/consultorios/{id}/pausar` | `medico` |

Simplemente cambia el estado del consultorio a 'EN_DESCANSO'. No se solicitan motivos.

**Reanudar consultorio:**

| Método | Ruta                              | Permisos |
| :----- | :-------------------------------- | :------- |
| PUT    | `/api/consultorios/{id}/reanudar` | `medico` |

Cambia el estado del consultorio a 'LIBRE'.

**Pausar atención (durante consulta):**

| Método | Ruta                      | Permisos |
| :----- | :------------------------ | :------- |
| PUT    | `/api/turnos/{id}/pausar` | `medico` |

Cambia el estado del turno de 'EN_ATENCION' a 'EN_PAUSA'. No afecta al consultorio.

**Reanudar atención:**

| Método | Ruta                        | Permisos |
| :----- | :-------------------------- | :------- |
| PUT    | `/api/turnos/{id}/reanudar` | `medico` |

Vuelve a 'EN_ATENCION'.

**Transferir paciente:**

| Método | Ruta                          | Permisos |
| :----- | :---------------------------- | :------- |
| POST   | `/api/turnos/{id}/transferir` | `medico` |

1. Recibe `nuevo_servicio_id`.
2. Cambia el estado del turno actual a 'TRANSFERIDO'.
3. Crea un nuevo turno en el servicio destino **copiando los datos del paciente y la `hora_llegada` original** (para mantener la antigüedad).
4. Libera el consultorio actual.
5. Responde con el nuevo número de turno.

**Marcar ausente (con confirmación lógica):**

| Método | Ruta                       | Permisos |
| :----- | :------------------------- | :------- |
| PUT    | `/api/turnos/{id}/ausente` | `medico` |

1. Verifica que el turno esté en estado 'LLAMADO'.
2. Cambia estado a 'AUSENTE', registra `hora_fin`.
3. Libera el consultorio.
4. La confirmación se maneja en el frontend (el médico presiona "Ausente", el frontend muestra un diálogo de confirmación, y solo si acepta se llama a este endpoint).

### 4.4. Módulo de Administración

**CRUD de Servicios y Consultorios:** Endpoints para crear, editar y eliminar servicios y consultorios (solo admin).

**Reportes:**

| Método | Ruta                   | Permisos |
| :----- | :--------------------- | :------- |
| GET    | `/api/reportes/diario` | `admin`  |

Devuelve datos agregados del día:

- Total de turnos por estado (atendidos, ausentes, transferidos).
- Tiempo promedio de espera (diferencia entre `hora_inicio` y `hora_llegada` de los atendidos).
- Duración promedio de consulta (diferencia entre `hora_fin` y `hora_inicio`).
- Productividad por consultorio.

**Cierre del día:**

| Método | Ruta                  | Permisos |
| :----- | :-------------------- | :------- |
| POST   | `/api/sistema/cerrar` | `admin`  |

1. Recupera todos los turnos en estado 'EN_ESPERA' o 'LLAMADO'.
2. Los marca como 'AUSENTE' (o se pueden reagendar, pero para simplificar se cierran como no atendidos).
3. Genera el reporte diario automáticamente.
4. Responde con el reporte y un mensaje de cierre exitoso.

## 5. SEGURIDAD Y PERMISOLOGÍA

- **JWT Middleware:** Cada petición a endpoints protegidos pasa por un middleware que verifica el token, extrae la información del usuario y la inyecta en `req.usuario`.
- **Middleware de Roles:** Para endpoints restringidos, un segundo middleware verifica que `req.usuario.rol` esté en la lista permitida. Ejemplo: solo 'medico' puede llamar a `llamar-siguiente`.
- **Trazabilidad:** La tabla `turnos` registra todas las marcas de tiempo, permitiendo auditoría.

## 6. COMUNICACIÓN EN TIEMPO REAL (SOCKET.IO)

- **Servidor Socket.IO:** Se inicializa sobre el mismo servidor HTTP de Express.
- **Evento `nuevo-llamado`:** Emitido por el backend tras ejecutar `llamar-siguiente`. Payload: `{ turno: 'PED-005', consultorio: 'Consultorio 101' }`.
- **Cliente Angular (Pantalla Pública):** Se conecta al namespace raíz y escucha este evento. Al recibirlo, actualiza el texto en pantalla y reproduce el audio.

No se requiere autenticación para la pantalla pública, por lo que el endpoint de Socket.IO no está protegido.

## 7. PRUEBAS CON POSTMAN

### 7.1. Configuración Inicial

1. Crear una colección "Clínica Colas".
2. Definir una variable de entorno `base_url` = `http://localhost:3000/api`.
3. Obtener un token ejecutando `POST /auth/login` con el body `{ "username": "recepcion", "password": "123456" }`. Copiar el token devuelto.
4. En la colección, configurar un **pre-request script** que agregue el header `Authorization: Bearer {{token}}` automáticamente a todas las peticiones.

### 7.2. Flujo de Pruebas Recomendado

| Orden | Método                                                            | Ruta                                        | Body / Parámetros                    | Resultado Esperado                      |
| :---- | :---------------------------------------------------------------- | :------------------------------------------ | :----------------------------------- | :-------------------------------------- |
| 1     | POST                                                              | `/auth/login`                               | `{ "username": "drakjohana1", ... }` | Token de médico                         |
| 2     | GET                                                               | `/consultorios/mi-estado`                   | Token médico                         | Estado 'LIBRE' y servicio_id            |
| 3     | POST                                                              | `/turnos` (con token recepción)             | `{ "nombre_paciente":"Juan",... }`   | `{ "numero": "PED-001" }`               |
| 4     | POST                                                              | `/consultorios/llamar-siguiente` (médico)   | Sin body                             | `{ "turno": "PED-001" }`                |
| 5     | Verificar en DB que turno está 'LLAMADO' y consultorio 'OCUPADO'. |                                             |                                      |                                         |
| 6     | POST                                                              | `/consultorios/iniciar-atencion` (médico)   |                                      | `{ "mensaje": "Atención iniciada" }`    |
| 7     | PUT                                                               | `/turnos/1/pausar` (médico)                 |                                      | Estado 'EN_PAUSA'                       |
| 8     | PUT                                                               | `/turnos/1/reanudar` (médico)               |                                      | Estado 'EN_ATENCION'                    |
| 9     | POST                                                              | `/consultorios/finalizar-atencion` (médico) |                                      | Estado 'ATENDIDO' y consultorio 'LIBRE' |
| 10    | GET                                                               | `/reportes/diario` (admin)                  |                                      | JSON con métricas                       |

## 8. INTEGRACIÓN CON ANGULAR

Las pantallas que ya creaste se comunicarán con el backend mediante peticiones HTTP utilizando el servicio `ApiService` que centralizará las llamadas. La arquitectura es:

- **Pantalla de Login:** Llama a `/api/auth/login` y almacena el token en `localStorage`.
- **Recepción:** El formulario de registro llama a `POST /api/turnos`.
- **Panel de Atención:** Los botones llaman a los endpoints correspondientes. Antes de mostrar "Llamar Siguiente", primero consulta `GET /api/consultorios/mi-estado` para habilitar/deshabilitar según el estado.
- **Pantalla Pública:** Usa `socket.io-client` para escuchar el evento `'nuevo-llamado'` y actualiza la interfaz sin recargar.
- **Administración:** Consume endpoints de reportes y de cierre de día.

## 9. FLUJO COMPLETO DE EJECUCIÓN (EJEMPLO DIARIO)

1. Al iniciar el día, un admin configura los servicios y consultorios (si no están pre-cargados).
2. La recepcionista inicia sesión y ve su pantalla de registro.
3. Llega un paciente; la recepcionista llena el formulario y presiona "Generar Turno". El backend inserta un turno 'EN_ESPERA'.
4. El médico inicia sesión; su panel muestra "Consultorio Libre" y el botón "Llamar Siguiente" activo.
5. El médico presiona "Llamar Siguiente". El backend selecciona el turno más antiguo, lo actualiza, emite evento a la pantalla pública y ocupa el consultorio.
6. La pantalla pública muestra el turno y reproduce el audio.
7. El paciente se presenta. El médico presiona "Iniciar Atención". El backend registra la hora de inicio.
8. Si hay una pausa, el médico presiona "Pausar Atención", y luego "Reanudar".
9. Al finalizar, presiona "Finalizar Atención". El turno se marca 'ATENDIDO' y el consultorio se libera.
10. Al final del día, el admin presiona "Cerrar Sistema". Se genera el reporte y se cierran los turnos pendientes.

## 10. CONSIDERACIONES FINALES

- **Escalabilidad:** El uso de pooling de conexiones (pg.Pool) permite manejar múltiples peticiones concurrentes.
- **Manejo de errores:** Cada endpoint debe tener bloques try-catch y devolver mensajes de error claros (por ejemplo, "Consultorio no disponible", "No hay pacientes en espera").
- **Variables de entorno:** La cadena de conexión a PostgreSQL, el secreto JWT y el puerto deben configurarse fuera del código.
- **Siguientes pasos:** Una vez que los endpoints básicos funcionen, se pueden agregar notificaciones SMS, encuestas de satisfacción o integración con historia clínica.
