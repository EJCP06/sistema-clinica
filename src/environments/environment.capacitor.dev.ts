/**
 * Entorno para Capacitor en DESARROLLO LOCAL.
 *
 * Usa la IP de la máquina local (o localhost para emulador Android)
 * para que el dispositivo acceda al backend que corre en ng serve.
 *
 * IMPORTANTE: Cambia `LOCAL_IP` por la IP real de tu máquina en la red local.
 * Ejecuta `ipconfig` (Windows) o `ifconfig` (Mac/Linux) para encontrarla.
 *
 * Para Android Emulator usa: http://10.0.2.2:3001
 * Para dispositivo físico usa: http://TU_IP:3001
 */
export const environment = {
  production: false,
  // 10.0.2.2 = localhost del host en Android Emulator
  // Cambia esto si usas un dispositivo físico en tu red local
  apiUrl: 'http://10.0.2.2:3001/api',
  socketUrl: 'http://10.0.2.2:3001',
  socketTransports: ['websocket', 'polling'] as const,
};
