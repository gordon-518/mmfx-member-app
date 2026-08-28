// Builds MMFX-Dupoin-MIB-Deck.pptx from the content in mib-pack/source-markdown.
// Requires pptxgenjs (not a project dependency):
//   npm install pptxgenjs --prefix /tmp/deckbuild
//   NODE_PATH=/tmp/deckbuild/node_modules node mib-pack/build-deck.js
// Edit here and re-run rather than editing the .pptx, so the deck stays reproducible.
const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE";           // 13.3 x 7.5
const W = 13.3, H = 7.5;

const INK="141210", PANEL="1F1B18", PANEL2="272220", OR="FF5A1F",
      CREAM="F7F3EE", MUT="A39A90", DIM="6E645C",
      LIVE="5FB37A", BUILD="E0A33E", SPEC="8A7F76";

const HF="Arial", BF="Calibri";
const sh = () => ({ type:"outer", color:"000000", blur:14, offset:5, angle:90, opacity:0.45 });

function slide(){ const s=p.addSlide(); s.background={color:INK}; return s; }

function title(s, t, sub){
  s.addText(t,{ x:0.7, y:0.5, w:W-1.4, h:0.85, isTextBox:true, margin:0,
    fontFace:HF, fontSize:38, bold:true, color:CREAM, charSpacing:-0.6 });
  if(sub) s.addText(sub,{ x:0.7, y:1.35, w:W-1.4, h:0.45, isTextBox:true, margin:0,
    fontFace:BF, fontSize:15, color:MUT, italic:true });
}
function card(s,x,y,w,h,fill){
  s.addShape(p.ShapeType.roundRect,{ x,y,w,h, fill:{color:fill||PANEL},
    rectRadius:0.09, line:{color:PANEL2,width:1}, shadow:sh() });
}
function chip(s,x,y,label,color){
  s.addShape(p.ShapeType.roundRect,{ x,y,w:0.78,h:0.24, fill:{color:color},
    rectRadius:0.12, line:{type:"none"} });
  s.addText(label,{ x,y,w:0.78,h:0.24, isTextBox:true, margin:0, align:"center",
    fontFace:HF, fontSize:8.5, bold:true, color:INK, valign:"middle" });
}
function num(s,x,y,n){
  s.addShape(p.ShapeType.ellipse,{ x,y,w:0.44,h:0.44, fill:{color:OR}, line:{type:"none"} });
  s.addText(String(n),{ x,y,w:0.44,h:0.44, isTextBox:true, margin:0, align:"center",
    valign:"middle", fontFace:HF, fontSize:15, bold:true, color:INK });
}
function foot(s,t){
  s.addText(t,{ x:0.7, y:H-0.62, w:W-1.4, h:0.3, isTextBox:true, margin:0,
    fontFace:BF, fontSize:10, color:DIM });
}

/* ---------------- 1 · Title ---------------- */
let s = slide();
s.addShape(p.ShapeType.ellipse,{ x:9.6,y:-1.9,w:6.2,h:6.2, fill:{color:PANEL}, line:{type:"none"} });
s.addText("MARKET MAKERS FX",{ x:0.9,y:2.15,w:9,h:0.35, isTextBox:true, margin:0,
  fontFace:HF, fontSize:13, bold:true, color:OR, charSpacing:3 });
s.addText("Master IB Proposal",{ x:0.9,y:2.6,w:10,h:1.1, isTextBox:true, margin:0,
  fontFace:HF, fontSize:52, bold:true, color:CREAM, charSpacing:-1.2 });
s.addText("Infrastructure for the Dupoin IB network — the platform, products and funnel that turn an IB with an audience into an IB with a product.",
  { x:0.9,y:3.85,w:8.4,h:0.95, isTextBox:true, margin:0, fontFace:BF, fontSize:16, color:MUT });
s.addText("Prepared for Dupoin Markets  ·  28 August 2026",{ x:0.9,y:5.05,w:8,h:0.3,
  isTextBox:true, margin:0, fontFace:BF, fontSize:12, color:DIM });
