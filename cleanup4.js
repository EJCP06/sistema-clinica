const fs = require('fs');
const file = 'C:\\Users\\Edward\\Desktop\\sistema clinica\\src\\app\\features\\turnero\\turnero.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\r\n/g, '\n');

// Remove old detenerRepeticionTimer (around line 933-939)
const oldDetenerTimer = `  private detenerRepeticionTimer() {
    if (this.repeatTimerId) {
      clearTimeout(this.repeatTimerId);
      clearInterval(this.repeatTimerId);
      this.repeatTimerId = null;
    }
  }

  private detenerRepeticion() {
    this.detenerRepeticionTimer();
    this.pacienteParaRepetir = null;
    this.ultimoIdAtencion = null;
    this.ultimoNumeroTurno = null;
    this.estaReproduciendo = false;
    // Se limpia la deduplicación: si el mismo paciente se vuelve a llamar
    // poco después de detenerse (p. ej. tras "Iniciar"/"Ausente"), el
    // nuevo anuncio debe sonar sin que la ventana de 15s lo bloquee.
    this.ultimoIdAnunciado = null;
    this.ultimaVezAnunciado = 0;
    // Se reinicia también la guardia global (a nivel de módulo y a nivel de
    // window): tras Iniciar/Ausente/Retirar, un nuevo llamado del mismo
    // paciente sí debe sonar de inmediato.
    ultimoAnuncioGlobal = null;
    limpiarGuardiaGlobalAntiDoble();
    try {
      sessionStorage.removeItem('turnero_ultimo_anuncio_id');
      sessionStorage.removeItem('turnero_ultimo_anuncio_ts');
    } catch {
      // Almacenamiento no disponible: se ignora.
    }
    if (this.audioWatchdog) {
      clearTimeout(this.audioWatchdog);
      this.audioWatchdog = null;
    }
    if (this.speakTimeout) {
      clearTimeout(this.speakTimeout);
      this.speakTimeout = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Activa el audio del turnero en la primera interacción del usuario.
   * Los navegadores exigen un gesto del usuario para permitir
   * speechSynthesis; una vez desbloqueado, queda activo en la sesión.
   */
  private registrarDesbloqueoAudio()`;

const newRegistrar = `  private registrarDesbloqueoAudio()`;

content = content.replace(oldDetenerTimer, newRegistrar);

