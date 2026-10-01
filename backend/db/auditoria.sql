-- ==============================================================
-- AUDITORÍA ESTÁNDAR DE LA BASE DE DATOS
-- --------------------------------------------------------------
-- Todas las tablas de "public" quedan con las siguientes columnas:
--   id_origen           UUID     -> identificador global único de la fila
--                                   (referencias externas / trazabilidad)
--   id / id_xxx         INTEGER  -> clave primaria normal (secuencial)
--   fecha_creacion      TIMESTAMP NOT NULL DEFAULT now()
--   usuario_creacion    VARCHAR(150) NOT NULL DEFAULT 'SISTEMA'
--   fecha_modificacion  TIMESTAMP          (NULL = nunca modificada)
--   usuario_modificacion VARCHAR(150)      (NULL = nunca modificada)
--
-- Las tablas puente (Especialidad_Consultorio, Usuario_Especialidad,
-- Usuario_Rol, Roles_Recursos_Acciones, Secuencia_Turnos) no tenían una
-- columna id: se les agrega "id" como clave primaria y la clave natural
-- anterior pasa a UNIQUE, por lo que los "ON CONFLICT (...)" existentes
-- siguen funcionando igual.
--
-- El usuario que crea/modifica lo coloca un TRIGGER a partir de la
-- variable de sesión 'app.usuario', que el backend fija en cada consulta
-- (ver backend/src/config/contexto-usuario.js). Si nadie la fija (migraciones,
-- trabajos automáticos) se usa 'SISTEMA'.
--
-- ARCHIVO IDEMPOTENTE: puede ejecutarse cuantas veces se necesite.
-- Se ejecuta desde dos lugares:
--   1. Instalación nueva -> backend/db/init.sql lo incluye con "\ir".
--   2. Cada arranque      -> backend/migrate.js lo lee y lo ejecuta.
-- ==============================================================

-- 1) Función única que ejecuta el trigger de TODAS las tablas.
CREATE OR REPLACE FUNCTION fn_auditoria_registro() RETURNS trigger AS $$
DECLARE
  v_usuario text;