s.addNotes("Frame: we are not asking to be another IB. We are proposing to be the product layer under the whole IB network.");

/* ---------------- 2 · The problem ---------------- */
s = slide();
title(s,"Most IB programmes buy introductions","The volume is in what happens after the account opens.");
card(s,0.7,2.1,5.8,4.2);
s.addText("What an IB gets today",{ x:1.05,y:2.4,w:5.1,h:0.35, isTextBox:true, margin:0,
  fontFace:HF, fontSize:16, bold:true, color:CREAM });
s.addText([
  {text:"A referral link",options:{bullet:true,breakLine:true}},
  {text:"A folder of banners",options:{bullet:true,breakLine:true}},
  {text:"A landing page template",options:{bullet:true,breakLine:true}},
  {text:"Nothing their trader can use tomorrow",options:{bullet:true}},
],{ x:1.05,y:2.95,w:5.1,h:2.0, isTextBox:true, margin:0, fontFace:BF, fontSize:14.5,
  color:MUT, paraSpaceAfter:9 });
s.addText("So the trader opens, trades for a few weeks, and drifts.",
  { x:1.05,y:5.25,w:5.1,h:0.8, isTextBox:true, margin:0, fontFace:BF, fontSize:14,
    italic:true, color:OR });

card(s,6.9,2.1,5.7,4.2,PANEL2);
s.addText("The result",{ x:7.25,y:2.4,w:5,h:0.35, isTextBox:true, margin:0,
  fontFace:HF, fontSize:16, bold:true, color:CREAM });
s.addText("Most IBs\nproduce nothing",{ x:7.25,y:2.95,w:5,h:1.3, isTextBox:true, margin:0,
  fontFace:HF, fontSize:34, bold:true, color:OR, charSpacing:-0.8, lineSpacing:38 });
s.addText("Not because the introduction was bad. Because there was no product behind it — and accounts that go quiet pay nobody. Volume dies because accounts die.",
  { x:7.25,y:4.45,w:5,h:1.5, isTextBox:true, margin:0, fontFace:BF, fontSize:14, color:MUT });
s.addNotes("This is the shared problem. Dupoin already knows it — say it plainly and let them agree before you propose anything.");

/* ---------------- 3 · The volume equation ---------------- */
s = slide();
title(s,"Where volume actually comes from","Three terms. Almost everyone only sells the first.");
const eqx=[0.7,5.0,9.3], eqw=3.6;
const eq=[
  ["Funded accounts","Lead generation","Ads, content, referral traffic. What every IB programme sells.",false],
  ["Lots per account","Product & engagement","Tools that give the trader a reason to place the next trade.",false],
  ["Months alive","Retention","How long the account survives. Nobody sells this — it is the largest term.",true],
];
eq.forEach((e,i)=>{
  card(s,eqx[i],2.2,eqw,3.5,e[3]?PANEL2:PANEL);
  if(e[3]) s.addShape(p.ShapeType.roundRect,{ x:eqx[i],y:2.2,w:eqw,h:3.5, fill:{type:"none"},
    rectRadius:0.09, line:{color:OR,width:2} });
  s.addText(e[1].toUpperCase(),{ x:eqx[i]+0.35,y:2.5,w:eqw-0.7,h:0.28, isTextBox:true, margin:0,
    fontFace:HF, fontSize:9.5, bold:true, color:e[3]?OR:DIM, charSpacing:1.6 });
  s.addText(e[0],{ x:eqx[i]+0.35,y:2.85,w:eqw-0.7,h:0.9, isTextBox:true, margin:0,
    fontFace:HF, fontSize:24, bold:true, color:CREAM, charSpacing:-0.5 });
  s.addText(e[2],{ x:eqx[i]+0.35,y:3.85,w:eqw-0.7,h:1.5, isTextBox:true, margin:0,
    fontFace:BF, fontSize:13.5, color:MUT });
});
[4.42,8.72].forEach(x=> s.addText("×",{ x,y:3.6,w:0.5,h:0.5, isTextBox:true, margin:0,
  align:"center", fontFace:HF, fontSize:22, bold:true, color:DIM }));
