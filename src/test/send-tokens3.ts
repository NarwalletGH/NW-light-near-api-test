import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const nearAPI = require('near-api-js');
const sha256 = require('js-sha256');

import { getConfig } from './config.js'

//this is required if using a local .env file for private key
//require('dotenv').config();
const util = require('util');


//V2-imports
import {KeyPairEd25519} from "../lib/utils/key-pair.js"
import {serialize,base_decode} from "../lib/utils/serialize.js"
import * as TX from "../lib/transaction.js"
import * as near from "../lib/near-rpc.js"
import BN from 'bn.js';
import {jsonRpc} from "../lib/utils/json-rpc.js"

/**
 * convert nears expressed as a js-number with MAX 4 decimals into a yoctos-string
 * @param n amount in near MAX 4 DECIMALS
 */
export function ntoy(n:number){
  let millionsText = Math.round(n*1e4).toString() // near * 1e4 - round
  let yoctosText = millionsText+"0".repeat(20) //  mul by 1e20 => yoctos = near * 1e(4+20)
  return yoctosText
}

/**
 * returns amount truncated to 4 decimal places
 * @param yoctos amount expressed in yoctos
 */
export function yton(yoctos:string){
  if (yoctos.indexOf(".")!==-1) throw new Error("a yocto string can't have a decimal point: "+yoctos)
  let padded = yoctos.padStart(25,"0") //at least 0.xxx
  let nearsText = padded.slice(0,-24)+"."+padded.slice(-24,-20) //add decimal point. Equivalent to near=yoctos/1e24 and truncate to 4 dec places
  return Number(nearsText)
}

// configure accounts, network, and amount of NEAR to send
const sender = 'lucio.testnet';
const receiver = 'luciotato2.testnet';
const config = getConfig('testnet');
const amountY = ntoy(0.25);

// sets up NEAR connection based on networkId
const provider = new nearAPI.providers.JsonRpcProvider(config.nodeUrl);

// creates keyPair used to sign transaction
const privateKey = "5dXosrrX9edUVWCuRZ2gmYqrFhrssqjmE5RWTVszEPceTdaX9pfHJMJNnbSTRFt3E5qd2NX1fmFZAW4N1TZxRoet";
const keyPair = nearAPI.utils.KeyPairEd25519.fromString(privateKey);

//v2-compare
const keyPair2 = KeyPairEd25519.fromString(privateKey);
if (JSON.stringify(keyPair)!=JSON.stringify(keyPair2)){
  debugger;
  throw Error("mismatch")
}


async function main() {
  console.log('Processing transaction...');

  // gets sender's public key
  const publicKey = keyPair.getPublicKey();

  //v2-compare
  const publicKey2 =  keyPair2.getPublicKey();
  if (JSON.stringify(publicKey)!=JSON.stringify(publicKey2)){
    debugger;
    throw Error("mismatch")
  }

  // gets sender's public key information from NEAR blockchain 
  const accessKey = await provider.query(
    `access_key/${sender}/${publicKey.toString()}`, ''
    );

  // checks to make sure provided key is a full access key
  if(accessKey.permission !== 'FullAccess') {
      return console.log(
        `Account [ ${sender} ] does not have permission to send tokens using key: [ ${publicKey} ]`
        );
    };

  // converts a recent block hash into an array of bytes 
  // this hash was retrieved earlier when creating the accessKey (Line 26)
  // this is required to prove the tx was recently constructed (within 24hrs)
  const recentBlockHash = nearAPI.utils.serialize.base_decode(accessKey.block_hash);

  //v2-compare
  const recentBlockHash2 = base_decode(accessKey.block_hash);
  if (JSON.stringify(recentBlockHash)!=JSON.stringify(recentBlockHash2)){
    debugger;
    throw Error("mismatch")
  }
  
  // each transaction requires a unique number or nonce
  // this is created by taking the current nonce and incrementing it
  const nonce = ++accessKey.nonce;

  // constructs actions that will be passed to the createTransaction method below
  const actions = [nearAPI.transactions.transfer(amountY)];
  console.log("transferring",yton(amountY),"NEARS")

  // create transaction
  const transaction = nearAPI.transactions.createTransaction(
    sender, 
    publicKey, 
    receiver, 
    nonce, 
    actions, 
    recentBlockHash
    );

  // before we can sign the transaction we must perform three steps...
  // 1) serialize the transaction in Borsh
  const serializedTx = nearAPI.utils.serialize.serialize(
    nearAPI.transactions.SCHEMA, 
    transaction
    );
  // 2) hash the serialized transaction using sha256
  const serializedTxHash = new Uint8Array(sha256.sha256.array(serializedTx));
  // 3) create a signature using the hashed transaction
  const signature = keyPair.sign(serializedTxHash);

 //v2-compare
 const actions2 = [TX.transfer(new BN(amountY))];
 const transaction2 = TX.createTransaction(
  sender, 
  publicKey2, 
  receiver, 
  nonce, 
  actions2, 
  recentBlockHash
)
const serializedTx2 = serialize(TX.SCHEMA, transaction2);
 if (JSON.stringify(serializedTx)!=JSON.stringify(serializedTx2)){
  debugger;
  throw Error("mismatch")
}
 const serializedTxHash2 = new Uint8Array(sha256.sha256.array(serializedTx2));
 if (JSON.stringify(serializedTxHash)!=JSON.stringify(serializedTxHash2)){
  debugger;
  throw Error("mismatch")
}
 const signature2 = keyPair2.sign(serializedTxHash2) 
 if (JSON.stringify(signature)!=JSON.stringify(signature2)){
  debugger;
  throw Error("mismatch")
}


  // now we can sign the transaction :)
  const signedTransaction = new nearAPI.transactions.SignedTransaction({
    transaction,
    signature: new nearAPI.transactions.Signature({ 
      keyType: transaction.publicKey.keyType, 
      data: signature.signature 
    })
  });

  // encodes signed transaction to serialized Borsh (required for all transactions)
  const borshEncoded = signedTransaction.encode();
  const payload = Buffer.from(borshEncoded).toString('base64')

 //v2-compare
 const signedTransaction2 = new TX.SignedTransaction({
  transaction:transaction2,
  signature: new TX.Signature({ 
    keyType: transaction.publicKey.keyType, 
    data: signature2.signature 
  })
});
const borshEncoded2 = signedTransaction2.encode();
if (JSON.stringify(borshEncoded)!=JSON.stringify(borshEncoded2)){
  debugger;
  throw Error("mismatch")
}
const payload2 = Buffer.from(borshEncoded2).toString('base64')
  if (JSON.stringify(payload)!=JSON.stringify(payload2)){
  debugger;
  throw Error("mismatch")
}


  // send the transaction!
  try {
    //V2
    const result = await near.broadcast_tx_commit(signedTransaction2) 
    //v2 -low level
    //const result = await jsonRpc('broadcast_tx_commit',[payload2]) 

    // sends transaction to NEAR blockchain via JSON RPC call and records the result
    // const result = await provider.sendJsonRpc(
    //   'broadcast_tx_commit', 
    //   [payload ]
    //   );
    //console results :)
    console.log('Transaction Results: ', util.inspect(result.transaction));
    console.log('--------------------------------------------------------------------------------------------')
    console.log('OPEN LINK BELOW to see transaction in NEAR Explorer!');
    console.log(`${config.explorerUrl}/transactions/${result.transaction.hash}`);
    console.log('--------------------------------------------------------------------------------------------');
  } catch (error) {
    console.log(error);
  };
};

// run the function
main();
