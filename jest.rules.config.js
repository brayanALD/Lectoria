// Configuración de Jest para las pruebas de reglas de Firestore (entorno Node, sin preset de React Native).
// babel-preset-expo es una dependencia de `expo` y no queda en la raíz de node_modules: se resuelve desde él.
const babelPresetExpo = require.resolve('babel-preset-expo', {
  paths: [require.resolve('expo/package.json')],
});

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/rules'],
  transform: {
    '^.+\\.tsx?$': ['babel-jest', { presets: [babelPresetExpo] }],
  },
};
