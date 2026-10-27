import {randomUUID} from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import rawBody from 'fastify-raw-body';
import {z} from 'zod';
import type {Config} from './config.js';
import type {Db} from './db.js';
import {canonicalMessage,sha256,type ChallengeMessage} from './canonical.js';
import {FullOnChain} from './chain.js';
import {GitHubDiscussions} from './github.js';
import {verifyGitHubWebhook} from './webhook.js';

const account=z.string().regex(/^[a-z1-5.]{1,12}$/);
const permission=z.string().regex(/^[a-z1-5.]{1,12}$/);
const content=z.object({account,permission:permission.default('active'),title:z.string().trim().min(4).max(200),body:z.string().trim().min(20).max(60_000)});

export function buildServer(deps:{config:Config;db:Db;chain:FullOnChain;github:GitHubDiscussions}){
  const {config,db,chain,github}=deps;
  const app=Fastify({logger:true,bodyLimit:128*1024});
  app.register(cors,{origin:(origin,cb)=>cb(null,!origin||config.allowedOrigins.includes(origin))});
  app.register(rateLimit,{max:60,timeWindow:'1 minute'});
  app.register(rawBody,{field:'rawBody',global:false,encoding:false,runFirst:true});

  app.get('/healthz',async()=>({ok:true}));

  app.post('/v1/auth/challenge',async(request,reply)=>{
    const value=content.parse(request.body);
    const id=randomUUID(),now=new Date(),expires=new Date(now.getTime()+config.CHALLENGE_TTL_SECONDS*1000);
    const message:ChallengeMessage={domain:new URL(config.PUBLIC_ORIGIN).host,purpose:'create-governance-discussion',account:value.account,permission:value.permission,chain_id:config.FULLON_CHAIN_ID,title_hash:sha256(value.title),body_hash:sha256(value.body),nonce:id,issued_at:now.toISOString(),expires_at:expires.toISOString()};
    const canonical=canonicalMessage(message);
    await db.query('INSERT INTO auth_challenges(id,account,permission_name,message,message_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6)',[id,value.account,value.permission,message,sha256(canonical),expires]);
    return reply.code(201).send({challenge_id:id,message,canonical_message:canonical,expires_at:expires.toISOString()});
  });

  app.post('/v1/auth/verify',async(request,reply)=>{
    const value=z.object({challenge_id:z.string().uuid(),signature:z.string().min(20)}).parse(request.body);
    const result=await db.query('SELECT * FROM auth_challenges WHERE id=$1',[value.challenge_id]);
    const challenge=result.rows[0];
    if(!challenge||challenge.consumed_at||new Date(challenge.expires_at)<=new Date())return reply.code(400).send({error:'challenge_invalid_or_expired'});
    const publicKey=await chain.verifyPermissionSignature(challenge.account,challenge.permission_name,canonicalMessage(challenge.message),value.signature);
    return {valid:true,account:challenge.account,permission:challenge.permission_name,public_key:publicKey,expires_at:challenge.expires_at};
  });

  app.post('/v1/discussions',async(request,reply)=>{
    const value=content.extend({challenge_id:z.string().uuid(),signature:z.string().min(20)}).parse(request.body);
    const client=await db.connect();
    try{
      await client.query('BEGIN');
      const result=await client.query('SELECT * FROM auth_challenges WHERE id=$1 FOR UPDATE',[value.challenge_id]);
      const challenge=result.rows[0];
      if(!challenge||challenge.consumed_at||new Date(challenge.expires_at)<=new Date()){
        await client.query('ROLLBACK');
        return reply.code(400).send({error:'challenge_invalid_or_expired'});
      }
      const expected=challenge.message as ChallengeMessage;
      if(expected.account!==value.account||expected.permission!==value.permission||expected.title_hash!==sha256(value.title)||expected.body_hash!==sha256(value.body)){
        await client.query('ROLLBACK');
        return reply.code(400).send({error:'signed_content_mismatch'});
      }
      const canonical=canonicalMessage(expected);
      const publicKey=await chain.verifyPermissionSignature(value.account,value.permission,canonical,value.signature);
      const proofId=randomUUID();
      const verificationUrl=`${config.PUBLIC_ORIGIN}/v1/verification/${proofId}`;
      const identity=`\n\n---\n### Verified FullOn identity\n- Account: \`${value.account}@${value.permission}\`\n- Network: ${config.FULLON_NETWORK_NAME}\n- Chain ID: \`${config.FULLON_CHAIN_ID}\`\n- Content hash: \`${sha256(`${value.title}\n${value.body}`)}\`\n- Signed at: ${expected.issued_at}\n- [Verify proof](${verificationUrl})\n\n_Posted by FullOn DAO Bot on behalf of the verified FullOn account._`;
      const discussion=await github.createDiscussion(value.title,`${value.body}${identity}`);
      await client.query('INSERT INTO discussions(id,github_node_id,github_number,github_url,github_category,title,body_hash,fullon_account,permission_name,chain_id,proof_signature,proof_public_key,proof_message) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[proofId,discussion.id,discussion.number,discussion.url,config.GITHUB_DISCUSSION_CATEGORY_ID,value.title,sha256(value.body),value.account,value.permission,config.FULLON_CHAIN_ID,value.signature,publicKey,expected]);
      await client.query('UPDATE auth_challenges SET consumed_at=now() WHERE id=$1',[value.challenge_id]);
      await client.query('COMMIT');
      return reply.code(201).send({discussion_number:discussion.number,discussion_url:discussion.url,discussion_uri:discussion.url,verification_id:proofId});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });

  app.get('/v1/discussions',async request=>{
    const limit=z.coerce.number().int().min(1).max(50).catch(20).parse((request.query as Record<string,string>).limit);
    const result=await db.query('SELECT github_number,github_url,title,fullon_account,permission_name,proposal_id,proposal_tx_id,proposal_status,created_at,updated_at FROM discussions ORDER BY created_at DESC LIMIT $1',[limit]);
    return {items:result.rows};
  });

  app.get('/v1/verification/:id',async(request,reply)=>{
    const id=z.string().uuid().parse((request.params as {id:string}).id);
    const result=await db.query('SELECT fullon_account,permission_name,chain_id,proof_public_key,proof_message,created_at FROM discussions WHERE id=$1',[id]);
    if(!result.rowCount)return reply.code(404).send({error:'not_found'});
    return {valid:true,...result.rows[0]};
  });

  app.post('/v1/discussions/:number/link-proposal',async(request,reply)=>{
    const number=z.coerce.number().int().positive().parse((request.params as {number:string}).number);
    const value=z.object({proposal_id:z.number().int().nonnegative(),transaction_id:z.string().regex(/^[0-9a-f]{64}$/)}).parse(request.body);
    const discussion=await db.query('SELECT github_node_id,github_url,fullon_account FROM discussions WHERE github_number=$1',[number]);
    if(!discussion.rowCount)return reply.code(404).send({error:'discussion_not_found'});
    const proposal=await chain.proposal(value.proposal_id);
    if(!proposal)return reply.code(400).send({error:'proposal_not_found_on_chain'});
    const stored=discussion.rows[0];
    if(proposal.proposer!==stored.fullon_account||proposal.discussion_uri!==stored.github_url)return reply.code(400).send({error:'proposal_discussion_identity_mismatch'});
    const result=await db.query('UPDATE discussions SET proposal_id=$1,proposal_tx_id=$2,proposal_status=$3,updated_at=now() WHERE github_number=$4 RETURNING github_node_id,github_url',[value.proposal_id,value.transaction_id,String(proposal.status),number]);
    await github.addComment(result.rows[0].github_node_id,`### On-chain proposal linked\n\n- Proposal ID: \`${value.proposal_id}\`\n- Transaction ID: \`${value.transaction_id}\`\n- Current status: \`${String(proposal.status)}\``);
    return {linked:true,discussion_url:result.rows[0].github_url,proposal_id:value.proposal_id};
  });

  app.post('/v1/webhooks/github',{config:{rawBody:true}},async(request,reply)=>{
    const raw=(request as typeof request&{rawBody?:Buffer}).rawBody;
    if(!raw||!verifyGitHubWebhook(config.GITHUB_WEBHOOK_SECRET,raw,request.headers['x-hub-signature-256'] as string|undefined))return reply.code(401).send({error:'invalid_signature'});
    const delivery=String(request.headers['x-github-delivery']||'');
    const event=String(request.headers['x-github-event']||'unknown');
    if(delivery)await db.query('INSERT INTO webhook_deliveries(delivery_id,event_name) VALUES($1,$2) ON CONFLICT DO NOTHING',[delivery,event]);
    return reply.code(202).send({accepted:true});
  });

  return app;
}
