import {cloudflareTest} from '@cloudflare/vitest-plugin';
import {defineConfig} from 'vitest/config';
import {createHash} from 'node:crypto';
export default defineConfig({
  plugins:[cloudflareTest({main:'./worker.mjs',miniflare:{compatibilityDate:'2026-10-25',compatibilityFlags:['nodejs_compat'],bindings:{OWNER_HASH:createHash('sha256').update('test-owner-only').digest('hex')},durableObjects:{ROOMS:{className:'KingsRoom',useSQLite:true},INDEX:{className:'KingsIndex',useSQLite:true}},ratelimits:{REQUEST_LIMIT:{simple:{limit:10000,period:60},namespace_id:'1107001'}}}})],
  test:{include:['test/*.test.mjs'],testTimeout:20000}
});
