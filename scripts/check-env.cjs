// Fail before Next can inline a privileged key into browser code.
const {loadEnvConfig}=require('@next/env');
loadEnvConfig(process.cwd(),false);
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
let role;
try{role=JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString()).role;}catch{/* publishable/fixture key */}
if(key.startsWith('sb_secret_')||role==='service_role'){
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY must be a public anon/publishable key, never a secret or service-role key.');process.exit(1);
}
for(const name of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'])if(!process.env[name])console.warn(`${name} is missing; authentication/data operations will be unavailable. Set it before deployment builds.`);
if(process.env.NEXT_PUBLIC_SUPABASE_URL){try{const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')throw new Error();}catch{console.error('NEXT_PUBLIC_SUPABASE_URL is invalid.');process.exit(1);}}
