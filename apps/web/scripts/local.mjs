import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';

if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Local SQLite mode requires Node.js 24 or newer.');
const command = process.argv[2];
if (!['build','start'].includes(command)) throw new Error('Use local.mjs build or start');
const envFile = resolve(process.cwd(),'.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);
process.env.EASY_ICON_LOCAL_MODE = 'true';
process.env.NEXT_PUBLIC_EASY_ICON_LOCAL_MODE = 'true';
// Local mode is never an indexable public deployment, even for a production build.
process.env.APP_ENV = 'development';
process.env.NEXT_PUBLIC_APP_ENV = 'development';
process.env.SUPABASE_ENVIRONMENT = 'development';
const child = spawn(process.execPath,[resolve(process.cwd(),'../../node_modules/next/dist/bin/next'),command,...(command === 'build' ? ['--webpack'] : ['--hostname','127.0.0.1'])],{env:process.env,stdio:'inherit'});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code ?? 1));