// Remove old reproducirAudio (with individual params)
const oldReproducirAudio = `  private reproducirAudio(nombre: string, apellido: string, consultorio: string, idAtencion: number | null = null, inicioMs?: number | null): boolean {
    if (!('speechSynthesis' in window)) {
      console.error('SpeechSynthesis no soportado.');
      return false;
    }

    // Deduplicación: el mismo paciente no debe anunciarse dos veces en menos
    // de 9 segundos. Un llamado puede llegar por varias vías casi a la vez
    // (socket + verificación periódica), lo que hacía que la voz sonara dos
    // veces seguidas. La repetición cada 10s sigue funcionando (supera la
    // ventana). Si el sonido aún no fue confirmado en esta carga (p. ej.
    // primer desbloqueo), no se deduplica para no perder el anuncio.
    const ahora = Date.now();
    if (this.sonidoConfirmado && idAtencion && idAtencion === this.ultimoIdAnunciado && ahora - this.ultimaVezAnunciado < 9000) {
      return false;
    }
    this.ultimoIdAnunciado = idAtencion;
    this.ultimaVezAnunciado = ahora;
    // Persistencia para reanudar el ciclo tras una recarga (F5): la voz
    // continúa en la fase que le corresponde en vez de reiniciarse.
    try {
      if (idAtencion) {
        sessionStorage.setItem('turnero_ultimo_anuncio_id', String(idAtencion));
      } else {
        sessionStorage.removeItem('turnero_ultimo_anuncio_id');
      }
      sessionStorage.setItem('turnero_ultimo_anuncio_ts', String(ahora));
    } catch {
      // Almacenamiento no disponible: se ignora.
    }
    
    if (!this.vozFemenina) {
      this.cargarVozFemenina();
    }

    const nombreCompleto = \`\${nombre} \${apellido}\`.trim();

    const consultorioLimpio = consultorio.replace(/\\b0+(\\d+)\\b/g, '\$1');

    let texto = \`Paciente \${nombreCompleto}, diríjase al consultorio \${consultorioLimpio}\`;
    
    // Si el "destino" es en realidad un servicio (paciente marcado como
    // llamado por APS/laboratorio/imágenes sin consultorio asignado),
    // se anuncia el servicio directamente y se evita el "al consultorio".
    const c = consultorio.toLowerCase();
    if (c.includes('laboratorio')) {
      texto = \`Paciente \${nombreCompleto}, diríjase a laboratorio\`;
    } else if (c.includes('imágenes') || c.includes('imagenes')) {
      texto = \`Paciente \${nombreCompleto}, diríjase a imágenes\`;
    } else if (c.includes('consulta')) {
      texto = \`Paciente \${nombreCompleto}, diríjase a consulta\`;
    } else if (c.startsWith('consultorio')) {
      // Evita el doble "al consultorio Consultorio 1".
      texto = \`Paciente \${nombreCompleto}, diríjase al \${consultorioLimpio}\`;
    }

    // GUARDIA GLOBAL ANTI-DOBLE: el MISMO texto (mismo paciente + consultorio)
    // no puede reproducirse dos veces. Se bloquea si el anuncio anterior (a)
    // aún se está reproduciendo o (b) ya sonó hace menos de 9s (la repetición
    // legítima ocurre a los 10s exactos y siempre se permite). Un texto
    // distinto (otro paciente o consultorio) NUNCA se bloquea. Si el navegador
    // nunca reprodujo el anuncio (autoplay bloqueado), no bloquea: el primer
    // click lo fuerza.
    const hablandoAhora = 'speechSynthesis' in window && window.speechSynthesis.speaking;
    const bloqueaDoble = !!ultimoAnuncioGlobal && ultimoAnuncioGlobal.texto === texto && (
      hablandoAhora || (ultimoAnuncioGlobal.sonado && ahora - ultimoAnuncioGlobal.ts < VENTANA_ANTIDOBLE_MS)
    );
    if (bloqueaDoble) {
      return false;
    }
    ultimoAnuncioGlobal = { texto, ts: ahora, sonado: false };
    this.ultimoIdReproducido = idAtencion;

    // Seguridad: si el navegador nunca dispara onend/onerror (p. ej. voz
    // bloqueada), libera el flag para no bloquear futuros llamados.
    if (this.audioWatchdog) {
      clearTimeout(this.audioWatchdog);
      this.audioWatchdog = null;
    }
    this.audioWatchdog = setTimeout(() => {
      // Si el motor de voz quedó colgado ("speaking" atascado en true sin
      // disparar onend/onerror), se fuerza la cancelación para desatascarlo.
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        // El sonido efectivamente se está reproduciendo: se confirma para
        // que la deduplicación se active aunque onstart/onend no hayan
        // disparado (comportamiento irregular de Chrome/Windows).
        this.sonidoConfirmado = true;
        if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
        this.quitarListenersDesbloqueo();
        window.speechSynthesis.cancel();
      }
      this.estaReproduciendo = false;
    }, 30000);

    const utterance = new SpeechSynthesisUtterance(texto);
    if (this.vozFemenina) {
      utterance.voice = this.vozFemenina;
      utterance.lang = this.vozFemenina.lang;
    } else {
      utterance.lang = 'es-MX';
    }
    utterance.rate = 0.9;

    // Confirmación REAL de audio: solo cuando speechSynthesis emite onstart
    // sabemos que el navegador aceptó la voz en esta carga de página. Hasta
    // entonces los listeners de desbloqueo permanecen activos (necesarios
    // tras un F5).
    utterance.onstart = () => {
      this.sonidoConfirmado = true;
      if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
      this.quitarListenersDesbloqueo();
    };

    utterance.onend = () => {
      this.estaReproduciendo = false;
      // Algunos motores (Chrome/Windows con ciertas voces) terminan la
      // locución sin haber disparado onstart. Como el audio sí se escuchó,
      // se confirma el sonido igual: sin esto la deduplicación de 15s
      // quedaría desactivada y un click/desbloqueo podía volver a anunciar
      // al mismo paciente (voz dos veces seguidas).
      this.sonidoConfirmado = true;
      if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
      this.quitarListenersDesbloqueo();
      if (this.audioWatchdog) {
        clearTimeout(this.audioWatchdog);
        this.audioWatchdog = null;
      }
      this.reproducirPendienteSiExiste();
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e.error);
      if (this.audioWatchdog) {
        clearTimeout(this.audioWatchdog);
        this.audioWatchdog = null;
      }
      this.estaReproduciendo = false;
      // NO se reintenta en línea: Chrome dispara errores transitorios
      // (interrupted/canceled) que, al reintentar, duplicaban la voz.
      // La repetición cada 10s ya se encarga de volver a anunciar. Los
      // errores interrupted/canceled significan que OTRO anuncio tomó el
      // motor (o se detuvo la voz): reintentar aquí producía la voz doble.
      if (e.error === 'interrupted' || e.error === 'canceled') {
        return;
      }
      this.reproducirPendienteSiExiste();
    };
    
    // SINCRONIZACIÓN: si el servidor envió \`inicio_ms\` (hora objetivo en su
    // reloj), la locución se agenda para esa MISMA hora absoluta en todas las
    // pantallas (convertida a tiempo local restando el desfase de reloj), así
    // todas las voces suenan a la vez. Sin \`inicio_ms\` se usa el retraso fijo
    // de 300ms de siempre (compatibilidad con eventos antiguos).
    let retrasoSpeak = 300;
    if (inicioMs && Number.isFinite(inicioMs)) {
      const objetivoLocal = inicioMs - this.deltaRelojMs;
      retrasoSpeak = Math.max(0, objetivoLocal - Date.now());
    }

    // A prueba de dobles: si otra llamada llegó antes de que arranque la
    // locución (p. ej. el mismo evento duplicado por el socket o dos vías a
    // la vez), se cancela el speak pendiente anterior para que nunca haya dos
    // locuciones encimadas.
    if (this.speakTimeout) {
      clearTimeout(this.speakTimeout);
      this.speakTimeout = null;
    }
    this.speakTimeout = setTimeout(() => {
      this.speakTimeout = null;
      // El cancel se ejecuta en el MISMO instante que el speak (no antes):
      // todas las pantallas cortan la voz anterior y arrancan la nueva juntas.
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      this.ultimoDisparoVozMs = Date.now();
      window.speechSynthesis.speak(utterance);
    }, retrasoSpeak);
    return true;
  }

  /**
   * Si llegó un nuevo llamado mientras se anunciaba otro paciente,
   * lo reproduce apenas termina la locución actual.
   */
  private reproducirPendienteSiExiste() {
    if (this.pacienteParaRepetir && this.ultimoIdAtencion && this.ultimoIdAtencion !== this.ultimoIdReproducido) {
      this.estaReproduciendo = true;
      const anunciado = this.reproducirAudio(
        this.pacienteParaRepetir.paciente,
        this.pacienteParaRepetir.apellido,
        this.pacienteParaRepetir.consultorio,
        this.ultimoIdAtencion,
        this.inicioMsActual
      );
      if (anunciado) {
        // El paciente pendiente inicia su propio presupuesto de repeticiones,
        // alineado al ciclo global (inicio_ms + n*10000).
        this.iniciarTemporizadorRepeticion(10000, this.inicioMsActual);
      } else {
        this.estaReproduciendo = false;
      }
    }
  }`;

