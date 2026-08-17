/**
 * Metro reads this implicitly, but Jest needs it to exist so `babel-jest` can
 * transform the React Native / Expo sources (and their Flow-typed internals).
 */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
  };
};
