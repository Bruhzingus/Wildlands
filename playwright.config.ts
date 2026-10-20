import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';

export default defineConfig({
 testDir:'tests/browser',
 timeout:90000,
 expect:{timeout:12000},
 workers:1,
 fullyParallel:false,
 reporter:[['list']],
 outputDir:'artifacts/browser/results',
 use:{
  baseURL:'http://localhost:5173',
  viewport:{width:1440,height:900},
  launchOptions:{
   ...(existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?{channel:'chrome'}:{}),
   args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'],
  },
  screenshot:'only-on-failure',
  trace:'retain-on-failure',
 },
 webServer:{command:'npm run dev -- --port 5173 --strictPort',url:'http://localhost:5173',reuseExistingServer:!process.env.CI,timeout:30000},
});
