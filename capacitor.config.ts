import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.siscol.turnero',
  appName: 'Turnero CNC',
  // OJO: la app Android se compila con una salida propia
  // (ver "outputPath" en la configuración "capacitor" de angular.json)
  // para no sobrescribir el dist/ del despliegue web.
  webDir: 'dist/sistema-clinica-capacitor/browser',
  
  server: {
    androidScheme: 'https',
  },

  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    }
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    CapacitorHttp: {
      enabled: false,
    }
  }
};

export default config;