foot(s,"MMFX's platform is built for the third term — and paid on the outcome of all three.");
s.addNotes("The whole pitch hangs here. An override is justified because we move retention, not just introductions.");

/* ---------------- 4 · The proposal ---------------- */
s = slide();
title(s,"The proposal","Give every IB under the MIB a complete trading desk — under their own brand.");
card(s,0.7,2.15,7.2,4.15);
s.addText("Their brand. Their domain.\nOur machine underneath.",{ x:1.1,y:2.55,w:6.4,h:1.3,
  isTextBox:true, margin:0, fontFace:HF, fontSize:28, bold:true, color:CREAM,
  charSpacing:-0.7, lineSpacing:34 });
s.addText("The trader signs up on the IB's site, sees the IB's logo, and gets a professional trading desk: indicators on their charts, an AI assistant reading their live account, a research bot, a calendar, filtered news and a foundation course — plus a free trial and a funded-account funnel behind it.",
  { x:1.1,y:4.0,w:6.4,h:2.0, isTextBox:true, margin:0, fontFace:BF, fontSize:14.5, color:MUT });
const kp=[["Cost to the IB","Zero"],["Cost to Dupoin","Zero"],["MMFX is paid","Per lot, on volume"]];
kp.forEach((k,i)=>{
  card(s,8.3,2.15+i*1.42,4.3,1.24,PANEL2);
  s.addText(k[0].toUpperCase(),{ x:8.6,y:2.35+i*1.42,w:3.7,h:0.26, isTextBox:true, margin:0,
    fontFace:HF, fontSize:9, bold:true, color:DIM, charSpacing:1.4 });
  s.addText(k[1],{ x:8.6,y:2.65+i*1.42,w:3.7,h:0.6, isTextBox:true, margin:0,
    fontFace:HF, fontSize:22, bold:true, color:OR, charSpacing:-0.5 });
});
s.addNotes("Emphasise: invisible to the end trader by design. We never compete with their IBs for brand.");

/* ---------------- 5 · What the trader gets ---------------- */
s = slide();
title(s,"What lands on every desk","Fifteen items. Fourteen run with no ongoing human input.");
const tools=[
  ["Indicator suite","10 TradingView indicators + 2 strategies, granted automatically"],
  ["AI Trading Assistant","Read-only live account analysis, leak detection, coaching"],
  ["Fundamental Desk","Macro research bot on gold, emails a written thesis"],
  ["Know Your Style","Trader-archetype quiz — also a top-of-funnel magnet"],
  ["Calendar & news","Releases and sentiment across nineteen instruments"],
  ["Foundation course","Neutral-branded, so a desk is never empty on day one"],
  ["Signup → funded funnel","Verified signup, 7-day trial, region-aware upgrade"],
  ["Lifecycle & analytics","Self-segmenting email, fraud protection, growth dashboard"],
];
tools.forEach((t,i)=>{
  const c=i%2, r=Math.floor(i/2);
  const x=0.7+c*6.15, y=2.15+r*1.08;
  card(s,x,y,5.85,0.95);
  num(s,x+0.28,y+0.26,i+1);
  s.addText(t[0],{ x:x+0.88,y:y+0.14,w:4.8,h:0.3, isTextBox:true, margin:0,
    fontFace:HF, fontSize:13.5, bold:true, color:CREAM });
  s.addText(t[1],{ x:x+0.88,y:y+0.45,w:4.8,h:0.42, isTextBox:true, margin:0,
    fontFace:BF, fontSize:11.5, color:MUT });
});
s.addNotes("Do not read the list. Point at it and say: all of this is live in production today.");

/* ---------------- 6 · Hero — AI assistant ---------------- */
s = slide();
s.addShape(p.ShapeType.ellipse,{ x:-2.4,y:3.4,w:7.4,h:7.4, fill:{color:PANEL}, line:{type:"none"} });
s.addText("THE ONE THAT CHANGES BEHAVIOUR",{ x:0.9,y:1.15,w:8,h:0.3, isTextBox:true, margin:0,
  fontFace:HF, fontSize:11, bold:true, color:OR, charSpacing:2.4 });
