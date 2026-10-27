import {createHmac} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {verifyGitHubWebhook} from '../src/webhook.js';

describe('GitHub webhook verification',()=>{
  it('accepts valid and rejects invalid signatures',()=>{
    const body=Buffer.from('{"ok":true}'),secret='correct horse battery staple';
    const signature=`sha256=${createHmac('sha256',secret).update(body).digest('hex')}`;
    expect(verifyGitHubWebhook(secret,body,signature)).toBe(true);
    expect(verifyGitHubWebhook(secret,body,'sha256=00')).toBe(false);
  });
});
