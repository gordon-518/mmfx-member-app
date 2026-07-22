import { readFileSync } from "node:fs";
const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(raw.split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const tok = (env.METAAPI_TOKEN||"").replace(/^["']|["']$/g,"").trim();
const region = env.METAAPI_REGION || "london";
const ACC = "b7816e80-138c-41a0-803c-7d96b3a220b6";
const PROV = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const CLIENT = `https://mt-client-api-v1.${region}.agiliumtrade.ai`;
const H = { "auth-token": tok, "content-type":"application/json" };
const sleep = ms => new Promise(r=>setTimeout(r,ms));

// 1) Deploy (idempotent)
let r = await fetch(`${PROV}/users/current/accounts/${ACC}/deploy`, { method:"POST", headers:H });
console.log("deploy:", r.status);

// 2) Poll client account-information until it serves data (broker truly connected)
let ready = false;
for (let i=0;i<20;i++){
  await sleep(10000);
  const ai = await fetch(`${CLIENT}/users/current/accounts/${ACC}/account-information`, { headers:H, signal:AbortSignal.timeout(15000) }).catch(e=>({ok:false,status:'ERR',_e:e.message}));
  if (ai.ok){ const info = await ai.json(); console.log(`[${i}] CLIENT READY balance=${info.balance} equity=${info.equity}`); ready=true; break; }
  else console.log(`[${i}] client not ready:`, ai.status);
}
console.log("READY:", ready, "at", new Date().toISOString());
