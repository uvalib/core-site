// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: ['./prebuild.js'],

  output: [
    {
      name: 'es6-components',
      dir: 'src/es6-components',
      format: 'esm'
    },
  ],

  plugins: [
    commonjs(),
    postcss({
      extract: false,
      inject: false,
      use: ['sass']
    }),
    resolve()
  ]

};
