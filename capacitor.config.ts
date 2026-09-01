import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clinicanuevacaracas.turnero',
  appName: 'Turnero CNC',
  webDir: 'dist/sistema-clinica/browser',
  
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
