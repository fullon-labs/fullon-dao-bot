import {loadConfig} from './config.js';
import {createDb,migrate} from './db.js';
import {FullOnChain} from './chain.js';
import {GitHubDiscussions} from './github.js';
import {buildServer} from './server.js';

const config=loadConfig();
const db=createDb(config.DATABASE_URL);
await migrate(db);
const chain=new FullOnChain(config.FULLON_RPC_URL,config.FULLON_CHAIN_ID,config.DAO_CONTRACT);
const github=new GitHubDiscussions({appId:config.GITHUB_APP_ID,installationId:config.GITHUB_INSTALLATION_ID,privateKey:config.githubPrivateKey,owner:config.GITHUB_OWNER,repo:config.GITHUB_REPO,categoryId:config.GITHUB_DISCUSSION_CATEGORY_ID});
const app=buildServer({config,db,chain,github});

const close=async()=>{await app.close();await db.end();};
process.on('SIGTERM',close);
process.on('SIGINT',close);
await app.listen({host:config.HOST,port:config.PORT});
