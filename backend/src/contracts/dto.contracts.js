/**
 * CONTRATOS DE LA API - ARCHIVO GENERADO, NO EDITAR A MANO.
 *
 * Se genera desde src/app/core/models/dto.models.ts (frontend Angular),
 * que es la fuente unica de verdad, ejecutando:
 *
 *   npm run contratos
 *
 * CI ejecuta "npm run contratos:check" y falla si este archivo quedo
 * desincronizado respecto a los DTO del frontend, de modo que un cambio de
 * contrato no pase inadvertido entre el backend y la interfaz.
 *
 * Los @typedef permiten que el editor de autocompletado y avisos de tipo en
 * el backend JavaScript: basta anotar una variable con
 *   @type {import("./dto.contracts").AdmisionDTO}
 */

module.exports = {};

/**
 * LoginRequest
 *
 * @property {string} username
 * @property {string} password
 */

/**
 * LoginResponse
 *
 * @property {string} mensaje
 * @property {string} token
 * @property {*} usuario
 */

/**
 * UsuarioDTO
 *
 * @property {number} id
 * @property {string|undefined} username
 * @property {string|undefined} cedula
 * @property {string} nombre
 * @property {string|undefined} apellido
 * @property {string} rol
 * @property {number|undefined} consultorio_id
 * @property {number|undefined} servicio_id
 * @property {number|undefined} id_especialidad
 * @property {string|undefined} especialidad_nombre
 * @property {number|undefined} id_sede
 */

/**
 * ResponsablePagoDTO
 *
 * @property {number} id_responsable
 * @property {string} nombre
 * @property {boolean} status
 */

/**
 * AdmisionDTO
 *
 * @property {number} id_atencion
 * @property {string} numero
 * @property {number} id_estado_actual
 * @property {number} id_servicio
 * @property {number} id_paciente
 * @property {number|undefined} id_especialidad
 * @property {number|undefined} id_responsable
 * @property {string} nombre
 * @property {string|undefined} segundo_nombre
 * @property {string} apellido
 * @property {string|undefined} segundo_apellido
 * @property {string} cedula
 * @property {string|undefined} telefono
 * @property {string} nombre_estado
 * @property {string} nombre_servicio
 * @property {string|undefined} prefijo
 * @property {string|undefined} modalidad_pago
 * @property {string} fecha_creacion
 * @property {string|undefined} hora_llegada
 * @property {string|undefined} hora_salida
 * @property {string|undefined} hora_llamado
 */

/**
 * PacienteDTO
 *
 * @property {number} id_paciente
 * @property {string} cedula
 * @property {string} nombre
 * @property {string} apellido
 * @property {string} primer_nombre
 * @property {string|undefined} segundo_nombre
 * @property {string} primer_apellido
 * @property {string|undefined} segundo_apellido
 * @property {string|undefined} fecha_nacimiento
 * @property {string|undefined} telefono
 * @property {boolean|undefined} status
 * @property {number|undefined} id_sede
 */

/**
 * CrearPacienteRequest
 *
 * @property {number|null|undefined} id_paciente
 * @property {string} cedula
 * @property {string} primer_nombre
 * @property {string|undefined} segundo_nombre
 * @property {string} primer_apellido
 * @property {string|undefined} segundo_apellido
 * @property {string|undefined} fecha_nacimiento
 * @property {string|undefined} telefono
 * @property {boolean|undefined} status
 */

/**
 * GenerarTurnoRequest
 *
 * @property {number} id_paciente
 * @property {number} id_servicio
 * @property {number|undefined} id_responsable
 * @property {number|undefined} id_cliente
 * @property {number|undefined} id_especialidad
 */

/**
 * GenerarTurnoResponse
 *
 * @property {number} id_atencion
 * @property {string} numero
 * @property {string} hora_llegada
 */

/**
 * TurnoDTO
 *
 * @property {number} id
 * @property {number|undefined} id_atencion
 * @property {string} numero
 * @property {string} estado
 * @property {string} hora_llegada
 * @property {string|undefined} hora_salida
 * @property {Object} paciente
 * @property {number|undefined} id_consultorio
 * @property {number|undefined} id_especialidad
 * @property {number|undefined} id_servicio
 * @property {number|undefined} id_medico
 * @property {number|undefined} id_sede
 * @property {number|undefined} id_estado_actual
 * @property {string|undefined} nombre_servicio
 * @property {string|undefined} especialidad_nombre
 * @property {string|undefined} consultorio_nombre
 * @property {string|null|undefined} consultorio_piso
 * @property {string|null|undefined} especialidad_piso
 * @property {string|undefined} updated_at
 */