s.addText("It tells the trader what their\naccount is actually doing.",{ x:0.9,y:1.65,w:8.6,h:1.7,
  isTextBox:true, margin:0, fontFace:HF, fontSize:36, bold:true, color:CREAM,
  charSpacing:-1, lineSpacing:44 });
s.addText("The AI Trading Assistant connects to the trader's live MT4/MT5 account, imports every trade automatically, and shows them the habits costing them money — in dollars — with a discipline score and a coach that reviews their decisions against goals they set themselves.",
  { x:0.9,y:3.6,w:7.5,h:1.7, isTextBox:true, margin:0, fontFace:BF, fontSize:15, color:MUT });
card(s,9.0,1.65,3.6,4.4,PANEL2);
s.addText("READ-ONLY",{ x:9.35,y:2.0,w:3,h:0.3, isTextBox:true, margin:0,
  fontFace:HF, fontSize:11, bold:true, color:LIVE, charSpacing:2 });
s.addText([
  {text:"Cannot place a trade",options:{bullet:true,breakLine:true}},
  {text:"Cannot withdraw funds",options:{bullet:true,breakLine:true}},
  {text:"Password is never stored",options:{bullet:true,breakLine:true}},
  {text:"Analyses only — never advises",options:{bullet:true}},
],{ x:9.35,y:2.5,w:2.95,h:2.2, isTextBox:true, margin:0, fontFace:BF, fontSize:13,
  color:CREAM, paraSpaceAfter:11 });
s.addText("Lead with this in every conversation. It is the first question a compliance team asks.",
  { x:9.35,y:4.9,w:2.95,h:0.9, isTextBox:true, margin:0, fontFace:BF, fontSize:11,
    italic:true, color:MUT });
s.addNotes("Retention argument in one product. A trader being coached logs in tomorrow; a trader with a link does not.");

/* ---------------- 7 · TradingView moat ---------------- */
s = slide();
title(s,"The part competitors cannot copy","Indicator access is granted and revoked programmatically. No codes, no tickets.");
const steps=[
  ["Trader enters\ntheir username","One field on their own desk. Nothing to email, nothing to wait for."],
  ["Access is granted\nautomatically","Twelve invite-only scripts appear on their TradingView charts within minutes."],
  ["Access is revoked\nautomatically","The moment a member lapses. No manual audit, no leakage, no awkward conversation."],
];
steps.forEach((t,i)=>{
  const x=0.7+i*4.16;
  card(s,x,2.3,3.86,3.3);
  num(s,x+0.35,2.62,i+1);
  s.addText(t[0],{ x:x+0.35,y:3.25,w:3.16,h:0.95, isTextBox:true, margin:0,
    fontFace:HF, fontSize:18, bold:true, color:CREAM, charSpacing:-0.4, lineSpacing:23 });
  s.addText(t[1],{ x:x+0.35,y:4.3,w:3.16,h:1.1, isTextBox:true, margin:0,
    fontFace:BF, fontSize:13, color:MUT });
  if(i<2) s.addText("→",{ x:x+3.86,y:3.75,w:0.3,h:0.4, isTextBox:true, margin:0,
    align:"center", fontFace:HF, fontSize:17, color:OR });
});
foot(s,"Running in production today. Self-healing, with no human in the loop.");
s.addNotes("This is the operational proof point. It shows the platform is real engineering, not a template.");

