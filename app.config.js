// Configuración dinámica de Expo: parte de app.json y solo cambia de dónde sale la configuración nativa de Firebase.
// google-services.json y GoogleService-Info.plist NO están en git. En EAS Build llegan por variables de entorno
// de tipo archivo (GOOGLE_SERVICES_JSON y GOOGLE_SERVICES_PLIST); en local se usan las rutas de app.json.
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    googleServicesFile: process.env.GOOGLE_SERVICES_PLIST ?? config.ios?.googleServicesFile,
  },
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
  },
});
