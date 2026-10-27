import {createHmac,timingSafeEqual} from 'node:crypto';

export function verifyGitHubWebhook(secret:string,rawBody:Buffer,header:string|undefined):boolean{
  if(!header?.startsWith('sha256='))return false;
  const expected=Buffer.from(`sha256=${createHmac('sha256',secret).update(rawBody).digest('hex')}`);
  const actual=Buffer.from(header);
  return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