/* ---------------- 8 · Product boundary ---------------- */
s = slide();
title(s,"Who supplies what","Written to be over-clear. Every ambiguity here becomes a dispute later.");
const cols=[
  ["MMFX PROVIDES",OR,["The full tool suite","The foundation course","Signup-to-funded funnel","Lifecycle email & analytics","Branding & hosting per desk","Platform support"]],
  ["THE IB PROVIDES",CREAM,["Their audience & traffic","Their brand and domain","Their market and language","First-line trader support","Local compliance","Optionally, their own content"]],
  ["NOT INCLUDED",SPEC,["MM Mentorship (19 lessons)","The eBook library","Daily XAU/USD analysis","The MMFX signals desk","Live classes","Team MM VIP channel"]],
];
cols.forEach((c,i)=>{
  const x=0.7+i*4.16;
  card(s,x,2.2,3.86,3.9, i===2?INK:PANEL);
  if(i===2) s.addShape(p.ShapeType.roundRect,{ x,y:2.2,w:3.86,h:3.9, fill:{type:"none"},
    rectRadius:0.09, line:{color:PANEL2,width:1,dashType:"dash"} });
  s.addText(c[0],{ x:x+0.35,y:2.5,w:3.16,h:0.3, isTextBox:true, margin:0,
    fontFace:HF, fontSize:10.5, bold:true, color:c[1], charSpacing:1.8 });
  s.addText(c[2].map((t,j)=>({ text:t, options:{ bullet:true, breakLine:j<c[2].length-1 }})),
    { x:x+0.35,y:2.95,w:3.16,h:2.9, isTextBox:true, margin:0, fontFace:BF, fontSize:13,
      color: i===2?DIM:MUT, paraSpaceAfter:10 });
});
foot(s,"An IB who uploads nothing still ships a real product — the retention engine is the AI assistant, not the size of a content library.");
s.addNotes("Be firm on column three. Naming it now prevents an expectation you have to manage later.");

/* ---------------- 9 · It already exists ---------------- */
s = slide();
title(s,"This is not a specification","The desk is live in production today, serving MMFX's own members.");
const reg=[
  ["LIVE",LIVE,"Running today","Indicators and auto-grant · AI Trading Assistant · Fundamental Desk · Know Your Style · calendar · news · dashboard · trial and upgrade funnel · lifecycle email · anti-abuse · analytics · admin · broker export parser"],
  ["BUILD",BUILD,"Phase 1","Multi-tenancy · branding layer · per-tenant funnel config · feature toggles · upload-and-publish studio · tenant-scoped admin · content policy · the foundation course"],
  ["SPEC",SPEC,"No date offered","MT5 expert advisor — specified on paper only, and deliberately not part of this proposal"],
];
reg.forEach((r,i)=>{
  const y=2.2+i*1.42;
  card(s,0.7,y,11.9,1.24, i===2?INK:PANEL);
  chip(s,1.05,y+0.24,r[0],r[1]);
  s.addText(r[2],{ x:2.05,y:y+0.2,w:2.3,h:0.32, isTextBox:true, margin:0,
    fontFace:HF, fontSize:13.5, bold:true, color:CREAM });
  s.addText(r[3],{ x:2.05,y:y+0.55,w:10.1,h:0.6, isTextBox:true, margin:0,
    fontFace:BF, fontSize:12, color: i===2?DIM:MUT });
});
foot(s,"Phase 1 makes a working single-brand product serve many brands. That is engineering, not invention.");
s.addNotes("Offer a live demo on the spot. The credibility gap in these meetings is always 'does it exist'.");

