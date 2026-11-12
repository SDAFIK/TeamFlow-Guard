import { connect } from "node:tls";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";

// Gmail implicit TLS on port 465. Never disable certificate validation or log credentials.
export type GmailMessage = { from:string; to:string; subject:string; text:string; html:string };
export type GmailSender = (message:GmailMessage, appPassword:string)=>Promise<boolean>;
const mailbox=/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export function validMailbox(value:string):boolean { return value.length<=254&&mailbox.test(value)&&!/[\r\n]/.test(value); }
const b64=(value:string)=>Buffer.from(value,"utf8").toString("base64");
const wrap=(value:string)=>b64(value).match(/.{1,76}/g)?.join("\r\n")??"";
export function gmailMime(message:GmailMessage,boundary:string):string {
 if(!validMailbox(message.from)||!validMailbox(message.to)||!/^[a-zA-Z0-9-]+$/.test(boundary)||/[\r\n]/.test(message.subject))throw new Error("Invalid email fields");
 return [
  "From: TeamFlow Guard <"+message.from+">","To: <"+message.to+">","Subject: =?UTF-8?B?"+b64(message.subject)+"?=",
  "Date: "+new Date().toUTCString(),"MIME-Version: 1.0","Content-Type: multipart/alternative; boundary=\""+boundary+"\"","",
  "--"+boundary,"Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64","",wrap(message.text),
  "--"+boundary,"Content-Type: text/html; charset=UTF-8","Content-Transfer-Encoding: base64","",wrap(message.html),"--"+boundary+"--",""
 ].join("\r\n");
}
type Channel={read:()=>Promise<string>;write:(line:string)=>void};
export async function gmailSession(channel:Channel,message:GmailMessage,password:string,boundary:string):Promise<boolean>{
 async function reply(codes:number[]){
  // Parse a bounded multiline SMTP response; do not propagate server text.
  for(let i=0;i<60;i++){
   const line=await channel.read(), match=/^(\d{3})([ -])/.exec(line);
   if(!match||!codes.includes(Number(match[1])))throw new Error("SMTP rejected request");
   if(match[2]===" ")return;
  }
  throw new Error("SMTP response too long");
 }
 async function command(line:string,codes:number[]){channel.write(line+"\r\n");await reply(codes);}
 const mime=gmailMime(message,boundary);
 await reply([220]);
 await command("EHLO teamflow-guard.vercel.app",[250]);
 await command("AUTH LOGIN",[334]);
 await command(b64(message.from),[334]);
 await command(b64(password),[235]);
 await command("MAIL FROM:<"+message.from+">",[250]);
 await command("RCPT TO:<"+message.to+">",[250,251]);
 await command("DATA",[354]);
 await command(mime.replace(/(^|\r\n)\./g,"$1..")+"\r\n.",[250]);
 // Acceptance is already confirmed. QUIT failure must not invalidate it.
 try{channel.write("QUIT\r\n");}catch{}
 return true;
}
export const sendGmailInvitation:GmailSender=async(message,appPassword)=>{
 if(!validMailbox(message.from)||!validMailbox(message.to))return false;
 const socket=connect({host:"smtp.gmail.com",port:465,servername:"smtp.gmail.com",minVersion:"TLSv1.2",rejectUnauthorized:true});
 const reader=createInterface({input:socket,crlfDelay:Infinity});
 const lines=reader[Symbol.asyncIterator]();
 // Keep the error handler registered; close the reader to unblock pending reads.
 socket.on("error",()=>reader.close());
 const timer=setTimeout(()=>{reader.close();socket.destroy();},12_000);
 try {
  await new Promise<void>((resolve,reject)=>{
   socket.once("secureConnect",resolve);
   socket.once("error",reject);
   socket.once("close",()=>reject(new Error("SMTP connection closed")));
  });
  const channel:Channel={read:async()=>{const next=await lines.next();if(next.done)throw new Error("SMTP connection closed");return next.value;},write:line=>{if(socket.destroyed)throw new Error("SMTP connection closed");socket.write(line);}};
  return await gmailSession(channel,message,appPassword,"teamflow-"+randomBytes(16).toString("hex"));
 } catch {return false;}
 finally{clearTimeout(timer);reader.close();socket.destroy();}
};
