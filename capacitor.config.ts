import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clinicanuevacaracas.turnero',
  appName: 'Turnero CNC',
  webDir: 'dist/sistema-clinica',
  
  // Configuración del servidor (URL del backend)
  server: {
    // IP de tu PC Windows donde corre el backend
    // El TV se conectará a esta IP para obtener los datos
    url: 'http://ip-de-tu-pc:3000',
    cleartext: true,
  },

  // Configuración de Android
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    }
  },

  // Plugins
  plugins: {
    SplashScreen: {
      launchShowDuration: 0, // Sin splash screen
    }
  }
};

export default config;
