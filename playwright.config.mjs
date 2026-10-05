import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',workers:1,fullyParallel:false,timeout:60000,
  use:{baseURL:'http://127.0.0.1:4173',headless:true,trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{browserName:'chromium'}}],
  webServer:{command:'node tests/browser-server.mjs',url:'http://127.0.0.1:4173',reuseExistingServer:false,timeout:15000}
});
