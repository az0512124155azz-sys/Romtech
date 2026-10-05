import { passwordHash } from '../server/security.mjs';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
if(!process.stdin.isTTY){console.error('Run in an interactive terminal; do not put a password on the command line.');process.exit(1)}
let muted=false;
const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk,encoding);callback()}});
const rl=createInterface({input:process.stdin,output,terminal:true});
process.stdout.write('New owner password (12+ characters, input hidden): ');muted=true;
rl.question('',answer=>{
  rl.close();muted=false;process.stdout.write('\n');
  if(answer.length<12||answer.length>256){console.error('Password must contain 12–256 characters.');process.exitCode=1;return}
  console.log('ROMTECH_OWNER_PASSWORD_HASH='+passwordHash(answer));
});
