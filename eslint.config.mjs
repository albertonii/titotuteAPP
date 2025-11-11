import next from 'eslint-config-next';

export default [
  ...next(),
  {
    rules: {
      'react/jsx-props-no-spreading': 'off'
    }
  }
];
