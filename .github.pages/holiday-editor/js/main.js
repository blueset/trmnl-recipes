import 'temporal-polyfill/global';
import 'iconify-icon';
import { createApp } from 'vue';
import App from './App.vue';
import '../style.css';
import './theme.js';

createApp(App).mount('#app');
