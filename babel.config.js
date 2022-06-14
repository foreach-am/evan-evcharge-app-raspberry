module.exports = {
  sourceType: 'unambiguous',
  compact: false,
  presets: [
    '@babel/preset-env',
    {
      targets: {
        node: 'current',
      },
    },
  ],
  comments: false,
  targets: {
    chrome: '58',
    ie: '11',
  },
  assumptions: {
    setPublicClassFields: true,
    noDocumentAll: true,
    noClassCalls: true,
    constantReexports: true,
  },
};