BEGIN
  -- Quién hizo el cambio (fijado por el backend; NULL si no hubo sesión).
  v_usuario := NULLIF(BTRIM(COALESCE(current_setting('app.usuario', true), '')), '');

  IF TG_OP = 'INSERT' THEN
    NEW.fecha_creacion := COALESCE(NEW.fecha_creacion, now());
    NEW.usuario_creacion := COALESCE(v_usuario, NEW.usuario_creacion, 'SISTEMA');
    -- fecha_modificacion / usuario_modificacion quedan NULL hasta el primer UPDATE.
    RETURN NEW;
  END IF;

  -- UPDATE: los datos de creación y el id_origen son INMUTABLES (nadie puede
  -- reescribir quién creó la fila ni cambiar su UUID de origen).
  NEW.fecha_creacion := OLD.fecha_creacion;
  NEW.usuario_creacion := OLD.usuario_creacion;
  NEW.id_origen := OLD.id_origen;

  NEW.fecha_modificacion := now();
  NEW.usuario_modificacion := COALESCE(
    v_usuario, NEW.usuario_modificacion, OLD.usuario_modificacion, 'SISTEMA'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Recorre TODAS las tablas y garantiza las columnas + el trigger.
DO $$
DECLARE
  t RECORD;
  v_existe boolean;
  v_pk_name text;
  v_pk_cols int;
  v_pk_tipo text;
  v_pk_lista text;
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'                -- tablas normales (no vistas/índices)
     ORDER BY c.relname
  LOOP
    -- ---------------------------------------------------------
    -- 2.1) id_origen (UUID único por fila)
    -- ---------------------------------------------------------
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = t.relname
         AND column_name = 'id_origen'
    ) INTO v_existe;

    IF NOT v_existe THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN id_origen uuid NOT NULL DEFAULT gen_random_uuid()',
        t.relname
      );
    END IF;

    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (id_origen)',
      'ux_' || t.relname || '_id_origen', t.relname
    );

    -- ---------------------------------------------------------
    -- 2.2) fecha_creacion
    -- ---------------------------------------------------------
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = t.relname
         AND column_name = 'fecha_creacion'
    ) INTO v_existe;

    IF NOT v_existe THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN fecha_creacion timestamp NOT NULL DEFAULT now()',
        t.relname
      );
    ELSE
      EXECUTE format('UPDATE public.%I SET fecha_creacion = now() WHERE fecha_creacion IS NULL', t.relname);
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN fecha_creacion SET DEFAULT now()', t.relname);
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN fecha_creacion SET NOT NULL', t.relname);
    END IF;

    -- ---------------------------------------------------------
    -- 2.3) usuario_creacion
    -- ---------------------------------------------------------
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = t.relname
         AND column_name = 'usuario_creacion'
    ) INTO v_existe;

    IF NOT v_existe THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN usuario_creacion varchar(150)', t.relname);
      -- Registros anteriores a la auditoría: no se sabe quién los creó.
      EXECUTE format('UPDATE public.%I SET usuario_creacion = ''MIGRACION''', t.relname);
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN usuario_creacion SET DEFAULT ''SISTEMA''', t.relname);
    EXECUTE format('UPDATE public.%I SET usuario_creacion = ''SISTEMA'' WHERE usuario_creacion IS NULL', t.relname);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN usuario_creacion SET NOT NULL', t.relname);

    -- ---------------------------------------------------------
    -- 2.4) fecha_modificacion / usuario_modificacion
    --     (NULL = la fila nunca fue modificada desde que existe la auditoría)
    -- ---------------------------------------------------------
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS fecha_modificacion timestamp', t.relname);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS usuario_modificacion varchar(150)', t.relname);

    -- ---------------------------------------------------------
    -- 2.5) id INTEGER: si la PK no es UNA columna entera (tablas puente),
    --      se crea "id" como identity y la clave natural pasa a UNIQUE.
    -- ---------------------------------------------------------
    -- Se limpian las variables en cada vuelta: si una tabla no tuviera PK,
    -- SELECT ... INTO no asigna nada y se conservarían los valores de la
    -- tabla anterior.
    v_pk_name := NULL;
    v_pk_cols := NULL;
    v_pk_tipo := NULL;
    v_pk_lista := NULL;

    SELECT c.conname,
           array_length(c.conkey, 1),
           (
             SELECT a.atttypid::regtype::text
               FROM pg_attribute a
              WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
           ),
           (
             SELECT string_agg(format('%I', a2.attname), ', ' ORDER BY array_position(c.conkey, a2.attnum))
               FROM pg_attribute a2
              WHERE a2.attrelid = c.conrelid AND a2.attnum = ANY (c.conkey)
           )
      INTO v_pk_name, v_pk_cols, v_pk_tipo, v_pk_lista
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace
     WHERE ns.nspname = 'public'
       AND cl.relname = t.relname
       AND c.contype = 'p';

    -- atttypid::regtype::text devuelve el nombre canónico: smallint/integer/bigint
    IF v_pk_name IS NULL
       OR v_pk_cols IS DISTINCT FROM 1
       OR v_pk_tipo NOT IN ('smallint', 'integer', 'bigint') THEN

      -- La clave natural (columnas de la PK anterior) queda como UNIQUE para
      -- conservar la unicidad y los "ON CONFLICT (col1, col2)" del código.
      IF v_pk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t.relname, v_pk_name);
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (%s)',
          t.relname, 'uq_' || t.relname || '_natural', v_pk_lista
        );
      END IF;

      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS id integer GENERATED BY DEFAULT AS IDENTITY',
        t.relname
      );
      EXECUTE format('ALTER TABLE public.%I ADD PRIMARY KEY (id)', t.relname);
    END IF;

    -- ---------------------------------------------------------
    -- 2.6) Trigger de auditoría en la tabla
    -- ---------------------------------------------------------
    IF NOT EXISTS (
      SELECT 1
        FROM pg_trigger tg
        JOIN pg_class cl ON cl.oid = tg.tgrelid
        JOIN pg_namespace ns ON ns.oid = cl.relnamespace
       WHERE ns.nspname = 'public'
         AND cl.relname = t.relname
         AND tg.tgname = 'trg_auditoria'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_auditoria BEFORE INSERT OR UPDATE ON public.%I '
        || 'FOR EACH ROW EXECUTE FUNCTION fn_auditoria_registro()',
        t.relname
      );
    END IF;
  END LOOP;
END $$;
