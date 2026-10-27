import {createHash} from 'node:crypto';

export type ChallengeMessage={
  domain:string;
  purpose:'create-governance-discussion';
  account:string;
  permission:string;
  chain_id:string;
  title_hash:string;
  body_hash:string;
  nonce:string;
  issued_at:string;
  expires_at:string;
};

export const sha256=(value:string)=>createHash('sha256').update(value,'utf8').digest('hex');

export function canonicalMessage(value:ChallengeMessage):string{
  return [
    'FullOn DAO signed request',
    `domain:${value.domain}`,
    `purpose:${value.purpose}`,
    `account:${value.account}`,
    `permission:${value.permission}`,
    `chain_id:${value.chain_id}`,
    `title_hash:${value.title_hash}`,
    `body_hash:${value.body_hash}`,
    `nonce:${value.nonce}`,
    `issued_at:${value.issued_at}`,
    `expires_at:${value.expires_at}`
  ].join('\n');
}
