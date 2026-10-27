import {createHash} from 'node:crypto';
import {loadConfig} from './config.js';
import {createDb} from './db.js';
import {FullOnChain} from './chain.js';
import {GitHubDiscussions} from './github.js';

const config=loadConfig(),db=createDb(config.DATABASE_URL);
const chain=new FullOnChain(config.FULLON_RPC_URL,config.FULLON_CHAIN_ID,config.DAO_CONTRACT);
const github=new GitHubDiscussions({appId:config.GITHUB_APP_ID,installationId:config.GITHUB_INSTALLATION_ID,privateKey:config.githubPrivateKey,owner:config.GITHUB_OWNER,repo:config.GITHUB_REPO,categoryId:config.GITHUB_DISCUSSION_CATEGORY_ID});
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function poll(){
  const rows=await db.query('SELECT github_node_id,proposal_id,last_chain_state_hash FROM discussions WHERE proposal_id IS NOT NULL');
  for(const row of rows.rows){
    const proposal=await chain.proposal(Number(row.proposal_id));
    if(!proposal)continue;
    const stateHash=hash(proposal);
    if(stateHash===row.last_chain_state_hash)continue;
    await github.addComment(row.github_node_id,`### Governance status updated\n\nProposal \`${row.proposal_id}\` is now in on-chain status \`${String(proposal.status)}\`.\n\n<details><summary>Chain state</summary>\n\n\`\`\`json\n${JSON.stringify(proposal,null,2)}\n\`\`\`\n</details>`);
    await db.query('UPDATE discussions SET proposal_status=$1,last_chain_state_hash=$2,updated_at=now() WHERE proposal_id=$3',[String(proposal.status),stateHash,row.proposal_id]);
  }
}

let stopped=false;
process.on('SIGTERM',()=>{stopped=true;});
process.on('SIGINT',()=>{stopped=true;});
while(!stopped){
  try{await poll();}catch(error){console.error(error);}
  await new Promise(resolve=>setTimeout(resolve,config.WORKER_INTERVAL_SECONDS*1000));
}
await db.end();
