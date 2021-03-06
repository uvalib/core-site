// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
//import postcss from 'rollup-plugin-postcss';
//import commonjs from '@rollup/plugin-commonjs';
import multiInput from 'rollup-plugin-multi-input';
import { importMetaAssets } from '@web/rollup-plugin-import-meta-assets';

export default {
  input: ['src/modules/*.js'],

  output: [
    {
      name: 'es6-components',
      dir: 'module-build/',
      format: 'es'
    },
  ],

  plugins: [
    multiInput({ relative: 'src/modules/' }),
//    commonjs(),
//    postcss({
//      extract: false,
//      inject: false,
//      use: ['sass']
//    }),
    resolve(),
    importMetaAssets()
  ]

};
