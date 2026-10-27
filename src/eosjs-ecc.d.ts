declare module 'eosjs-ecc' {
  const ecc:{
    recoverHash(signature:string,hash:string,encoding?:string):string;
    verifyHash(signature:string,hash:string,publicKey:string,encoding?:string):boolean;
  };
  export default ecc;
}
