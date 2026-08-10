const fs = require('fs');
const file = 'C:\\Users\\Edward\\Desktop\\sistema clinica\\src\\app\\features\\turnero\\turnero.ts';
let content = fs.readFileSync(file, 'utf8');

// Remove duplicate speakTimeout (first occurrence with comment)
const oldSpeakTimeout = `  private speakTimeout: any = null;
  /**
   * Timer del speak pendiente (reproducirAudio espera 300ms antes de
   * hablar). Se limpia en cada nueva llamada: así, aunque un evento de
   * llamado llegue duplicado (o dos vías disparen a la vez), NUNCA pueden
   * quedar dos locuciones programadas encimadas.
   */
  private speakTimeout: any = null;`;

const newSpeakTimeout = `  private speakTimeout: any = null;`;

content = content.replace(oldSpeakTimeout, newSpeakTimeout);

fs.writeFileSync(file, content, 'utf8');
console.log('Done removing duplicate speakTimeout');