const newEnd = `}`;

content = content.replace(oldReproducirAudio, newEnd);

// Also remove old iniciarTemporizadorRepeticion
const oldIniciar = `  private iniciarTemporizadorRepeticion(primerDelayMs = 10000, cicloBaseMs?: number | null) {
    this.detenerRepeticionTimer();
    const hablar = (): boolean => {
      if (!this.pacienteParaRepetir) {
        this.detenerRepeticionTimer();
        return false;
      }
      // El anuncio suena una vez cada 10 segundos exactos mientras el
      // paciente siga llamado. Se detiene al iniciar la atención, marcarlo
      // ausente o retirarlo (evento del mismo paciente), o si deja de ser
      // el último llamado activo (ver verificarUltimoLlamado).
      const anunciado = this.reproducirAudio(
        this.pacienteParaRepetir.paciente,
        this.pacienteParaRepetir.apellido,
        this.pacienteParaRepetir.consultorio,
        this.ultimoIdAtencion
      );
      // Estado consistente: mientras una locución está programada o sonando,
      // estaReproduciendo=true. Sin esto, un NUEVO llamado por el socket se
      // anunciaba de inmediato mientras esta locución seguía sonando → Chrome
      // encolaba la segunda voz y se escuchaban DOS anuncios seguidos.
      this.estaReproduciendo = anunciado;
      return true;
    };
    // Retardo hasta la SIGUIENTE marca de 10s de la grilla (cicloBaseMs + n*10000).
    // Devuelve null cuando el ciclo ya pasó la ventana del llamado (2 min del
    // contador del médico): la cadena se detiene para que la voz no siga
    // sonando en bucle si el evento de auto-ausente no llegó por el socket.
    const retardoHastaSiguienteMarca = (minMs: number): number | null => {
      if (!cicloBaseMs || !Number.isFinite(cicloBaseMs)) {
        return Math.max(minMs, primerDelayMs);
      }
      const baseLocal = cicloBaseMs - this.deltaRelojMs;
      const ahora = Date.now();
      const desfase = ahora - baseLocal;
      if (desfase >= VENTANA_LLAMADO_MS) return null;
      const periodos = Math.max(1, Math.floor(desfase / 10000) + 1);
      const siguienteBorde = baseLocal + periodos * 10000;
      if (siguienteBorde - baseLocal >= VENTANA_LLAMADO_MS) return null;
      return Math.max(minMs, siguienteBorde - ahora);
    };

    // AUTO-CORRECCIÓN: tras cada anuncio se re-agenda el siguiente en la
    // próxima marca EXACTA de 10s (setTimeout recursivo, nunca setInterval).
    // Si un tick se retrasa (throttling del navegador, carga de CPU), el
    // siguiente vuelve a caer en la marca de la grilla: el intervalo jamás
    // acumula deriva → la voz suena CADA 10 SEGUNDOS EXACTOS.
    const agendarSiguiente = () => {
      const delay = retardoHastaSiguienteMarca(100);
      if (delay === null) return; // Ventana del llamado terminada: la cadena se detiene sola.
      this.repeatTimerId = setTimeout(() => {
        let continuar = true;
        try {
          continuar = hablar();
          if (continuar) {
            console.log('[Turnero v7] Anuncio repetido (ciclo de 10s).');
          }
        } catch (e) {
          console.error('[Turnero v7] Error en anuncio repetido:', e);
        }
        if (continuar) {
          agendarSiguiente();
        }
      }, delay);
    };

    // Primer disparo en la siguiente marca de 10s y luego auto-corregido.
    const delayPrimero = retardoHastaSiguienteMarca(500);
    if (delayPrimero === null) return; // Llamado ya fuera de ventana: no repetir.
    this.repeatTimerId = setTimeout(() => {
      let continuar = true;
      try {
        continuar = hablar();
      } catch (e) {
        console.error('[Turnero v7] Error en anuncio repetido:', e);
      }
      if (continuar) {
        agendarSiguiente();
      }
    }, delayPrimero);
  }`;

content = content.replace(oldIniciar, '');

content = content.replace(/\n\n\n+/g, '\n\n');
content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(file, content, 'utf8');
console.log('Done removing old functions');