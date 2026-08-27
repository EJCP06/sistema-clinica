import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clinicanuevacaracas.turnero',
  appName: 'Turnero CNC',
  webDir: 'dist/sistema-clinica/browser',
  
  // Servidor: usar assets locales (dist/sistema-clinica)
  // El backend se llama por HTTP directamente (CapacitorHttp)
  server: {
    androidScheme: 'https',
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
    },
    // Habilitar CapacitorHttp para peticiones HTTP nativas
    // Esto resuelve problemas de CORS en Android
    CapacitorHttp: {
      enabled: true,
    }
  }
};

export default config;
