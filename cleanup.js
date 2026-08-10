const fs = require('fs');
const file = 'C:\\Users\\Edward\\Desktop\\sistema clinica\\src\\app\\features\\turnero\\turnero.ts';
let content = fs.readFileSync(file, 'utf8');

const oldDetener = `  private detenerRepeticionTimer() {
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

content = content.replace(oldDetener, newRegistrar);

fs.writeFileSync(file, content, 'utf8');
console.log('Done removing old detener functions');