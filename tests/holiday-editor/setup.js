// Provide the browser globals the editor modules expect (Temporal, jsyaml).
import 'temporal-polyfill/global';
import jsyaml from 'js-yaml';

globalThis.jsyaml = jsyaml;