/* ---------------- 10 · Tiers ---------------- */
s = slide();
title(s,"Three tiers","Tier 1 is the default and should be near-frictionless for an IB to accept.");
const tiers=[
  ["TIER 1","Equip","Free to the IB",["The full white-label desk","Foundation course","Funnel, email, analytics","Upload studio for their content"],true],
  ["TIER 2","Equip + Capture","Small per-IB build",["Everything in Tier 1","Their own landing pages","Conversion tracking","Lead dashboard"],false],
  ["TIER 3","Full agency","Spend funded by IB or broker",["Everything in Tier 2","Meta campaign build & management","Full creative production","Geo tiering and refresh cadence"],false],
];
tiers.forEach((t,i)=>{
  const x=0.7+i*4.16;
  card(s,x,2.15,3.86,4.05, t[4]?PANEL2:PANEL);
  if(t[4]) s.addShape(p.ShapeType.roundRect,{ x,y:2.15,w:3.86,h:4.05, fill:{type:"none"},
    rectRadius:0.09, line:{color:OR,width:2} });
  s.addText(t[0],{ x:x+0.35,y:2.42,w:3.16,h:0.28, isTextBox:true, margin:0,
    fontFace:HF, fontSize:9.5, bold:true, color:t[4]?OR:DIM, charSpacing:1.8 });
  s.addText(t[1],{ x:x+0.35,y:2.72,w:3.16,h:0.5, isTextBox:true, margin:0,
    fontFace:HF, fontSize:24, bold:true, color:CREAM, charSpacing:-0.5 });
  s.addText(t[2],{ x:x+0.35,y:3.25,w:3.16,h:0.32, isTextBox:true, margin:0,
    fontFace:BF, fontSize:12, italic:true, color:t[4]?OR:MUT });
  s.addText(t[3].map((v,j)=>({ text:v, options:{ bullet:true, breakLine:j<t[3].length-1 }})),
    { x:x+0.35,y:3.75,w:3.16,h:2.2, isTextBox:true, margin:0, fontFace:BF, fontSize:12.5,
      color:MUT, paraSpaceAfter:9 });
});
s.addNotes("Tier 3 is where the model bleeds if spend is misplaced. Enter it deliberately, after Tier 1 proves out.");

/* ---------------- 11 · Commercial ask ---------------- */
s = slide();
title(s,"The commercial ask","Four things to settle, and one to write down before either side has a reason to argue.");
const ask=[
  ["Override","A per-lot override on all volume generated by IBs under the MMFX MIB. Rate set by Dupoin; tiered by service level if preferred."],
  ["Term","Long enough to justify the platform investment. MMFX builds before it earns."],
  ["Exclusivity","Open in both directions — worth agreeing rather than assuming."],
];
ask.forEach((a,i)=>{
  const y=2.15+i*1.16;
  card(s,0.7,y,7.2,1.0);
  s.addText(a[0],{ x:1.05,y:y+0.16,w:1.9,h:0.32, isTextBox:true, margin:0,
    fontFace:HF, fontSize:14, bold:true, color:OR });
  s.addText(a[1],{ x:2.95,y:y+0.16,w:4.6,h:0.7, isTextBox:true, margin:0,
    fontFace:BF, fontSize:12.5, color:MUT });
});
card(s,8.3,2.15,4.3,3.48,PANEL2);
s.addText("Trader portability",{ x:8.65,y:2.45,w:3.6,h:0.35, isTextBox:true, margin:0,
  fontFace:HF, fontSize:17, bold:true, color:CREAM });
s.addText("If the arrangement ends, what happens to the traders MMFX acquired, onboarded and retained?\n\nMMFX is not asking for a particular outcome. Only that the outcome is written down now — not at the moment when goodwill is lowest.",
  { x:8.65,y:2.9,w:3.6,h:2.5, isTextBox:true, margin:0, fontFace:BF, fontSize:12.5, color:MUT });
s.addNotes("Portability is the clause everyone skips and everyone later regrets. Raise it yourself — it reads as good faith.");

/* ---------------- 12 · Three conditions ---------------- */
s = slide();
title(s,"Three conditions","Each one, unmet, breaks the model in a specific and predictable way.");
const cond=[
  ["Sub-IB volume reporting","Which trader belongs to which IB, and how many lots they trade. Without it MMFX cannot attribute, optimise, invoice or prove anything."],
  ["Ad spend not funded by MMFX","The override is paid after volume. Advertising is paid weeks before it. Where MMFX runs media, the IB or the broker funds it."],
  ["Minimum volume & dormancy","Every live desk costs money from day one. A desk producing nothing is a permanent cost centre — for both parties."],
];
cond.forEach((c,i)=>{
  const x=0.7+i*4.16;
  card(s,x,2.25,3.86,3.5);
  num(s,x+0.35,2.6,i+1);
  s.addText(c[0],{ x:x+0.35,y:3.22,w:3.16,h:0.85, isTextBox:true, margin:0,
    fontFace:HF, fontSize:17, bold:true, color:CREAM, charSpacing:-0.4, lineSpacing:22 });
  s.addText(c[1],{ x:x+0.35,y:4.15,w:3.16,h:1.4, isTextBox:true, margin:0,
    fontFace:BF, fontSize:12.5, color:MUT });
});
foot(s,"Condition 1 gates everything. Phase 1 is a substantial investment made ahead of revenue — but not against an unverifiable outcome.");
s.addNotes("Be direct here. These are not asks, they are the conditions under which the arrangement functions.");

