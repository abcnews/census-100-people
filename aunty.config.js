module.exports = {
  type: "basic",
  webpack: config => {
    config.entry = {
      index: require.resolve("./src/index.js"),
      scrollyteller: require.resolve("./src/scrollyteller.js")
    };
    return config;
  },
  build: {
    extractCSS: true,
    useCSSModules: false
  }
};