/**
 * LlamarSiguienteResponseDTO
 *
 * @property {string} mensaje
 * @property {*|null} turno
 */

/**
 * MiEstadoDTO
 *
 * @property {string} estado
 * @property {number} servicio_id
 * @property {string} nombre
 * @property {string|undefined} servicio_nombre
 * @property {number|undefined} turno_id
 * @property {string|undefined} turno_numero
 * @property {string|undefined} turno_estado
 * @property {string|undefined} nombre_paciente
 * @property {string|undefined} apellido_paciente
 * @property {string|undefined} documento_paciente
 * @property {string|undefined} turno_hora_llegada
 * @property {string|undefined} hora_llamado
 */

/**
 * ConsultorioDTO
 *
 * @property {number|undefined} id_consultorio
 * @property {number} id
 * @property {string} nombre
 * @property {string} estado_fisico
 * @property {number|undefined} id_servicio
 * @property {number|undefined} id_sede
 * @property {string|undefined} servicio_nombre
 * @property {string|undefined} piso
 */

/**
 * AdminConsultorioDTO
 *
 * @property {number} id
 * @property {string} nombre
 * @property {string} estado
 * @property {number|undefined} servicio_id
 */

/**
 * ConsultorioEstadoDTO
 *
 * @property {number} id_consultorio
 * @property {string} nombre
 * @property {string} estado
 * @property {*|null|undefined} turno_actual
 * @property {string|undefined} especialidad_nombre
 * @property {string|undefined} medico_nombre
 */

/**
 * PersonalDTO
 *
 * @property {number} id_usuario
 * @property {number|undefined} id
 * @property {string|undefined} cedula
 * @property {string|undefined} username
 * @property {string} nombre
 * @property {string|undefined} apellido
 * @property {string|undefined} primer_nombre
 * @property {string|undefined} segundo_nombre
 * @property {string|undefined} primer_apellido
 * @property {string|undefined} segundo_apellido
 * @property {string|undefined} telefono
 * @property {string|undefined} email
 * @property {string} rol
 * @property {string|undefined} piso
 * @property {number|undefined} id_consultorio
 * @property {number|undefined} consultorio_id
 * @property {number|undefined} id_servicio
 * @property {number|undefined} servicio_id
 * @property {number|undefined} id_especialidad
 * @property {number|undefined} especialidad_id
 * @property {Array|undefined} especialidades
 * @property {Array|undefined} especialidades_inactivas
 * @property {*|undefined} especialidades_consultorios
 * @property {number|undefined} id_sede
 * @property {boolean|undefined} status
 * @property {boolean|undefined} activo
 * @property {string|undefined} fecha_creacion
 * @property {string|undefined} consultorio_nombre
 * @property {string|undefined} servicio_nombre
 */

/**
 * CrearPersonalRequest
 *
 * @property {string} cedula
 * @property {string} primer_nombre
 * @property {string|undefined} segundo_nombre
 * @property {string} primer_apellido
 * @property {string|undefined} segundo_apellido
 * @property {string|undefined} telefono
 * @property {string|undefined} password
 * @property {string} rol
 * @property {string|undefined} piso
 * @property {number|undefined} id_consultorio
 * @property {number|undefined} id_servicio
 * @property {number|undefined} id_especialidad
 * @property {Array|undefined} especialidades
 * @property {string|undefined} username
 * @property {boolean|undefined} status
 * @property {number|undefined} id_sede
 */

/**
 * ServicioDTO
 *
 * @property {number} id
 * @property {string} nombre
 * @property {string|undefined} prefijo
 * @property {boolean} activo
 */

/**
 * CrearServicioRequest
 *
 * @property {string} nombre
 * @property {string|undefined} prefijo
 * @property {string|undefined} piso
 * @property {boolean|undefined} activo
 */

/**
 * EspecialidadDTO
 *
 * @property {number} id_especialidad
 * @property {number|undefined} id
 * @property {string} nombre
 * @property {string|undefined} codigo
 * @property {string|undefined} prefijo
 * @property {string|undefined} piso
 * @property {boolean|undefined} activo
 * @property {number|undefined} id_servicio
 * @property {number|undefined} servicio_id
 * @property {number|undefined} id_sede
 * @property {string|undefined} nombre_servicio
 * @property {Array|undefined} consultorios_ids
 */

