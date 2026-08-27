import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clinicanuevacaracas.turnero',
  appName: 'Turnero CNC',
  webDir: 'dist/sistema-clinica',
  
  // Configuración del servidor (URL del backend)
  server: {
    // URL oficial del sistema (HTTPS con certificado SSL)
    url: 'https://cola-cat.clinicanuevacaracas.net',
    // No se necesita cleartext porque ya es HTTPS
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