/* ---------------- 13 · The data ask ---------------- */
s = slide();
title(s,"What condition 1 actually requires","Two fields you do not currently send. The rest, MMFX already ingests.");
const rows=[
  ["Sub-IB identifier","Attribute each trader to the IB who introduced them","NEW"],
  ["Trading account number","Match to the platform member","HAVE"],
  ["Account open date","Time-to-fund and cohort behaviour","HAVE"],
  ["Deposits and balance","Verify funding, detect at-risk accounts","HAVE"],
  ["Lots traded, per period","What MMFX is paid on, and every optimisation decision","NEW"],
  ["Last trade date / status","Measures survival — the core claim","PARTIAL"],
];
s.addText("FIELD",{ x:1.05,y:2.12,w:3.2,h:0.25, isTextBox:true, margin:0, fontFace:HF,
  fontSize:9, bold:true, color:DIM, charSpacing:1.6 });
s.addText("WHY IT IS NEEDED",{ x:4.55,y:2.12,w:5.6,h:0.25, isTextBox:true, margin:0, fontFace:HF,
  fontSize:9, bold:true, color:DIM, charSpacing:1.6 });
rows.forEach((r,i)=>{
  const y=2.48+i*0.63;
  const hot = r[2]==="NEW";
  card(s,0.7,y,11.9,0.55, hot?PANEL2:PANEL);
  s.addText(r[0],{ x:1.05,y:y+0.13,w:3.3,h:0.3, isTextBox:true, margin:0,
    fontFace:HF, fontSize:12.5, bold:true, color:hot?OR:CREAM });
  s.addText(r[1],{ x:4.55,y:y+0.14,w:6.3,h:0.3, isTextBox:true, margin:0,
    fontFace:BF, fontSize:12, color:MUT });
  chip(s,11.6,y+0.15,r[2], hot?OR:(r[2]==="HAVE"?LIVE:BUILD));
});
foot(s,"MMFX already parses your referred-account export and matches accounts to members. Also requested: your baseline survival and activity figures.");
s.addNotes("Reframe: this is two columns on an export we already ingest, not a data project.");

/* ---------------- 14 · Phasing ---------------- */
s = slide();
title(s,"How this runs","Terms settled before platform money is spent. The pilot builds the real product.");
const ph=[
  ["PHASE 0","Agreement","Terms and the three conditions settled. Condition 1 confirmed in writing.","Now"],
  ["PHASE 1","Build","The existing product made multi-tenant: branding, funnel config, upload studio, toggles.","Ahead of revenue"],
  ["PHASE 2","Pilot","Three IBs minimum. Three genuinely branded desks. Real acquisition, real volume.","60–90 days"],
  ["PHASE 3","Scale","Onboarding against the volume threshold. Attribution reporting and IB portal follow.","On evidence"],
];
ph.forEach((t,i)=>{
  const x=0.7+i*3.09;
  card(s,x,2.3,2.82,3.5);
  s.addText(t[0],{ x:x+0.3,y:2.6,w:2.2,h:0.26, isTextBox:true, margin:0,
    fontFace:HF, fontSize:9, bold:true, color:OR, charSpacing:1.6 });
  s.addText(t[1],{ x:x+0.3,y:2.9,w:2.2,h:0.5, isTextBox:true, margin:0,
    fontFace:HF, fontSize:22, bold:true, color:CREAM, charSpacing:-0.5 });
  s.addText(t[2],{ x:x+0.3,y:3.5,w:2.22,h:1.6, isTextBox:true, margin:0,
    fontFace:BF, fontSize:12, color:MUT });
  s.addText(t[3],{ x:x+0.3,y:5.25,w:2.22,h:0.3, isTextBox:true, margin:0,
    fontFace:BF, fontSize:11.5, italic:true, color:DIM });
  if(i<3) s.addText("→",{ x:x+2.82,y:3.85,w:0.27,h:0.35, isTextBox:true, margin:0,
    align:"center", fontFace:HF, fontSize:15, color:OR });
});
s.addNotes("A co-branded pilot would have tested a proxy. Three real desks test the product — which is why Phase 1 comes first.");