/**
 * CrearEspecialidadRequest
 *
 * @property {string} nombre
 * @property {string|undefined} prefijo
 * @property {number|undefined} id_servicio
 * @property {number|undefined} id_sede
 * @property {string|undefined} piso
 * @property {Array|undefined} consultorios_ids
 * @property {boolean|undefined} activo
 */

/**
 * SedeDTO
 *
 * @property {number} id_sede
 * @property {number|undefined} id
 * @property {string} nombre
 * @property {string|undefined} direccion
 * @property {boolean|undefined} activo
 */

/**
 * AseguradoraDTO
 *
 * @property {number} id_cliente
 * @property {string|undefined} aseguradora
 * @property {string|undefined} nombre
 * @property {string|undefined} tipo
 * @property {number|undefined} id_sede
 */

/**
 * ReporteDiarioDTO
 *
 * @property {number} total
 * @property {Array} turnos
 * @property {Object} estadisticas
 * @property {Object} kpis
 * @property {Array} por_servicio
 * @property {Array} ausentes
 */

/**
 * TurnoReporteDTO
 *
 * @property {number} id
 * @property {string} numero
 * @property {string} estado
 * @property {number} id_estado_actual
 * @property {string} hora_llegada
 * @property {string|undefined} hora_fin
 * @property {string} servicio_nombre
 * @property {string|undefined} especialidad
 * @property {string|undefined} consultorio
 * @property {string|undefined} medico_nombre
 * @property {string|undefined} medico_apellido
 * @property {string|undefined} hora_inicio_atencion
 * @property {string|undefined} hora_fin_atencion
 * @property {string|undefined} hora_marcado_ausente
 * @property {string|undefined} hora_retirado
 * @property {number} id_sede
 * @property {Object} paciente
 */

/**
 * ServicioReporteDTO
 *
 * @property {string} servicio
 * @property {number} total
 * @property {number} atendidos
 * @property {number} ausentes
 * @property {number} en_espera
 * @property {number} en_atencion
 * @property {number} registrados
 */

/**
 * AusenteReporteDTO
 *
 * @property {string} numero
 * @property {string} paciente_nombre
 * @property {string} paciente_apellido
 * @property {string} paciente_documento
 * @property {string} servicio
 * @property {string|undefined} especialidad
 * @property {string} hora_llegada
 */

/**
 * PacienteEnEsperaDTO
 *
 * @property {number} id_atencion
 * @property {string} hora_llegada
 * @property {string|undefined} hora_salida
 * @property {string} nombre
 * @property {string} apellido
 * @property {string} cedula
 * @property {string} nombre_estado
 * @property {string} nombre_servicio
 * @property {number} id_estado_actual
 * @property {number|undefined} id_especialidad
 * @property {string|undefined} nombre_especialidad
 */

/**
 * ApiResponse
 *
 * @property {string} mensaje
 * @property {*|undefined} data
 */

/**
 * ErrorResponse
 *
 * @property {string} mensaje
 * @property {string|undefined} error
 */

/**
 * RolDTO
 *
 * @property {number} id
 * @property {string} nombre
 * @property {string} key
 * @property {number|null} id_sede
 * @property {boolean} activo
 * @property {string|undefined} sede_nombre
 */

/**
 * CrearRolRequest
 *
 * @property {string} nombre
 * @property {string|undefined} key
 * @property {number|null|undefined} id_sede
 * @property {boolean|undefined} activo
 */

/**
 * PermisoDTO
 *
 * @property {number} id_permiso
 * @property {string} key
 * @property {string} nombre
 * @property {string|undefined} descripcion
 */

/**
 * RecursoMatrizDTO
 *
 * @property {string} key
 * @property {string} nombre
 * @property {string|undefined} descripcion
 * @property {Array} acciones
 */

/**
 * MatrizPermisosDTO
 *
 * @property {Array} recursos
 * @property {Array} accionesBasicas
 */

/**
 * HealthResponse
 *
 * @property {string} status
 * @property {string} message
 */

/**
 * EstadoActualizadoResponse
 *
 * @property {number} id_estado_actual
 */
