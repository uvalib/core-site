// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
//import postcss from 'rollup-plugin-postcss';
import commonjs from '@rollup/plugin-commonjs';
import multiInput from 'rollup-plugin-multi-input';

export default {
  input: ['./module-build/*.js'],

  output: [
    {
      name: 'es6-components',
      dir: 'src/',
      format: 'esm'
    },
  ],

  plugins: [
    multiInput(),
    commonjs(),
//    postcss({
//      extract: false,
//      inject: false,
//      use: ['sass']
//    }),
    resolve()
  ]

};