/* ---------------- 15 · The pilot ---------------- */
s = slide();
title(s,"What the pilot is judged on","Measured against Dupoin's own baseline. Failure is a valid and useful outcome.");
const met=[
  ["Funded accounts\nper IB","Does the funnel convert"],
  ["Lots per funded\naccount, monthly","Does the desk increase activity"],
  ["90-day account\nsurvival","The core claim — vs your baseline"],
  ["Trial-to-funded\nconversion","Funnel efficiency"],
  ["Cost per funded\naccount","Whether Tier 3 can pay for itself"],
  ["Support load\nper tenant","Whether the model scales"],
];
met.forEach((m,i)=>{
  const c=i%3, r=Math.floor(i/3);
  const x=0.7+c*4.16, y=2.25+r*1.95;
  const hot = i===2;
  card(s,x,y,3.86,1.75, hot?PANEL2:PANEL);
  if(hot) s.addShape(p.ShapeType.roundRect,{ x,y,w:3.86,h:1.75, fill:{type:"none"},
    rectRadius:0.09, line:{color:OR,width:2} });
  s.addText(m[0],{ x:x+0.35,y:y+0.28,w:3.16,h:0.85, isTextBox:true, margin:0,
    fontFace:HF, fontSize:17, bold:true, color:hot?OR:CREAM, charSpacing:-0.4, lineSpacing:21 });
  s.addText(m[1],{ x:x+0.35,y:y+1.16,w:3.16,h:0.4, isTextBox:true, margin:0,
    fontFace:BF, fontSize:12, color:MUT });
});
foot(s,"Success: survival and activity measurably above baseline, at a cost per tenant that leaves the override profitable at scale.");
s.addNotes("Offering a falsifiable test is the strongest credibility move available. Say the failure sentence out loud.");

/* ---------------- 16 · Close ---------------- */
s = slide();
s.addShape(p.ShapeType.ellipse,{ x:8.9,y:2.4,w:7.6,h:7.6, fill:{color:PANEL}, line:{type:"none"} });
s.addText("THE ASK",{ x:0.9,y:1.5,w:8,h:0.3, isTextBox:true, margin:0,
  fontFace:HF, fontSize:11, bold:true, color:OR, charSpacing:2.4 });
s.addText("A per-lot override,\nand two columns in an export.",{ x:0.9,y:2.0,w:9.2,h:1.8,
  isTextBox:true, margin:0, fontFace:HF, fontSize:36, bold:true, color:CREAM,
  charSpacing:-1, lineSpacing:44 });
s.addText("MMFX builds the platform ahead of any revenue. Dupoin confirms sub-IB volume reporting and supplies a baseline. Three IBs, three branded desks, ninety days — and a measured answer either way.",
  { x:0.9,y:4.0,w:7.4,h:1.6, isTextBox:true, margin:0, fontFace:BF, fontSize:15.5, color:MUT });
s.addText("Next step: confirm the data feed, and MMFX starts Phase 1.",
  { x:0.9,y:5.7,w:7.4,h:0.4, isTextBox:true, margin:0, fontFace:BF, fontSize:14,
    italic:true, color:OR });
s.addNotes("Close on the smallest possible yes: not the override rate, just the data confirmation.");

p.writeFile({ fileName: "mib-pack/MMFX-Dupoin-MIB-Deck.pptx" })
 .then(f => console.log("wrote", f));
