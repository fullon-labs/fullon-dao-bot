import {createAppAuth} from '@octokit/auth-app';

type GraphResult<T>={data?:T;errors?:Array<{message:string}>};

export class GitHubDiscussions{
  constructor(private readonly options:{appId:string;installationId:number;privateKey:string;owner:string;repo:string;categoryId:string}){}

  private async token():Promise<string>{
    const auth=createAppAuth({appId:this.options.appId,privateKey:this.options.privateKey,installationId:this.options.installationId});
    const result=await auth({type:'installation'});
    return result.token;
  }

  private async graphql<T>(query:string,variables:Record<string,unknown>):Promise<T>{
    const response=await fetch('https://api.github.com/graphql',{method:'POST',headers:{authorization:`Bearer ${await this.token()}`,'content-type':'application/json','user-agent':'fullon-dao-bot'},body:JSON.stringify({query,variables})});
    const result=await response.json() as GraphResult<T>;
    if(!response.ok||result.errors?.length)throw new Error(result.errors?.map(e=>e.message).join('; ')||`GitHub returned ${response.status}`);
    return result.data as T;
  }

  async repositoryId():Promise<string>{
    const result=await this.graphql<{repository:{id:string}}>('query($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){id}}',{owner:this.options.owner,repo:this.options.repo});
    return result.repository.id;
  }

  async createDiscussion(title:string,body:string){
    const repositoryId=await this.repositoryId();
    const result=await this.graphql<{createDiscussion:{discussion:{id:string,number:number,url:string}}}>(
      'mutation($repositoryId:ID!,$categoryId:ID!,$title:String!,$body:String!){createDiscussion(input:{repositoryId:$repositoryId,categoryId:$categoryId,title:$title,body:$body}){discussion{id number url}}}',
      {repositoryId,categoryId:this.options.categoryId,title,body}
    );
    return result.createDiscussion.discussion;
  }

  async addComment(discussionId:string,body:string){
    await this.graphql('mutation($discussionId:ID!,$body:String!){addDiscussionComment(input:{discussionId:$discussionId,body:$body}){comment{id}}}',{discussionId,body});
  }
}
