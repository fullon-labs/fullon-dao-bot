import ecc from 'eosjs-ecc';
import {sha256} from './canonical.js';

type Permission={perm_name:string;required_auth:{keys:Array<{key:string;weight:number}>}};
type Account={permissions:Permission[]};

export class FullOnChain{
  constructor(private readonly rpcUrl:string,readonly chainId:string,private readonly daoContract:string){}

  private async post<T>(path:string,body:unknown):Promise<T>{
    const response=await fetch(`${this.rpcUrl}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    if(!response.ok)throw new Error(`FullOn RPC ${path} returned ${response.status}`);
    return response.json() as Promise<T>;
  }

  async verifyPermissionSignature(account:string,permission:string,message:string,signature:string):Promise<string>{
    const digest=sha256(message);
    const recovered=ecc.recoverHash(signature,digest);
    const row=await this.post<Account>('/v1/chain/get_account',{account_name:account});
    const authority=row.permissions.find(item=>item.perm_name===permission);
    if(!authority)throw new Error(`Permission ${account}@${permission} does not exist`);
    const accepted=authority.required_auth.keys.some(({key})=>{
      if(key===recovered)return true;
      try{return ecc.verifyHash(signature,digest,key);}catch{return false;}
    });
    if(!accepted)throw new Error(`Signature key is not authorized by ${account}@${permission}`);
    return recovered;
  }

  async proposal(proposalId:number):Promise<Record<string,unknown>|null>{
    const result=await this.post<{rows:Array<Record<string,unknown>>}>('/v1/chain/get_table_rows',{
      json:true,code:this.daoContract,scope:this.daoContract,table:'proposals',
      lower_bound:String(proposalId),upper_bound:String(proposalId),limit:1
    });
    const row=result.rows[0];
    return row&&Number(row.proposal_id)===proposalId?row:null;
  }
}
