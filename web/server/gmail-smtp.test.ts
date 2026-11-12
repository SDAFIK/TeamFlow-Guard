import {expect,it} from "vitest";
import {gmailSession,gmailMime,validMailbox} from "./gmail-smtp";
const msg={from:"sender@gmail.com",to:"teammate@example.com",subject:"TeamFlow Guard invitation",text:"Join private link",html:"<p>Join workspace</p>"};
it("uses a valid MIME message, with encoded body and no raw CRLF from input",()=>{
 const mime=gmailMime(msg,"test-boundary");
 expect(mime).toContain("To: <teammate@example.com>");
 expect(mime).toContain("multipart/alternative");
 expect(mime).toContain(Buffer.from(msg.html).toString("base64"));
 expect(validMailbox("a@example.com\r\nBcc: bad@example.com")).toBe(false);
 expect(()=>gmailMime({...msg,to:"a@example.com\r\nBcc: bad@example.com"},"test-boundary")).toThrow();
});
it("authenticates, addresses exactly one recipient, sends data and awaits acceptance",async()=>{
 const replies=["220 ready","250-smtp.gmail.com","250 AUTH LOGIN","334 user","334 password","235 auth","250 sender","250 recipient","354 data","250 queued"];
 const writes:string[]=[];
 expect(await gmailSession({read:async()=>replies.shift()!,write:l=>writes.push(l)},msg,"fixture-password","test-boundary")).toBe(true);
 expect(writes[0]).toContain("EHLO");
 expect(writes).toContain("RCPT TO:<teammate@example.com>\r\n");
 expect(writes.at(-1)).toBe("QUIT\r\n");
});
it("rejects failed authentication without sending recipient or message",async()=>{
 const replies=["220 ready","250 ready","334 user","334 password","535 denied"];const writes:string[]=[];
 await expect(gmailSession({read:async()=>replies.shift()!,write:l=>writes.push(l)},msg,"fixture-password","test-boundary")).rejects.toThrow("SMTP rejected request");
 expect(writes.some(l=>l.includes("RCPT TO"))).toBe(false);
});
