import { defineConfig } from 'vite';
export default defineConfig({
 base:'./',
 server:{port:5173,host:'0.0.0.0',watch:{ignored:['**/artifacts/**','**/test-results/**','**/playwright-report/**']}},
 build:{target:'es2022'},
});
