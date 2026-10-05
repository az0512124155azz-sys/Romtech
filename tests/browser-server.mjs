// Test-only provider sandbox. Not included in the public build or production API.
import { createApp } from '../server/app.mjs';
import { memoryStore, mockProvider, testEnv } from './helpers.mjs';
import { serve } from '../scripts/dev.mjs';
const store=memoryStore(),supabase=await mockProvider();
serve(createApp({env:testEnv,store,supabase}));
