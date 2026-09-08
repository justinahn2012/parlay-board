/* Parlay board backend.
 *
 * Auth notes, because two things here are load-bearing:
 *
 * 1. Credentials never enter the board blob. GET /api/state returns the whole
 *    shared document to every client, so anything stored there is public to the
 *    league. Users, hashes and sessions live under separate Durable Object keys
 *    that no endpoint ever returns.
 *
 * 2. Clients write the entire document, so a session alone would not stop one
 *    member overwriting another's pick. Every write is diffed against the
 *    stored state and rejected unless the change is one that member is allowed
 *    to make. Without that, logging in would only be decoration.
 *
 * Passwords are PBKDF2-SHA256, 150k iterations, per-user salt. Sessions are
 * 256-bit random tokens in an HttpOnly cookie. The first account created
 * becomes moderator.
 */

/* Password stretching happens in the BROWSER, not here. The Workers free plan
   allows 10ms of CPU per request and PBKDF2 at a sane iteration count costs
   ~24ms, so doing it server-side gets the request killed with Error 1102. The
   client derives a key with PBKDF2 (no CPU limit in a browser) and sends that;
   the server stores a single SHA-256 of it, which costs well under a
   millisecond. The stretching still protects the stored data, it just runs
   where there is budget for it. */
/* A season plus playoffs is about five months, and a 60 day session logged
   everyone out somewhere around week 10. */
/* The whole page, inlined so the repo is two files with no folders. */
const HTML = "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<style>\n@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');\n:root{\n  --board:#212734;--board-deep:#181D28;--line:rgba(232,228,217,.13);\n  --chalk:#E8E4D9;--dim:#8D94A4;--ticket:#FBF7EE;--tedge:#EDE6D6;\n  --ink:#1B1814;--inkdim:#7A7266;--gold:#DFA829;--teal:#57A9A4;--red:#C4483C;\n  /* Ember band. The light end is darker than the mockup was: cream captions\n     only reach 2.8:1 against #D2662C, short of the 4.5:1 body-text threshold,\n     and the caption sits over exactly that end of the gradient. */\n  --ember-1:#3B1B4D;--ember-2:#8A2D42;--ember-3:#9C4018;\n  --ember-ink:#FFE9C9;--ember-dim:rgba(255,233,201,.88);\n  --sans:'Archivo','Helvetica Neue',Arial,sans-serif;\n  --mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;\n}\n*{box-sizing:border-box}\nbody{margin:0;background:var(--board);color:var(--chalk);font-family:var(--sans);\n  font-size:15px;line-height:1.45;-webkit-font-smoothing:antialiased;padding:0 0 70px}\n.wrap{max-width:680px;margin:0 auto;padding:0 16px}\nbutton{font-family:inherit;color:inherit;cursor:pointer}\n:focus-visible{outline:2px solid var(--gold);outline-offset:2px;border-radius:3px}\n.num{font-family:var(--mono);font-variant-numeric:tabular-nums;letter-spacing:-.02em}\n.hide{display:none!important}\n\n.top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:20px 0 14px}\n.wk{display:flex;align-items:center;gap:4px}\n.wk h1{margin:0;font-size:19px;font-weight:600;letter-spacing:-.01em;min-width:88px;text-align:center}\n.arw{background:none;border:1px solid var(--line);border-radius:50%;width:28px;height:28px;\n  font-size:14px;color:var(--dim);line-height:1;padding:0}\n.arw:disabled{opacity:.25;cursor:default}\n.tabs{display:flex;gap:3px;background:var(--board-deep);border-radius:20px;padding:3px}\n.tab{background:none;border:0;border-radius:16px;padding:6px 13px;font-size:12.5px;color:var(--dim)}\n.tab[aria-selected=\"true\"]{background:var(--chalk);color:var(--board);font-weight:500}\n.status{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dim);padding-bottom:12px}\n.dot{width:6px;height:6px;border-radius:50%;background:var(--dim)}\n.dot.on{background:var(--teal);box-shadow:0 0 0 3px rgba(87,169,164,.18)}\n\n.alert{background:rgba(196,72,60,.14);border:1px solid rgba(196,72,60,.5);border-radius:6px;\n  padding:12px 14px;margin-bottom:14px;font-size:13.5px}\n.alert b{color:var(--red);font-weight:600}\n\n.ticket{position:relative;background:var(--ticket);color:var(--ink);border-radius:4px;\n  padding:20px 20px 0;box-shadow:0 18px 38px -20px rgba(0,0,0,.75)}\n.thead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;\n  padding-bottom:12px;border-bottom:1px solid var(--tedge)}\n.ttl{font-size:16px;font-weight:700;letter-spacing:-.01em}\n.ttl span{display:block;font-size:12px;font-weight:400;color:var(--inkdim)}\n.stake{display:flex;align-items:center;gap:1px;font-size:13px;color:var(--inkdim)}\n.stake input{width:60px;background:#F2ECDE;border:1px solid var(--tedge);border-radius:3px;\n  padding:5px;font-family:var(--mono);font-size:14px;color:var(--ink);text-align:right}\n.legs{list-style:none;margin:0;padding:4px 0}\n.legs li{display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px dotted #E2DACA}\n.legs li:last-child{border-bottom:0}\n.lg{flex:1;min-width:0}\n.lgp{display:block;font-size:14px;font-weight:600;letter-spacing:-.01em}\n.lgw{display:block;font-size:12px;color:var(--inkdim);margin-top:2px}\n.lgo{font-family:var(--mono);font-size:13.5px;color:var(--ink)}\n.mark{font-family:var(--mono);font-size:12px;width:18px;text-align:center}\n.mark.w{color:#3F7D4E}.mark.l{color:var(--red)}.mark.p{color:var(--inkdim)}\n.empty{padding:14px 0 16px;font-size:13.5px;color:var(--inkdim)}\n.tear{position:relative;margin:0 -20px;border-top:1px dashed #D6CCB6;height:0}\n.tear::before,.tear::after{content:\"\";position:absolute;top:-9px;width:18px;height:18px;\n  border-radius:50%;background:var(--board)}\n.tear::before{left:-9px}.tear::after{right:-9px}\n/* Ember band. The ticket stays paper and the colour sits under the payout\n   alone, so the one number everyone looks at is the only thing shouting.\n   Full-bleed to the ticket edge, rounded to match its bottom corners -- the\n   ticket cannot use overflow:hidden or it would clip the tear notches. */\n.pay{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;\n  margin:0 -20px;padding:16px 20px 20px;border-radius:0 0 4px 4px;\n  background:linear-gradient(100deg,var(--ember-1) 0%,var(--ember-2) 52%,var(--ember-3) 100%)}\n.fig{font-family:var(--mono);font-size:31px;font-weight:500;line-height:1;\n  letter-spacing:-.03em;color:var(--ember-ink)}\n.cap{font-size:11.5px;color:var(--ember-dim);margin-top:5px}\n.pay .r{text-align:right}.pay .r .fig{font-size:21px;color:#fff}\n\n/* Blackout lives in one persistent token rather than a button per leg, so a\n   destructive action isn't repeated four times down the ticket at 24px tall. */\n#boBar{margin-top:14px}\n.tok{display:flex;align-items:center;gap:12px;width:100%;text-align:left;\n  background:var(--board-deep);border:1px solid var(--line);border-radius:8px;padding:13px 14px;\n  min-height:52px;font-size:13.5px;color:var(--chalk)}\n.tok .tk{width:26px;height:26px;border-radius:50%;flex:none;display:grid;place-items:center;\n  font-size:13px;background:rgba(196,72,60,.18);color:var(--red);border:1px solid rgba(196,72,60,.5)}\n.tok .tt{flex:1;min-width:0;line-height:1.35}\n.tok .tt small{display:block;color:var(--dim);font-size:11.5px}\n.tok.live{border-color:rgba(196,72,60,.45)}\n.tok.spent .tk{background:#2E3547;color:var(--dim);border-color:var(--line)}\n.tok .go2{flex:none;background:var(--chalk);color:var(--board);border:0;border-radius:6px;\n  padding:9px 13px;font-size:12.5px;font-weight:600;min-height:38px}\n.tok .lnk{flex:none;background:none;border:1px solid var(--line);border-radius:6px;\n  padding:9px 12px;font-size:12px;color:var(--dim);min-height:38px}\n\n.sheet{position:fixed;inset:0;background:rgba(16,20,28,.72);z-index:30;display:flex;\n  align-items:flex-end;justify-content:center}\n.sheet-in{width:100%;max-width:520px;background:var(--board);border-radius:14px 14px 0 0;\n  padding:6px 16px calc(20px + env(safe-area-inset-bottom));max-height:86vh;overflow-y:auto;\n  border-top:1px solid var(--line)}\n@media(min-width:560px){.sheet{align-items:center}.sheet-in{border-radius:14px;padding-bottom:20px}}\n.sheet-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;\n  padding:12px 0 10px;position:sticky;top:0;background:var(--board)}\n.sheet-hd h2{margin:0;font-size:16px;font-weight:600}\n.x{background:none;border:0;font-size:26px;line-height:1;color:var(--dim);padding:4px 10px;min-height:44px}\n.who{margin-left:auto;display:flex;align-items:center;gap:7px;font-size:11px;color:var(--dim)}\n.badge{background:rgba(223,168,41,.16);color:var(--gold);border-radius:10px;padding:1px 7px;font-size:10px}\n.linkish{background:none;border:0;color:var(--dim);font-size:11.5px;text-decoration:underline;\n  padding:4px 2px;font-family:var(--sans)}\n.linkish:hover{color:var(--chalk)}\n.gi .linkish{display:block;width:100%;text-align:center;margin-top:10px;font-size:13px}\n.fld{display:block;margin-bottom:10px}\n.fld span{display:block;font-size:11.5px;color:var(--dim);margin-bottom:5px}\n.fld input{width:100%;background:var(--board-deep);border:1px solid var(--line);border-radius:8px;\n  padding:13px 14px;font-size:16px;color:var(--chalk);min-height:48px}\n.opt2{display:block;width:100%;text-align:left;background:var(--board-deep);\n  border:1px solid var(--line);border-radius:8px;padding:15px 16px;margin-bottom:9px;min-height:64px;\n  font-family:var(--sans);color:var(--chalk);cursor:pointer}\n.opt2 .o1{display:block;font-size:15.5px;font-weight:600;letter-spacing:-.01em}\n.opt2 .o2{display:block;font-size:12px;color:var(--dim);margin-top:3px;line-height:1.4}\n.opt2.ok:not(:disabled){border-color:rgba(223,168,41,.5)}\n.opt2.ok:not(:disabled) .o1{color:var(--gold)}\n.opt2.ok:not(:disabled):hover{background:rgba(223,168,41,.1)}\n.opt2.bad:not(:disabled){border-color:rgba(196,72,60,.5)}\n.opt2.bad:not(:disabled) .o1{color:#E2857A}\n.opt2.bad:not(:disabled):hover{background:rgba(196,72,60,.1)}\n.opt2:disabled{opacity:.42;cursor:not-allowed}\n.pick.dead{opacity:.55;border-style:dashed;border-color:rgba(196,72,60,.55);background:rgba(196,72,60,.07)}\n.pick.dead .p1{text-decoration:line-through;text-decoration-color:rgba(196,72,60,.85);color:var(--dim)}\n.pick.dead .p2{color:#C4483C;font-size:9px}\n.pick.taken{opacity:.45}\n.pick.noline{opacity:.4;border-style:dashed}\n.pick.noline .p2{color:var(--gold)}\n.game.shutgame{opacity:.6}\n.game.shutgame .tn{text-decoration:line-through;text-decoration-color:rgba(232,228,217,.3)}\n.sheet p.note{font-size:12.5px;color:var(--dim);line-height:1.6;margin:2px 0 14px}\n.big{display:block;width:100%;text-align:center;background:var(--gold);color:#241D08;border:0;\n  border-radius:8px;padding:15px;font-size:15px;font-weight:600;min-height:52px;\n  text-decoration:none;margin-bottom:9px;box-sizing:border-box}\n.ghost{display:block;width:100%;text-align:center;background:none;border:1px solid var(--line);\n  border-radius:8px;padding:14px;font-size:14px;color:var(--dim);min-height:50px}\n.warn{background:rgba(196,72,60,.12);border:1px solid rgba(196,72,60,.4);border-radius:8px;\n  padding:12px 13px;font-size:13px;margin-bottom:12px;line-height:1.5}\n\n.feed{padding:14px 0 0}\n.fitem.shut{border-left-color:rgba(232,228,217,.3)}\n.fitem{font-size:12.5px;color:var(--dim);padding:6px 0 6px 12px;border-left:2px solid rgba(196,72,60,.45);\n  display:flex;align-items:center;justify-content:space-between;gap:10px}\n.fitem b{color:var(--chalk);font-weight:500}\n.undo{background:none;border:1px solid var(--line);border-radius:4px;padding:3px 8px;\n  font-size:11px;color:var(--dim);white-space:nowrap;flex:none}\n.undo:hover{color:var(--chalk);border-color:rgba(232,228,217,.34)}\n.dline{padding:9px 0 2px;font-size:11.5px;color:var(--dim)}\n.dline.shut{color:var(--gold)}\n.roster{display:flex;flex-wrap:wrap;gap:7px;padding:16px 0 2px}\n.chip{display:flex;align-items:center;gap:6px;padding:5px 11px 5px 6px;border-radius:20px;\n  background:var(--board-deep);border:1px solid var(--line);font-size:12.5px;color:var(--dim)}\n.chip.in{color:var(--chalk);border-color:rgba(223,168,41,.4)}\n.chip.hit{border-color:rgba(196,72,60,.5);color:#E2A49D}\n.pip{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;\n  font-size:9.5px;font-weight:700;background:#2E3547;color:var(--dim)}\n.chip.in .pip{background:var(--gold);color:#241D08}\n.chip.hit .pip{background:var(--red);color:#fff}\n\n.bar{display:flex;align-items:center;justify-content:space-between;gap:10px;\n  padding:26px 0 8px;border-bottom:1px solid var(--line);flex-wrap:wrap}\n.bar h2{margin:0;font-size:13px;font-weight:600}\n.tools{display:flex;gap:5px;flex-wrap:wrap}\n.tbtn{background:none;border:1px solid var(--line);border-radius:20px;padding:5px 10px;\n  font-size:11.5px;color:var(--dim)}\n.tbtn:hover{color:var(--chalk);border-color:rgba(232,228,217,.32)}\n.tbtn[aria-pressed=\"true\"]{background:var(--chalk);color:var(--board);border-color:var(--chalk)}\n.cols{display:grid;grid-template-columns:1fr 72px 72px;gap:8px;padding:10px 0 2px;font-size:11px;color:var(--dim)}\n.cols div:not(:first-child){text-align:center}\n.day{padding:18px 0 4px;font-size:11.5px;color:var(--dim);font-weight:500}\n.game{border-top:1px solid var(--line);padding:9px 0 11px}\n.gm{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--dim);padding-bottom:5px}\n.claim{color:var(--gold)}\n.lsrc{font-size:10px}\n.warnsrc{color:var(--gold)}\n.row{display:grid;grid-template-columns:1fr 72px 72px;gap:8px;align-items:center;padding:3px 0}\n.team{display:flex;align-items:center;gap:9px;min-width:0}\n.cbar{width:3px;height:20px;border-radius:2px;flex:none;margin-left:1px}\n/* The crest sits on a faint light chip: a handful of club marks are largely\n   black and would otherwise dissolve into the board. */\n.crest{width:24px;height:24px;border-radius:50%;flex:none;display:grid;place-items:center;\n  background:rgba(232,228,217,.09)}\n.crest img{width:17px;height:17px;object-fit:contain;display:block}\n.ab{font-family:var(--mono);font-size:12px;color:var(--dim);width:30px;flex:none}\n.tn{font-size:14.5px;font-weight:500;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.pick{background:var(--board-deep);border:1px solid var(--line);border-radius:5px;padding:7px 3px 6px;\n  text-align:center;line-height:1.15;transition:border-color .12s,background .12s}\n.p1{font-family:var(--mono);font-size:14px;font-variant-numeric:tabular-nums}\n.p2{font-family:var(--mono);font-size:10px;color:var(--dim);margin-top:2px}\n.pick:hover:not(:disabled){border-color:rgba(232,228,217,.34)}\n.pick[aria-pressed=\"true\"]{background:var(--gold);border-color:var(--gold);color:#241D08}\n.pick[aria-pressed=\"true\"] .p2{color:rgba(36,29,8,.62)}\n.pick[aria-pressed=\"true\"].oth{background:transparent;border-color:var(--gold);color:var(--gold)}\n.pick[aria-pressed=\"true\"].oth .p2{color:rgba(223,168,41,.7)}\n.pick:disabled{opacity:.3;cursor:not-allowed}\n@media (prefers-reduced-motion:no-preference){\n  .pick[aria-pressed=\"true\"]{animation:lk .22s ease-out}@keyframes lk{from{transform:scale(.93)}to{transform:scale(1)}}}\n.edit{width:100%;background:#2A3141;border:1px solid var(--line);border-radius:5px;padding:7px 2px;\n  font-family:var(--mono);font-size:13px;color:var(--chalk);text-align:center}\n.sc{display:flex;gap:6px;align-items:center;justify-content:flex-end}\n.sc input{width:100%;background:#2A3141;border:1px solid var(--line);border-radius:5px;padding:6px 2px;\n  font-family:var(--mono);font-size:13px;color:var(--chalk);text-align:center}\n\n.chartbox{background:var(--board-deep);border:1px solid var(--line);border-radius:6px;padding:16px 14px 22px;margin-bottom:20px}\n.chartbox h3{margin:0 0 2px;font-size:13px;font-weight:600}\n.chartbox p{margin:0 0 14px;font-size:11.5px;color:var(--dim)}\nsvg.chart{width:100%;height:160px;display:block}\n.subtabs{display:flex;gap:3px;background:var(--board-deep);border-radius:20px;padding:3px;margin:4px 0 18px;width:fit-content}\n.stab{background:none;border:0;border-radius:16px;padding:6px 14px;font-size:12.5px;color:var(--dim)}\n.stab[aria-selected=\"true\"]{background:var(--chalk);color:var(--board);font-weight:500}\n.rule{font-size:11.5px;color:var(--dim);line-height:1.6;margin:14px 0 0;max-width:64ch}\ntd.up{color:var(--teal)}td.dn{color:var(--red)}\n.tbl{width:100%;border-collapse:collapse;font-size:13.5px}\n.tbl th{text-align:right;font-size:11px;color:var(--dim);font-weight:500;padding:0 0 8px;border-bottom:1px solid var(--line)}\n.tbl th:first-child,.tbl td:first-child{text-align:left}\n.tbl td{padding:11px 0;border-bottom:1px solid var(--line);text-align:right}\n.tbl tr[data-p]{cursor:pointer}\n.tbl tr.sel td{background:rgba(223,168,41,.09)}\n.nm{display:flex;align-items:center;gap:8px}\n.rk{font-family:var(--mono);font-size:11px;color:var(--dim);width:14px}\n.bars{display:inline-flex;gap:2px;vertical-align:middle}\n.seg{width:5px;height:14px;border-radius:1px;background:#2E3547;display:inline-block}\n.seg.w{background:var(--teal)}.seg.l{background:var(--red)}.seg.p{background:#4A5163}\n.drill{margin-top:20px;background:var(--board-deep);border:1px solid var(--line);border-radius:6px;padding:16px}\n.drill h3{margin:0 0 12px;font-size:14px;font-weight:600}\n.dl{display:grid;grid-template-columns:44px 1fr auto;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:13px;align-items:center}\n.dl:last-child{border-bottom:0}\n.dw{font-family:var(--mono);font-size:11px;color:var(--dim)}\n.dsub{font-size:11.5px;color:var(--dim)}\n.res{font-family:var(--mono);font-size:11.5px}\n.res.w{color:var(--teal)}.res.l{color:var(--red)}.res.p{color:var(--dim)}\n@media(min-width:820px){.season{display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start}\n  .drill{margin-top:0;position:sticky;top:16px}}\n\n.foot{padding:26px 0 0;margin-top:26px;border-top:1px solid var(--line);font-size:11.5px;color:var(--dim);line-height:1.65}\n.foot b{color:var(--chalk);font-weight:500}\n.build{font-family:var(--mono);font-size:10px;color:#5C6373}\n.paste textarea{width:100%;min-height:110px;background:var(--board-deep);border:1px solid var(--line);\n  border-radius:6px;padding:11px;color:var(--chalk);font-family:var(--mono);font-size:13px;margin:10px 0}\n.go{background:var(--gold);border:0;border-radius:5px;padding:9px 16px;font-size:13px;font-weight:600;color:#241D08}\n\n.gate{position:fixed;inset:0;background:rgba(24,29,40,.97);display:grid;place-items:center;padding:24px;z-index:20}\n.gi{width:100%;max-width:330px}\n.gi h1{font-size:19px;font-weight:600;margin:0 0 4px}\n.gi p{font-size:13.5px;color:var(--dim);margin:0 0 16px}\n.gi input{width:100%;background:var(--board);border:1px solid rgba(232,228,217,.24);border-radius:5px;\n  padding:12px 13px;font-size:16px;color:var(--chalk);margin-bottom:9px}\n.gi button{width:100%;background:var(--gold);border:0;border-radius:5px;padding:12px;font-size:14.5px;font-weight:600;color:#241D08}\n</style>\n\n<div class=\"wrap\">\n  <div class=\"top\">\n    <div class=\"wk\">\n      <button class=\"arw\" id=\"prev\" aria-label=\"Previous week\">&lsaquo;</button>\n      <h1 id=\"wkLbl\">Week 1</h1>\n      <button class=\"arw\" id=\"next\" aria-label=\"Next week\">&rsaquo;</button>\n    </div>\n    <div class=\"tabs\" role=\"tablist\">\n      <button class=\"tab\" id=\"tabWeek\" role=\"tab\" aria-selected=\"true\">Slip</button>\n      <button class=\"tab\" id=\"tabSeason\" role=\"tab\" aria-selected=\"false\">Season</button>\n    </div>\n  </div>\n  <div class=\"status\"><span class=\"dot\" id=\"dot\"></span><span id=\"stxt\">loading</span><span class=\"who\" id=\"whoami\"></span></div>\n\n  <div id=\"viewWeek\">\n    <div class=\"alert hide\" id=\"alert\"></div>\n    <div class=\"ticket\">\n      <div class=\"thead\">\n        <div class=\"ttl\">The Slip<span id=\"legCount\">no legs yet</span></div>\n        <label class=\"stake\">$<input id=\"stake\" class=\"num\" type=\"number\" min=\"0\" step=\"5\" value=\"50\" aria-label=\"Stake\"></label>\n      </div>\n      <ul class=\"legs\" id=\"legs\"></ul>\n      <div class=\"empty hide\" id=\"emptySlip\">Nobody has picked yet. Take a game below and you're leg one.</div>\n      <div class=\"tear\"></div>\n      <div class=\"pay\">\n        <div><div class=\"fig\" id=\"payout\">$0</div><div class=\"cap\" id=\"payCap\">pays out if every leg hits</div></div>\n        <div class=\"r\"><div class=\"fig\" id=\"amer\">&mdash;</div><div class=\"cap\" id=\"prob\">combined price</div></div>\n      </div>\n    </div>\n    <div id=\"boBar\"></div>\n    <div class=\"feed\" id=\"feed\"></div>\n    <div class=\"roster\" id=\"roster\"></div>\n    <div class=\"bar\">\n      <h2>The slate</h2>\n      <div class=\"tools\">\n        <button class=\"tbtn\" id=\"refresh\">Refresh</button>\n        <button class=\"tbtn\" id=\"editBtn\" aria-pressed=\"false\">Edit lines</button>\n        <button class=\"tbtn\" id=\"resBtn\" aria-pressed=\"false\">Fix a score</button>\n        <button class=\"tbtn\" id=\"lockBtn\" aria-pressed=\"false\">Lock week</button>\n        <button class=\"tbtn\" id=\"playersBtn\">Players</button>\n        <button class=\"tbtn\" id=\"nameWkBtn\">Name week</button>\n        <button class=\"tbtn\" id=\"exportBtn\">Back up</button>\n        <button class=\"tbtn\" id=\"diagBtn\">Diagnostics</button>\n      </div>\n    </div>\n    <div class=\"dline\" id=\"dline\"></div>\n    <div class=\"cols\" id=\"cols\"><div>Team</div><div>Spread</div><div>Money line</div></div>\n    <div id=\"board\"></div>\n  </div>\n\n  <div id=\"viewSeason\" class=\"hide\">\n    <div class=\"subtabs\">\n      <button class=\"stab\" id=\"mStraight\" aria-selected=\"true\">Straight up</button>\n      <button class=\"stab\" id=\"mRisk\" aria-selected=\"false\">Risk adjusted</button>\n    </div>\n    <div class=\"chartbox\">\n      <h3 id=\"chartTitle\">Hit rate, week by week</h3>\n      <p id=\"chartSub\">Share of picks that came in, across everyone</p>\n      <svg class=\"chart\" id=\"chart\" viewBox=\"0 0 340 160\"></svg>\n    </div>\n    <div class=\"season\">\n      <div>\n        <table class=\"tbl\">\n          <thead id=\"thead\"></thead>\n          <tbody id=\"stand\"></tbody>\n        </table>\n        <p class=\"rule\" id=\"ruleNote\"></p>\n      </div>\n      <div class=\"drill\" id=\"drill\"></div>\n    </div>\n  </div>\n\n  <div class=\"foot\">\n    <span class=\"build\">build 2026-09-08k</span><br><b>Scores arrive on their own</b> from ESPN whenever anyone opens the board, and only once a game is marked final. Fix a score is there for when the feed is down.<br><br><b>Rules.</b> One game each &mdash; claiming a game locks it for everyone else. Everyone also gets one blackout a week, and it is a move against the board rather than against a person: kill any selection on the slate, whether someone has taken it or not. It stays struck through for the rest of the week &mdash; tap it and you'll see who killed it &mdash; and nobody can take it after that. If it was somebody's leg, theirs is void and they pick again. Only that exact selection dies, so the other side and the other bet type on the same game stay live. Change your mind as often as you like &mdash; picks swap freely and a blackout can be taken back &mdash; right up until midnight Pacific at the end of the day before the main slate &mdash; the day carrying the most games, normally Sunday. Anything kicking off earlier in the week closes on its own day instead, so a Thursday game is off the board once Thursday arrives even though the rest stays open. Blackouts grade too &mdash; killing a leg that would have lost counts as a win in your column.\n  </div>\n</div>\n\n<div class=\"sheet hide\" id=\"sheet\">\n  <div class=\"sheet-in\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"shTitle\">\n    <div class=\"sheet-hd\"><h2 id=\"shTitle\">Use your blackout</h2>\n      <button class=\"x\" id=\"shClose\" aria-label=\"Close\">&times;</button></div>\n    <div id=\"shBody\"></div>\n  </div>\n</div>\n\n<div class=\"gate\" id=\"gate\">\n  <div class=\"gi\">\n    <h1 id=\"gateTitle\">Sign in</h1>\n    <p id=\"gateSub\">Your account keeps your picks yours. Nobody else can change them.</p>\n    <input id=\"nameIn\" placeholder=\"Name\" autocomplete=\"username\" maxlength=\"14\">\n    <input id=\"pwIn\" placeholder=\"Password\" type=\"password\" autocomplete=\"current-password\">\n    <input id=\"phoneIn\" class=\"hide\" placeholder=\"Mobile number\" type=\"tel\" autocomplete=\"tel\">\n    <div class=\"alert hide\" id=\"nameWarn\"></div>\n    <button id=\"join\">Sign in</button>\n    <button id=\"swapMode\" class=\"linkish\">New here? Create an account</button>\n  </div>\n</div>\n\n</div>\n</div>\n\n<script>\n(function(){\n  var ver=0;\n  window.storage={\n    async get(key,shared){\n      if(!shared)return null;\n      var r=await fetch('/api/state',{cache:'no-store'});\n      if(!r.ok)throw new Error('load '+r.status);\n      var j=await r.json(); ver=j.version;\n      return j.value==null?null:{key:key,value:j.value,shared:true};\n    },\n    async set(key,value,shared){\n      if(!shared)return {key:key,value:value,shared:false};\n      var r=await fetch('/api/state',{method:'PUT',headers:{'content-type':'application/json'},\n        body:JSON.stringify({version:ver,value:value})});\n      if(r.status===409){var c=await r.json();ver=c.version;\n        var e=new Error('conflict');e.conflict=true;throw e}\n      if(r.status===403){var d=await r.json();ver=d.version;\n        var f=new Error(d.error||'Not allowed');f.denied=true;throw f}\n      if(r.status===401){var g=new Error('Session expired, sign in again');g.denied=true;throw g}\n      if(!r.ok)throw new Error('save '+r.status);\n      var j=await r.json(); ver=j.version;\n      return {key:key,value:value,shared:true};\n    }\n  };\n})();\n</script>\n<script>\nconst KEY='parlay-2026-v2';\nconst C={NE:'#0B2265',SEA:'#69BE28',SF:'#AA0000',LAR:'#003594',CHI:'#0B162A',CAR:'#0085CA',TB:'#D50A0A',\nCIN:'#FB4F14',BAL:'#241773',IND:'#002C5F',BUF:'#00338D',HOU:'#03202F',NO:'#D3BC8D',DET:'#0076B6',\nNYJ:'#125740',TEN:'#4B92DB',ATL:'#A71930',PIT:'#FFB612',CLE:'#FF3C00',JAX:'#006778',ARI:'#97233F',\nLAC:'#0080C6',GB:'#FFB612',MIN:'#4F2683',MIA:'#008E97',LV:'#A5ACAF',WAS:'#5A1414',PHI:'#004C54',\nDAL:'#003594',NYG:'#0B2265',DEN:'#FB4F14',KC:'#E31837'};\n/* Secondary colours, used as a hairline ring around the strip. Thirteen\n   primaries sit within 1.8:1 of the board and simply vanish -- the Patriots and\n   Giants navy measures 1.02:1 against it. The ring is the team's own second\n   colour, chosen so at least one of the pair always reads. Five clubs wear two\n   dark colours, so those take their official white or silver instead. */\nconst C2={NE:'#B0B7BC',SEA:'#002244',SF:'#B3995D',LAR:'#FFA300',CHI:'#FFFFFF',CAR:'#BFC0BF',\nTB:'#FF7900',CIN:'#FFFFFF',BAL:'#9E7C0C',IND:'#A2AAAD',BUF:'#FFFFFF',HOU:'#FFFFFF',\nNO:'#101820',DET:'#B0B7BC',NYJ:'#FFFFFF',TEN:'#0C2340',ATL:'#A5ACAF',PIT:'#101820',\nCLE:'#FFFFFF',JAX:'#D7A22A',ARI:'#FFB612',LAC:'#FFC20E',GB:'#203731',MIN:'#FFC62F',\nMIA:'#FC4C02',LV:'#101820',WAS:'#FFB612',PHI:'#A5ACAF',DAL:'#869397',NYG:'#FFFFFF',\nDEN:'#002244',KC:'#FFB81C'};\nconst TEAMS={NE:'Patriots',SEA:'Seahawks',SF:'49ers',LAR:'Rams',CHI:'Bears',CAR:'Panthers',TB:'Buccaneers',\nCIN:'Bengals',BAL:'Ravens',IND:'Colts',BUF:'Bills',HOU:'Texans',NO:'Saints',DET:'Lions',NYJ:'Jets',\nTEN:'Titans',ATL:'Falcons',PIT:'Steelers',CLE:'Browns',JAX:'Jaguars',ARI:'Cardinals',LAC:'Chargers',\nGB:'Packers',MIN:'Vikings',MIA:'Dolphins',LV:'Raiders',WAS:'Commanders',PHI:'Eagles',DAL:'Cowboys',\nNYG:'Giants',DEN:'Broncos',KC:'Chiefs'};\n\n/* Real opening numbers, Covers/Kalshi, 7 Sep 2026. These are a starting point,\n   not gospel -- lines move. `Refresh` pulls live money lines and `Edit lines`\n   overrides anything by hand; the board marks which games have never been\n   confirmed against a live source. */\n/* Live Polymarket prices, 8 Sep 2026, converted to American odds. Cents are\n   implied probability, so p>=0.5 -> -100p/(1-p) and p<0.5 -> +100(1-p)/p, for\n   the money line and the spread juice alike. These are a snapshot, not the\n   opening number -- this game opened at Rams -2.5 and has since moved to -3.5.\n   Refresh re-derives the same way from live prices. */\nlet me=null,edit=false,resMode=false,view='week',mode='straight',sel=null,mem={},joinConfirmed=null,identityBusy=false,role='member';\nconst isMod=()=>role==='mod';\nlet S={week:1,roster:[],weeks:{}};\n\nconst blank=()=>({stake:50,locked:false,games:[],lines:{},picks:{},bo:[],res:{}});\nfunction W(n){n=n||S.week;if(!S.weeks[n])S.weeks[n]=blank();return S.weeks[n]}\nconst games=n=>W(n).games;\nconst G=(id,n)=>games(n).find(g=>g.id===id);\n\nasync function sget(k,sh){try{if(window.storage)return await window.storage.get(k,sh)}catch(e){}\n  return mem[k+sh]!==undefined?{value:mem[k+sh]}:null}\nasync function sset(k,v,sh){mem[k+sh]=v;\n  if(!window.storage)return;\n  return await window.storage.set(k,v,sh);}\nasync function pull(){const r=await sget(KEY,true);\n  /* Which week you are LOOKING at is a per-device view, not shared state.\n     Letting the merge restore it means one person changing week drags\n     everyone else's board along on the next poll. */\n  const viewing=S.week;\n  if(r&&r.value){try{const p=JSON.parse(r.value);S={...S,...p,roster:p.roster||[],weeks:p.weeks||{}}}catch(e){}}\n  S.week=viewing||1;\n  normalizeState();\n  return S}\nasync function push(fn){\n  for(var i=0;i<5;i++){\n    await pull(); fn(S);\n    var out=Object.assign({},S); delete out.week;   // week is a local view\n    try{ await sset(KEY,JSON.stringify(out),true); render(); return }\n    catch(e){\n      if(e&&e.denied){ await pull(); render(); status(e.message); return }\n      if(!e||!e.conflict){ render(); status('could not save, check your connection'); return }\n      await new Promise(function(r){setTimeout(r,120*(i+1))});\n    }\n  }\n  render(); status('too many people saving at once, try again');\n}\n\nconst dec=a=>a>0?1+a/100:1+100/Math.abs(a);\nconst am=d=>d>=2?Math.round((d-1)*100):Math.round(-100/(d-1));\nconst sgn=n=>(n===null||n===undefined||n==='')?'\\u2014':((n>0?'+':'')+n);\n/* Everything below builds HTML by concatenation, and names, week labels and\n   team names all come from people or from an upstream feed. Escape at the\n   point of insertion: a member who calls themselves \"<img onerror=...>\" must\n   not be able to run script in the moderator's browser. */\n/* A member can create a schedule-only week, so a logo URL is untrusted input.\n   Only ESPN's own CDN over https is allowed to become an <img src>; anything\n   else is dropped and the colour strip stands in. */\nfunction safeLogo(u){\n  const v=String(u||'');\n  return /^https:\\/\\/[a-z0-9.-]*espncdn\\.com\\/[^\"'<>\\s]*$/i.test(v)?v:'';\n}\nconst esc=v=>String(v==null?'':v).replace(/[&<>\"']/g,c=>\n  ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nconst spr=n=>{if(n===null||n===undefined||n==='')return '\\u2014';\n  const v=Number(n);if(!isFinite(v))return '\\u2014';\n  return (v>0?'+':'')+(Number.isInteger(v)?v:v.toFixed(1))};\n/* Picks lock at local midnight starting the day of the week's earliest kickoff. */\n/* Picks lock at midnight Pacific starting the day of the week's first game \u2014 so\n   everyone gets through the end of the day before, and it's the same instant for\n   all of them regardless of where they open the page. Only the calendar date\n   matters; kickoff times play no part. The Pacific offset is resolved through\n   Intl rather than hardcoded, so the PDT/PST switch in November takes care of\n   itself. Old saves held a full ISO timestamp, so fall back to its date part. */\nconst LOCK_TZ='America/Los_Angeles';\nfunction tzOffsetMin(t,tz){\n  const f=new Intl.DateTimeFormat('en-US',{timeZone:tz,hour12:false,year:'numeric',\n    month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});\n  const p={};f.formatToParts(new Date(t)).forEach(x=>{p[x.type]=x.value});\n  const asUTC=Date.UTC(+p.year,+p.month-1,+p.day,p.hour==='24'?0:+p.hour,+p.minute,+p.second);\n  return (asUTC-t)/60000;\n}\nfunction zonedMidnight(s){\n  const p=s.split('-').map(Number),wall=Date.UTC(p[0],p[1]-1,p[2],0,0,0);\n  try{\n    let t=wall;\n    for(let i=0;i<2;i++)t=wall-tzOffsetMin(t,LOCK_TZ)*60000;\n    return new Date(t);\n  }catch(e){return new Date(wall+8*36e5)}  // no Intl timezone support: assume PST\n}\nfunction gameDate(g){return g.d||(g.ko?String(g.ko).slice(0,10):null)}\nfunction allDates(n){\n  return games(n).map(gameDate).filter(d=>/^\\d{4}-\\d{2}-\\d{2}$/.test(d||''));\n}\nfunction firstDate(n){const d=allDates(n);return d.length?d.reduce((a,b)=>a<=b?a:b):null}\n/* The deadline hangs off the main slate day -- the date carrying the most\n   games, normally Sunday -- not the first game of the week. Picks are made for\n   the Sunday card, so an early Thursday kickoff should not close the whole\n   board three days early. Counting games rather than naming Sunday means a\n   Saturday-heavy December week moves the deadline by itself. */\nfunction slateDate(n){\n  const d=allDates(n);if(!d.length)return null;\n  const count={};d.forEach(x=>{count[x]=(count[x]||0)+1});\n  return Object.keys(count).sort(function(a,b){\n    return count[b]-count[a] || (a<b?-1:1);      // most games, then earliest\n  })[0];\n}\nfunction deadline(n){const s=slateDate(n);if(!s)return null;\n  const d=zonedMidnight(s);return isNaN(d)?null:d}\nfunction pastDue(n){const d=deadline(n);return !!d&&Date.now()>=d.getTime()}\nfunction isLocked(n){return W(n).locked||pastDue(n)}\n/* A game closes on its own day, whatever the week deadline says, so anything\n   kicking off before the main slate cannot still be picked after it has run.\n   Date-only means this closes at midnight rather than at kickoff -- earlier\n   than strictly needed, but never later. */\nfunction gameOpen(g,n){\n  const d=gameDate(g);\n  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(d||''))return true;\n  return Date.now()<zonedMidnight(d).getTime();\n}\nfunction countdown(ms){\n  if(ms<=0)return 'now';\n  const m=Math.floor(ms/60000),d=Math.floor(m/1440),h=Math.floor(m%1440/60),mm=m%60;\n  if(d)return d+'d '+h+'h';\n  if(h)return h+'h '+mm+'m';\n  return mm+'m';\n}\nfunction deadlineNote(n){\n  const d=deadline(n);\n  if(!d)return W(n).locked?'Locked by hand. No dates on this slate, so there is no automatic deadline.'\n    :'No dates on this slate yet, so nothing locks automatically. Add dates, or use Lock early.';\n  const fmt={weekday:'long',month:'short',day:'numeric'};\n  const main=zonedMidnight(slateDate(n)).toLocaleDateString(undefined,fmt);\n  const eve=new Date(d.getTime()-864e5).toLocaleDateString(undefined,fmt);\n  const early=games(n).filter(g=>gameDate(g)&&gameDate(g)<slateDate(n));\n  const shut=early.filter(g=>!gameOpen(g,n)).length;\n  const tail=early.length\n    ? ' '+early.length+' game'+(early.length===1?'':'s')+' before then close on their own day'+\n      (shut?', '+shut+' already gone.':'.')\n    : '';\n  const onPT=d.getHours()===0&&d.getMinutes()===0;\n  const local=onPT?'':', which is '+d.toLocaleString(undefined,\n    {weekday:'short',hour:'numeric',minute:'2-digit'})+' where you are';\n  if(pastDue(n))return 'Picks locked at midnight Pacific'+local+'. Main slate was '+main+'.';\n  if(W(n).locked)return 'Locked early by hand. Otherwise it would have run to midnight Pacific after '+eve+'.';\n  return 'Picks lock at midnight Pacific when '+eve+' ends'+local+', '+\n    countdown(d.getTime()-Date.now())+' from now.'+tail;\n}\n/* One place a price can live: week.lines[gameId], written only by a live\n   refresh or by hand. There is deliberately no baseline on the game itself.\n   The old design carried a shipped price under every game, so a fetch failure\n   silently revealed an invented number rather than admitting it had none --\n   which is how one wrong line survived three rounds of fixes. */\nconst FLAT={as:null,ao:null,am:null,hs:null,ho:null,hm:null};\nfunction lineSrc(g,n){\n  const o=(W(n).lines||{})[g.id];\n  return (o&&o.src)||'none';\n}\nfunction ln(g,n){\n  const o=(W(n).lines||{})[g.id];\n  const m=Object.assign({},FLAT,o||{});\n  /* Number(null) is 0 and isFinite(0) is true, so a null must be rejected\n     explicitly or an absent price reads as a legitimate zero.\n     Markets are priced independently: a feed that carries spreads but no money\n     lines should leave the spread usable rather than blanking the game. */\n  const real=v=>v!==null&&v!==undefined&&v!==''&&isFinite(Number(v));\n  m.hasSpread=['as','hs'].every(k=>real(m[k]));\n  m.hasMl=['am','hm'].every(k=>real(m[k]));\n  m.priced=m.hasSpread||m.hasMl;\n  return m;\n}\nconst isPriced=(g,n)=>ln(g,n).priced;\nconst hasMarket=(g,t,n)=>{const l=ln(g,n);return t==='ml'?l.hasMl:l.hasSpread};\nfunction price(g,s,t,n){const l=ln(g,n);return t==='ml'?(s==='a'?l.am:l.hm):(s==='a'?l.ao:l.ho)}\nfunction label(p,n){const g=G(p.g,n);if(!g)return 'a removed game';const t=p.s==='a'?g.a:g.h;\n  return p.t==='ml'?esc(t[1])+' to win':esc(t[1])+' '+spr(p.sp)}\n\nfunction grade(p,wk){\n  const r=(W(wk).res||{})[p.g];if(!r||r.a==null||r.h==null)return null;\n  const mine=p.s==='a'?r.a:r.h,other=p.s==='a'?r.h:r.a;\n  if(p.t==='ml')return mine>other?'w':mine<other?'l':'p';\n  const m=mine+p.sp-other;return m>0?'w':m<0?'l':'p';\n}\nconst flip=g=>g==='w'?'l':g==='l'?'w':g;\n\n/* Risk scoring. A pick is a 1-unit bet at the price taken: a win returns the\n   price, a loss costs the unit, a push returns nothing. Probability comes from\n   the price, not the spread, and is de-vigged against the other side so the two\n   sum to 1 instead of ~1.05. A blackout is the inverse bet on the leg it kills:\n   if that leg had de-vigged probability p, killing it succeeds at (1-p). */\nfunction imp(a){return a>0?100/(a+100):Math.abs(a)/(Math.abs(a)+100)}\nfunction fairP(p){\n  const a=imp(p.pr),b=imp(p.op==null?-110:p.op);\n  return (a+b)>0?a/(a+b):.5;\n}\nfunction unitsPick(p,g){\n  if(g==='p'||!g)return 0;\n  if(g==='l')return -1;\n  return p.pr>0?p.pr/100:100/Math.abs(p.pr);\n}\nconst BO_CAP=25;\nfunction unitsBO(b,g){\n  if(g==='p'||!g)return 0;\n  if(g==='w')return -1;               // the leg it killed would have hit\n  const p=Math.min(Math.max(fairP(b),.001),.999);\n  return Math.min(1/(1-p)-1,BO_CAP);  // capped so one absurd price can't own the season\n}\nconst u2=n=>(n>0?'+':n<0?'\\u2212':'')+Math.abs(n).toFixed(2);\n\nfunction season(){\n  const out={};\n  const add=n=>{if(!out[n])out[n]={n:n,pw:0,pl:0,bw:0,bl:0,u:0,up:0,ub:0,psum:0,pn:0,log:[]};return out[n]};\n  S.roster.forEach(r=>add(r.n));\n  Object.keys(S.weeks).map(Number).sort((a,b)=>a-b).forEach(wk=>{\n    const w=S.weeks[wk];\n    Object.keys(w.picks||{}).forEach(n=>{\n      const p=w.picks[n],o=add(n),g=grade(p,wk);if(!g)return;\n      if(g==='w')o.pw++;else if(g==='l')o.pl++;\n      const u=unitsPick(p,g);o.up+=u;o.u+=u;\n      if(g!=='p'){o.psum+=fairP(p);o.pn++}\n      o.log.push({wk:wk,kind:'pick',txt:label(p,wk),r:g,u:u,\n        sub:'your leg at '+sgn(p.pr)+', '+(fairP(p)*100).toFixed(0)+'% to hit'});\n    });\n    (w.bo||[]).forEach(b=>{\n      const o=add(b.by),g=grade(b,wk);if(!g)return;const f=flip(g);\n      if(f==='w')o.bw++;else if(f==='l')o.bl++;\n      const u=unitsBO(b,g);o.ub+=u;o.u+=u;\n      o.log.push({wk:wk,kind:'bo',txt:'Killed '+label(b,wk),r:f,u:u,\n        sub:b.on+\"'s leg, \"+(fairP(b)*100).toFixed(0)+'% to hit, '+\n          (g==='w'?'and it did':g==='l'?'and it did not':'push')});\n    });\n  });\n  return Object.keys(out).map(k=>{const o=out[k];\n    const tw=o.pw+o.bw,tl=o.pl+o.bl;o.pts=tw;o.pct=(tw+tl)?tw/(tw+tl)*100:null;\n    o.avgP=o.pn?o.psum/o.pn*100:null;o.n=o.n;\n    o.log.sort((a,b)=>b.wk-a.wk);return o});\n}\n\n/* A half-written save, an older schema, or a bug anywhere upstream should cost\n   the corrupt rows and nothing else. Coerce shapes before anything reads them\n   so a bad byte can never leave the whole league staring at a blank board. */\nfunction normalizeState(){\n  if(!S||typeof S!=='object')return;\n  if(!Array.isArray(S.roster))S.roster=[];\n  S.roster=S.roster.filter(r=>r&&typeof r==='object'&&typeof r.n==='string'&&r.n.length);\n  if(!S.weeks||typeof S.weeks!=='object')S.weeks={};\n  Object.keys(S.weeks).forEach(function(k){\n    let w=S.weeks[k];\n    if(!w||typeof w!=='object'){S.weeks[k]=blank();return}\n    if(!Array.isArray(w.games))w.games=[];\n    w.games=w.games.filter(g=>g&&g.id&&Array.isArray(g.a)&&g.a.length>1&&Array.isArray(g.h)&&g.h.length>1);\n    if(!w.lines||typeof w.lines!=='object')w.lines={};\n    Object.keys(w.lines).forEach(id=>{const L=w.lines[id];\n      if(!L||typeof L!=='object'||Array.isArray(L))delete w.lines[id]});\n    if(!w.picks||typeof w.picks!=='object')w.picks={};\n    Object.keys(w.picks).forEach(n=>{const pk=w.picks[n];\n      if(!pk||typeof pk!=='object'||!pk.g||(pk.s!=='a'&&pk.s!=='h')||(pk.t!=='ml'&&pk.t!=='spread'))\n        delete w.picks[n]});\n    if(!Array.isArray(w.bo))w.bo=[];\n    w.bo=w.bo.filter(b=>b&&typeof b==='object'&&b.by&&b.g&&\n      (b.s==='a'||b.s==='h')&&(b.t==='ml'||b.t==='spread'));\n    if(!w.res||typeof w.res!=='object')w.res={};\n    Object.keys(w.res).forEach(id=>{const r=w.res[id];\n      if(!r||typeof r!=='object'||Array.isArray(r))delete w.res[id]});\n    if(w.voided!==undefined&&!Array.isArray(w.voided))delete w.voided;\n    if(typeof w.stake!=='number'||!isFinite(w.stake))w.stake=50;\n  });\n  if(typeof S.week!=='number'||!isFinite(S.week)||S.week<1)S.week=1;\n}\n\nfunction render(){\n  normalizeState();\n  document.getElementById('wkLbl').textContent=String(W().label||('Week '+S.week));\n  document.getElementById('prev').disabled=S.week<=1;\n  document.getElementById('next').disabled=S.week>=MAXWK;\n  view==='week'?renderWeek():renderSeason();\n}\n\nfunction renderWeek(){\n  const w=W(),gs=games(),LK=isLocked();\n  const ppl=S.roster.map(r=>r&&r.n).filter(Boolean);\n  const ent=Object.keys(w.picks).map(n=>[n,w.picks[n]]);\n  const usedBO=n=>(w.bo||[]).some(b=>b.by===n);\n  document.getElementById('dline').textContent=deadlineNote();\n  document.getElementById('dline').className='dline'+(LK?' shut':'');\n\n  const voidMe=(w.voided||[]).filter(v=>v.n===me);\n  const hitMe=(w.bo||[]).filter(b=>b.on===me);\n  const al=document.getElementById('alert');\n  if(me&&voidMe.length&&!w.picks[me]){\n    const v=voidMe[voidMe.length-1];\n    const g=G(v.g),tm=g?(v.s==='a'?g.a:g.h)[1]:'that game';\n    al.innerHTML='<b>Your leg came off.</b> '+esc(tm)+\n      ' kicked off before everyone was in, so it could not go on the ticket. Pick again from what is still open.';\n    al.classList.remove('hide');\n  } else if(me&&hitMe.length&&!w.picks[me]){\n    const last=hitMe[hitMe.length-1];\n    al.innerHTML='<b>Blacked out.</b> '+esc(last.by)+' killed your '+label(last)+\n      '. That selection stays dead for everyone. Pick again \u2014 anything else still live is fair game.';\n    al.classList.remove('hide');\n  }else al.classList.add('hide');\n\n  document.getElementById('legs').innerHTML=ent.map(function(e){\n    const n=e[0],p=e[1],g=grade(p);\n    return '<li>'+(g?'<span class=\"mark '+g+'\">'+(g==='w'?'\\u2713':g==='l'?'\\u2715':'\\u2014')+'</span>':'')+\n      '<span class=\"lg\"><span class=\"lgp\">'+label(p)+'</span><span class=\"lgw\">'+esc(n)+'</span></span>'+\n      '<span class=\"lgo\">'+sgn(p.pr)+'</span></li>';\n  }).join('');\n  renderBoBar(w,ent,LK);\n  document.getElementById('emptySlip').classList.toggle('hide',ent.length>0);\n  document.getElementById('legCount').textContent=ent.length\n    ?ent.length+' leg'+(ent.length>1?'s':'')+', '+Math.max(0,ppl.length-ent.length)+' still to pick'+\n      (LK?' \\u00b7 prices locked in':' \\u00b7 prices move until the deadline')\n    :'no legs yet';\n\n  let d=1;ent.forEach(e=>d*=dec(e[1].pr));\n  const st=Number(w.stake)||0,has=ent.length>0;\n  document.getElementById('payout').textContent=has?'$'+Math.round(st*d).toLocaleString():'$0';\n  document.getElementById('payCap').textContent=has?'returned on $'+st+' if all '+ent.length+' hit':'pays out if every leg hits';\n  document.getElementById('amer').textContent=has?sgn(am(d)):'\\u2014';\n  document.getElementById('prob').textContent=has?(100/d).toFixed(1)+'% implied chance':'combined price';\n  if(document.activeElement!==document.getElementById('stake'))document.getElementById('stake').value=st;\n\n  const voidFeed=(w.voided||[]).map(function(v){\n    const g=G(v.g),tm=g?(v.s==='a'?g.a:g.h)[1]:v.g;\n    return '<div class=\"fitem shut\"><span><b>'+esc(v.n)+\"</b>'s \"+esc(tm)+\n      ' came off the slip, the game started before everyone was in</span></div>'}).join('');\n  document.getElementById('feed').innerHTML=voidFeed+(w.bo||[]).map(function(b){\n    return '<div class=\"fitem\"><span><b>'+esc(b.by)+'</b> killed '+label(b)+\n      (b.on?' \u2014 <b>'+b.on+\"</b>'s pick\"+(w.picks[b.on]?', since re-picked':', still owes a new one')\n           :' \u2014 nobody had taken it')+'</span></div>'}).join('');\n\n  document.getElementById('roster').innerHTML=ppl.filter(Boolean).map(function(n){\n    const done=!!w.picks[n],hit=(w.bo||[]).some(b=>b.on===n)&&!done;\n    return '<span class=\"chip '+(done?'in':'')+' '+(hit?'hit':'')+'\"><span class=\"pip\">'+\n      esc(n.slice(0,2).toUpperCase())+'</span>'+esc(n)+(done?'':hit?', blacked out':', pending')+'</span>';\n  }).join('');\n\n  const lb=document.getElementById('lockBtn');\n  lb.setAttribute('aria-pressed',LK);\n  lb.disabled=pastDue()||!isMod();\n  lb.textContent=pastDue()?'Locked':w.locked?'Week locked':'Lock early';\n  /* Hidden for members because the server refuses these writes anyway --\n     better to not offer a button that can only fail. */\n  lb.classList.toggle('hide',!isMod());\n  document.getElementById('resBtn').classList.toggle('hide',!isMod());\n  document.getElementById('playersBtn').classList.toggle('hide',!isMod());\n  document.getElementById('nameWkBtn').classList.toggle('hide',!isMod());\n  document.getElementById('exportBtn').classList.toggle('hide',!isMod());\n  document.getElementById('diagBtn').classList.toggle('hide',!isMod());\n  document.getElementById('whoami').innerHTML=me\n    ? me+(isMod()?' <span class=\"badge\">moderator</span>':'')+\n      ' <button class=\"linkish\" id=\"signOut\">Sign out</button>' : '';\n  document.getElementById('cols').innerHTML=resMode\n    ?'<div>Team</div><div></div><div>Final score</div>':'<div>Team</div><div>Spread</div><div>Money line</div>';\n\n  if(!gs.length){document.getElementById('board').innerHTML=slateBuilder();return}\n  let html='',day='';\n  gs.forEach(function(g){\n    if(g.day!==day){day=g.day;html+='<div class=\"day\">'+esc(day)+'</div>'}\n    let own=null;ent.forEach(e=>{if(e[1].g===g.id)own=e});\n    const closed=!gameOpen(g);\n    const gl=ln(g),src=lineSrc(g);\n    const msrc=((W().lines||{})[g.id]||{}).msrc;\n    const tag=!gl.priced?' \\u00b7 <span class=\"lsrc warnsrc\">no line yet</span>'\n      :!gl.hasMl?' \\u00b7 <span class=\"lsrc warnsrc\">spread only</span>'\n      :!gl.hasSpread?' \\u00b7 <span class=\"lsrc warnsrc\">money line only</span>'\n      :msrc==='derived'?' \\u00b7 <span class=\"lsrc warnsrc\">money line derived from the spread</span>'\n      :src==='manual'?' \\u00b7 <span class=\"lsrc\">line set by hand</span>':'';\n    html+='<div class=\"game'+(closed?' shutgame':'')+'\"><div class=\"gm\"><span>'+esc(g.time)+\n      (closed?' \\u00b7 closed':'')+tag+'</span><span class=\"'+(own?'claim':'')+'\">'+\n      (own?esc(own[0])+\"'s game\":'')+'</span></div>'+row(g,'a',own,w)+row(g,'h',own,w)+'</div>';\n  });\n  document.getElementById('board').innerHTML=html;\n}\n\nfunction row(g,s,own,w){\n  const t=s==='a'?g.a:g.h,l=ln(g),sp=s==='a'?l.as:l.hs,so=s==='a'?l.ao:l.ho,ml=s==='a'?l.am:l.hm;\n  const on=ty=>!!own&&own[1].s===s&&own[1].t===ty;\n  /* Only a locked week kills the tap. Everything else stays tappable so the\n     blackout is reachable anywhere on the board; the popup says what's allowed. */\n  const dis=isLocked();\n  const shut=!gameOpen(g);\n  const taken=(own&&own[0]!==me)||shut;\n  const ring=C2[t[0]]||'rgba(232,228,217,.45)';\n  const crest=safeLogo(t[2])\n    ? '<span class=\"crest\" style=\"box-shadow:0 0 0 1px '+ring+'\">'+\n      '<img src=\"'+esc(safeLogo(t[2]))+'\" alt=\"\" loading=\"lazy\" decoding=\"async\"></span>'\n    : '<span class=\"cbar\" style=\"background:'+(C[t[0]]||'#555')+';box-shadow:0 0 0 1px '+ring+'\"></span>';\n  const head='<div class=\"team\">'+crest+\n    '<span class=\"ab\">'+esc(t[0])+'</span><span class=\"tn\">'+esc(t[1])+'</span></div>';\n  if(resMode){const r=(w.res||{})[g.id]||{};\n    return '<div class=\"row\">'+head+'<div></div><div class=\"sc\"><input class=\"num\" data-r=\"'+g.id+\n      '\" data-side=\"'+s+'\" value=\"'+(r[s]==null?'':r[s])+'\" placeholder=\"\\u2014\" inputmode=\"numeric\"></div></div>'}\n  if(edit)return '<div class=\"row\">'+head+\n    '<input class=\"edit num\" data-g=\"'+g.id+'\" data-f=\"'+s+'s\" value=\"'+sp+'\">'+\n    '<input class=\"edit num\" data-g=\"'+g.id+'\" data-f=\"'+s+'m\" value=\"'+ml+'\"></div>';\n  const dead=ty=>!!boOn(w,g.id,s,ty);\n  const cls=ty=>'pick'+(on(ty)&&own[0]!==me?' oth':'')+(dead(ty)?' dead':taken&&!on(ty)?' taken':'');\n  const sub=(ty,txt)=>dead(ty)?'blacked out':shut?'closed':txt;\n  const have=ty=>ty==='ml'?l.hasMl:l.hasSpread;\n  const cell=(ty,big,small)=>'<button class=\"'+cls(ty)+(have(ty)?'':' noline')+'\" aria-pressed=\"'+on(ty)+'\" '+\n    ((dis||!have(ty))?'disabled':'')+' data-g=\"'+g.id+'\" data-s=\"'+s+'\" data-t=\"'+ty+'\">'+\n    '<span class=\"p1\">'+(have(ty)?big:'\\u2014')+'</span>'+\n    '<span class=\"p2\">'+(have(ty)?sub(ty,small):'no line')+'</span></button>';\n  return '<div class=\"row\">'+head+\n    cell('spread',spr(sp),sgn(so))+cell('ml',sgn(ml),'win')+'</div>';\n}\n\nfunction slateBuilder(){\n  if(W().auto!==false&&slateTried[S.week]&&games().length===0)\n    return '<div class=\"paste\"><div class=\"day\">Week '+S.week+'</div>'+\n      '<p style=\"font-size:13px;color:var(--dim);margin:6px 0\">The schedule feed returned nothing for this week. '+\n      'Tap Refresh to try again, or paste the matchups below.</p>'+\n      '<textarea id=\"pasteIn\" placeholder=\"DAL @ PHI | 2026-09-17\"></textarea>'+\n      '<button class=\"go\" id=\"buildBtn\">Build the slate</button></div>';\n  return '<div class=\"paste\"><div class=\"day\">No slate for '+esc(W().label||('week '+S.week))+' yet</div>'+\n  '<p style=\"font-size:13px;color:var(--dim);margin:6px 0\">Paste the matchups, one per line, like <span class=\"num\">CHI @ CAR</span> or <span class=\"num\">Bears at Panthers</span>. Put the date after a pipe &mdash; <span class=\"num\">CHI @ CAR | 2026-09-20</span> &mdash; and the week locks itself the night before the earliest one. Anything after the date is just shown on the board. Without dates you have to lock by hand. Lines start flat, then use Edit lines.</p>'+\n  '<textarea id=\"pasteIn\" placeholder=\"DAL @ PHI | 2026-09-17 8:15 PM ET&#10;NYJ @ BUF | 2026-09-20 1:00 PM ET\"></textarea>'+\n  '<button class=\"go\" id=\"buildBtn\">Build the slate</button></div>'}\n\nfunction renderSeason(){\n  const rows=season(),risk=mode==='risk';\n  rows.sort(risk?function(a,b){return b.u-a.u}\n                :function(a,b){return b.pts-a.pts||((b.pct||0)-(a.pct||0))});\n  const wks=Object.keys(S.weeks).map(Number).sort((a,b)=>a-b).filter(function(n){\n    const p=S.weeks[n].picks||{};return Object.keys(p).some(k=>grade(p[k],n))});\n  if(sel&&!rows.some(r=>r.n===sel))sel=null;\n  if(!sel&&rows.length)sel=rows[0].n;\n  const cur=rows.filter(r=>r.n===sel)[0];\n\n  document.getElementById('mStraight').setAttribute('aria-selected',!risk);\n  document.getElementById('mRisk').setAttribute('aria-selected',risk);\n  document.getElementById('chartTitle').textContent=risk?'Edge, running total':'Hit rate, week by week';\n  document.getElementById('ruleNote').textContent=risk\n    ?'Edge is what you earned above the market price. Every pick is staked evenly: a win pays the price you took, a loss costs the stake, a push returns it. A blackout is the opposite bet on the leg it kills, so burying a heavy favourite that then loses is worth far more than burying a longshot. Zero means you exactly matched the market; positive means you beat it.'\n    :'One point per correct pick and per correct blackout, nothing else. Longshots and locks count the same here.';\n\n  const pts=wks.map(function(n){\n    let w=0,t=0,u=0,c=0;const p=S.weeks[n].picks||{};\n    Object.keys(p).forEach(function(k){const g=grade(p[k],n);\n      if(g==='w'){w++;t++}else if(g==='l')t++;\n      if(g){u+=unitsPick(p[k],g);c++}});\n    (S.weeks[n].bo||[]).forEach(function(b){const g=grade(b,n);if(g){u+=unitsBO(b,g);c++}});\n    return {n:n,v:t?w/t*100:0,u:c?u/c:0}});\n  drawChart(pts,cur,risk);\n  document.getElementById('chartSub').textContent=pts.length\n    ?(risk?(cur?'Group average in white, '+cur.n+' in gold. Above the line means beating the market.'\n                :'Average edge per entry across everyone')\n          :(cur?'Group in white, '+cur.n+' in gold':'Share of picks that came in, across everyone'))\n    :'Enter final scores on a week and this fills in';\n\n  document.getElementById('thead').innerHTML=risk\n    ?'<tr><th>Player</th><th>Edge</th><th>Picks</th><th>Blackouts</th><th>Avg&nbsp;odds</th></tr>'\n    :'<tr><th>Player</th><th>Picks</th><th>Blackouts</th><th>Form</th><th>Hit&nbsp;%</th></tr>';\n\n  document.getElementById('stand').innerHTML=rows.length?rows.map(function(r,i){\n    const cell='<td><span class=\"nm\"><span class=\"rk\">'+(i+1)+'</span>'+esc(r.n)+'</span></td>';\n    if(risk)return '<tr data-p=\"'+esc(r.n)+'\" class=\"'+(sel===r.n?'sel':'')+'\">'+cell+\n      '<td class=\"num '+(r.u>0?'up':r.u<0?'dn':'')+'\">'+u2(r.u)+'</td>'+\n      '<td class=\"num\">'+u2(r.up)+'</td><td class=\"num\">'+u2(r.ub)+'</td>'+\n      '<td class=\"num\">'+(r.avgP==null?'\\u2014':r.avgP.toFixed(0)+'%')+'</td></tr>';\n    const form=r.log.slice(0,6).reverse().map(l=>'<span class=\"seg '+l.r+'\"></span>').join('')||'<span class=\"seg\"></span>';\n    return '<tr data-p=\"'+esc(r.n)+'\" class=\"'+(sel===r.n?'sel':'')+'\">'+cell+\n      '<td class=\"num\">'+r.pw+'\\u2013'+r.pl+'</td><td class=\"num\">'+r.bw+'\\u2013'+r.bl+'</td>'+\n      '<td><span class=\"bars\">'+form+'</span></td>'+\n      '<td class=\"num\">'+(r.pct==null?'\\u2014':r.pct.toFixed(0)+'%')+'</td></tr>'}).join('')\n    :'<tr><td colspan=\"5\" style=\"color:var(--dim);font-size:13px\">Nothing graded yet. Enter final scores on a week to start the table.</td></tr>';\n\n  document.getElementById('drill').innerHTML=cur\n    ?'<h3>'+esc(cur.n)+'</h3>'+(cur.log.length?cur.log.map(l=>'<div class=\"dl\"><span class=\"dw\">Wk '+l.wk+'</span>'+\n      '<span><div>'+l.txt+'</div><div class=\"dsub\">'+esc(l.sub)+'</div></span>'+\n      '<span class=\"res '+l.r+'\">'+(risk?u2(l.u):l.r==='w'?'won':l.r==='l'?'lost':'push')+'</span></div>').join('')\n      :'<div class=\"dsub\">No graded weeks yet for '+cur.n+'.</div>')\n    :'<h3>Player detail</h3><div class=\"dsub\">Tap a name once the table fills in.</div>';\n}\n\nfunction drawChart(pts,player,risk){\n  const el=document.getElementById('chart'),WD=340,H=128;\n  if(!pts.length){el.innerHTML='<text x=\"4\" y=\"70\" fill=\"#8D94A4\" font-size=\"11\" font-family=\"Archivo\">No graded weeks yet</text>';return}\n  const x=i=>pts.length===1?WD/2:8+i*(WD-16)/(pts.length-1);\n  let group,mine=null,y,base,baseLbl;\n  if(risk){\n    let run=0;group=pts.map(p=>run+=p.u);\n    let m=null;\n    if(player){const by={};player.log.forEach(l=>{by[l.wk]=(by[l.wk]||0)+l.u});\n      let r2=0;m=pts.map(p=>r2+=(by[p.n]||0))}\n    mine=m;\n    const all=group.concat(m||[]).concat([0]);\n    let lo=Math.min.apply(null,all),hi=Math.max.apply(null,all);\n    if(hi-lo<1){hi+=.5;lo-=.5}\n    const pad=(hi-lo)*.12;lo-=pad;hi+=pad;\n    y=v=>H-((v-lo)/(hi-lo))*(H-16)-8;base=0;baseLbl='0';\n  }else{\n    group=pts.map(p=>p.v);\n    if(player){const by={};player.log.forEach(l=>{if(l.kind==='pick')by[l.wk]=l.r});\n      let w=0,t=0;mine=pts.map(function(p){const g=by[p.n];\n        if(g==='w'){w++;t++}else if(g==='l')t++;return t?w/t*100:null})}\n    y=v=>H-(v/100)*(H-16)-8;base=50;baseLbl='50%';\n  }\n  const path=a=>{let d='',on=false;\n    a.forEach(function(v,i){if(v==null)return;d+=(on?'L':'M')+x(i).toFixed(1)+','+y(v).toFixed(1)+' ';on=true});\n    return d};\n  el.innerHTML='<line x1=\"0\" y1=\"'+y(base)+'\" x2=\"'+WD+'\" y2=\"'+y(base)+'\" stroke=\"rgba(232,228,217,.14)\" stroke-dasharray=\"3 4\"/>'+\n    '<text x=\"2\" y=\"'+(y(base)-5)+'\" fill=\"#8D94A4\" font-size=\"9\" font-family=\"Archivo\">'+baseLbl+'</text>'+\n    '<path d=\"'+path(group)+'\" fill=\"none\" stroke=\"#E8E4D9\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/>'+\n    pts.map((p,i)=>group[i]==null?'':'<circle cx=\"'+x(i)+'\" cy=\"'+y(group[i])+'\" r=\"2.8\" fill=\"#E8E4D9\"/>'+\n      '<text x=\"'+x(i)+'\" y=\"'+(H+18)+'\" fill=\"#8D94A4\" font-size=\"9\" text-anchor=\"middle\" font-family=\"Archivo\">W'+p.n+'</text>').join('')+\n    (mine&&path(mine)?'<path d=\"'+path(mine)+'\" fill=\"none\" stroke=\"#DFA829\" stroke-width=\"2\" stroke-linejoin=\"round\"/>':'');\n}\n\ndocument.getElementById('board').addEventListener('click',function(e){\n  const b=e.target.closest('button.pick');\n  if(b&&!b.disabled&&me){sheetGame(b.dataset.g,b.dataset.s,b.dataset.t);return}\n  if(e.target.id==='buildBtn')buildSlate();\n});\ndocument.getElementById('board').addEventListener('change',function(e){\n  const i=e.target.closest('input.edit');\n  if(i){const v=parseFloat(i.value);if(!isNaN(v))\n    push(function(){const w=W();w.lines[i.dataset.g]=Object.assign({},w.lines[i.dataset.g]||{});\n      w.lines[i.dataset.g][i.dataset.f]=v;w.lines[i.dataset.g].src='manual'});return}\n  const r=e.target.closest('input[data-r]');\n  if(r){const raw=r.value.trim(),v=raw===''?null:parseInt(raw,10);\n    push(function(){const w=W();w.res[r.dataset.r]=Object.assign({},w.res[r.dataset.r]||{});\n      w.res[r.dataset.r][r.dataset.side]=(v==null||isNaN(v))?null:v})}\n});\n\n/* One token, one sheet. The SMS link is a real <a> the person taps themselves,\n   because iOS blocks an sms: navigation fired after an await rather than\n   directly from a gesture -- which is what the old inline button did. */\n/* A blackout kills a SELECTION -- a specific game, side and bet type. The\n   record already stored all three; what was missing is that the dead selection\n   has to stay on the board, unavailable to everyone, showing who killed it.\n   The person who lost it is additionally barred from the whole game, so they\n   can't sidestep to the other bet type on the same matchup. */\nfunction boOn(w,gid,side,type){\n  return (w.bo||[]).filter(b=>b.g===gid&&b.s===side&&b.t===type)[0]||null;\n}\nfunction renderBoBar(w,ent,LK){\n  const el=document.getElementById('boBar');\n  if(!me){el.innerHTML='';return}\n  const spent=(w.bo||[]).filter(b=>b.by===me)[0];\n  const lostMine=(w.bo||[]).filter(b=>b.on===me).length;\n  if(spent){\n    const done=!!grade(spent);\n    el.innerHTML='<div class=\"tok spent\"><span class=\"tk\">\\u2715</span><span class=\"tt\">You blacked out '+\n      label(spent)+'<small>'+(spent.on?(spent.on===me?'It was your own leg. ':'Was '+spent.on+\"'s leg. \")+\n        (w.picks[spent.on]?'Re-picked since.':'They still owe a new pick.'):'Nobody had taken it.')+\n      '</small></span>'+(LK||done?'':'<button class=\"lnk\" id=\"boUndo\">Take it back</button>')+'</div>';\n    return;\n  }\n  if(LK){el.innerHTML='<div class=\"tok spent\"><span class=\"tk\">\\u2715</span><span class=\"tt\">Blackout unused'+\n    '<small>Week is locked, so it expires here</small></span></div>';return}\n  el.innerHTML='<div class=\"tok live\"><span class=\"tk\">\\u2715</span><span class=\"tt\">Your blackout for week '+S.week+\n    ' is unspent<small>Tap any selection on the slate to kill it, taken or not'+\n    (lostMine?'. Yours has been killed '+lostMine+'x.':'.')+'</small></span></div>';\n}\n/* Identity is the name someone types, so two real Mikes collide on one pick\n   slot. The join gate below guards against that; these let you clean up when\n   it has already happened, or when someone typo'd, or someone leaves. */\nlet memberRoles={};\nasync function loadMembers(){\n  try{\n    const r=await fetch('/api/auth/members',{cache:'no-store'});\n    if(!r.ok)return;\n    const j=await r.json();\n    memberRoles={}; (j.members||[]).forEach(function(m){memberRoles[m.name]=m.role});\n  }catch(e){}\n}\nfunction pickLine(w,n){\n  const p=w.picks[n];\n  if(p)return 'Has '+label(p)+' at '+sgn(p.pr);\n  return (w.bo||[]).some(b=>b.on===n)?'Blacked out, owes a new pick':'No pick yet';\n}\nasync function sheetPlayers(){\n  await loadMembers();\n  const w=W();\n  /* Union of the roster and the account list, so somebody who signed up but\n     whose roster write failed still shows up and can be managed. */\n  const names=[...new Set(S.roster.map(r=>r&&r.n).filter(Boolean).concat(Object.keys(memberRoles)))];\n  openSheet('<p class=\"note\">Tap someone to rename them, clear their pick, or take them off entirely. Useful when two people end up under the same name.</p>'+\n    (names.length?names.map(function(n){\n      const bo=(w.bo||[]).filter(b=>b.by===n).length;\n      const role=memberRoles[n]==='mod'?' \\u00b7 moderator':'';\n      const ghost=S.roster.some(r=>r&&r.n===n)?'':' \\u00b7 not on the roster yet';\n      return '<button class=\"opt2 ok\" data-player=\"'+n.replace(/\"/g,'&quot;')+'\">'+\n        '<span class=\"o1\">'+n+(n===me?' (you)':'')+'</span>'+\n        '<span class=\"o2\">'+pickLine(w,n)+(bo?' \\u00b7 blackout spent':'')+role+ghost+'</span></button>'}).join('')\n      :'<p class=\"note\">Nobody has joined yet.</p>')+\n    '<button class=\"ghost\" data-cancel=\"1\">Close</button>','Players');\n}\nfunction sheetPlayer(n){\n  const w=W(),weeks=Object.keys(S.weeks).filter(k=>S.weeks[k].picks&&S.weeks[k].picks[n]).length;\n  const kills=Object.keys(S.weeks).reduce((a,k)=>a+((S.weeks[k].bo||[]).filter(b=>b.by===n).length),0);\n  openSheet('<p class=\"note\">'+pickLine(w,n)+'. '+weeks+' pick'+(weeks===1?'':'s')+\n      ' and '+kills+' blackout'+(kills===1?'':'s')+' on record across the season.</p>'+\n    '<label class=\"fld\"><span>Name</span><input id=\"renameIn\" value=\"'+n.replace(/\"/g,'&quot;')+'\" maxlength=\"14\"></label>'+\n    '<button class=\"opt2 ok\" data-rename=\"'+n.replace(/\"/g,'&quot;')+'\">'+\n      '<span class=\"o1\">Save name</span><span class=\"o2\">Renames them everywhere, all weeks</span></button>'+\n    (w.picks[n]?'<button class=\"opt2 bad\" data-clearpick=\"'+n.replace(/\"/g,'&quot;')+'\">'+\n      '<span class=\"o1\">Clear this week\\u2019s pick</span><span class=\"o2\">Frees the game, they stay in the league</span></button>':'')+\n    '<button class=\"opt2 bad\" data-removeask=\"'+n.replace(/\"/g,'&quot;')+'\">'+\n      '<span class=\"o1\">Remove '+n+'</span><span class=\"o2\">Off the roster, all picks and blackouts undone</span></button>'+\n    (memberRoles[n]?'<button class=\"opt2 ok\" data-promote=\"'+n.replace(/\"/g,'&quot;')+'|'+\n      (memberRoles[n]==='mod'?'member':'mod')+'\"><span class=\"o1\">'+\n      (memberRoles[n]==='mod'?'Demote to member':'Make moderator')+'</span>'+\n      '<span class=\"o2\">'+(memberRoles[n]==='mod'\n        ? 'They keep their picks, they lose the admin tools'\n        : 'Lets them remove players, enter scores and lock weeks')+'</span></button>':'')+\n    '<label class=\"fld\"><span>Set a new password for them</span>'+\n      '<input id=\"newPw\" type=\"text\" placeholder=\"at least 6 characters\"></label>'+\n    '<button class=\"opt2 bad\" data-resetpw=\"'+n.replace(/\"/g,'&quot;')+'\">'+\n      '<span class=\"o1\">Reset password</span><span class=\"o2\">Signs them out everywhere</span></button>'+\n    '<button class=\"ghost\" data-players=\"1\">Back</button>',n);\n}\nfunction sheetRemove(n){\n  openSheet('<div class=\"warn\">Removing <b>'+n+'</b> deletes every pick they have made, in every week, and undoes any selection they blacked out so it goes live again. Their season record disappears. This cannot be undone.</div>'+\n    '<button class=\"big\" data-remove=\"'+n.replace(/\"/g,'&quot;')+'\">Remove '+n+' for good</button>'+\n    '<button class=\"ghost\" data-players=\"1\">Keep them</button>','Remove '+n+'?');\n}\nfunction renamePlayer(from,to){\n  S.roster.forEach(function(r){if(r.n===from)r.n=to});\n  Object.keys(S.weeks).forEach(function(k){\n    const w=S.weeks[k];\n    if(w.picks&&w.picks[from]){w.picks[to]=w.picks[from];delete w.picks[from]}\n    (w.bo||[]).forEach(function(b){if(b.by===from)b.by=to;if(b.on===from)b.on=to});\n  });\n}\nfunction removePlayer(n){\n  S.roster=S.roster.filter(r=>r.n!==n);\n  Object.keys(S.weeks).forEach(function(k){\n    const w=S.weeks[k];\n    if(w.picks)delete w.picks[n];\n    /* Their own blackouts leave with them, so those selections go live again.\n       Blackouts aimed at them stand -- that was somebody else's move -- but the\n       victim reference is dropped so nothing still waits on a ghost. */\n    w.bo=(w.bo||[]).filter(b=>b.by!==n);\n    w.bo.forEach(function(b){if(b.on===n)b.on=null});\n  });\n}\nfunction openSheet(html,title){\n  document.getElementById('shTitle').textContent=title||'Use your blackout';\n  document.getElementById('shBody').innerHTML=html;\n  document.getElementById('sheet').classList.remove('hide');\n}\nfunction closeSheet(){document.getElementById('sheet').classList.add('hide')}\n/* Tapping any selection on the slate opens this: take it, or black it out.\n   Both options always show -- a greyed one states why -- so the rules are\n   learnable from the board rather than hidden behind a disabled button. */\nfunction sheetGame(gid,side,type){\n  const w=W(),g=G(gid);if(!g)return;\n  const t=side==='a'?g.a:g.h,l=ln(g),sp=side==='a'?l.as:l.hs,pr=price(g,side,type);\n  const head=type==='ml'?t[1]+' to win':t[1]+' '+spr(sp);\n  /* own  = who holds this GAME (game exclusivity)\n     exact = who holds THIS SELECTION (what a blackout actually kills) */\n  let own=null,exact=null;\n  Object.keys(w.picks).forEach(function(n){\n    const pk=w.picks[n];\n    if(pk.g===gid)own=n;\n    if(pk.g===gid&&pk.s===side&&pk.t===type)exact=n;\n  });\n  const killed=boOn(w,gid,side,type);\n  const spent=(w.bo||[]).some(b=>b.by===me);\n  const rz=(w.res||{})[gid],final=!!(rz&&rz.a!=null&&rz.h!=null);\n  const shut=!gameOpen(g);          // this game's day has arrived, whatever the week deadline says\n\n  const weekShut=isLocked();\n\n  const noline=!hasMarket(g,type);\n\n  let P;\n  if(noline)P={on:0,l:'Take this pick',s:'No '+(type==='ml'?'money line':'spread')+' for this game yet \\u2014 tap Refresh'};\n  else if(weekShut)P={on:0,l:'Take this pick',s:'Picks are locked for week '+S.week};\n  else if(killed)P={on:0,l:'Take this pick',s:'Blacked out by '+killed.by+', dead for the week'};\n  else if(shut)P={on:0,l:'Take this pick',s:'This game has already come around, it is off the board'};\n  else if(exact===me)P={on:1,l:'Drop this pick',s:'Frees the game up for everyone',a:'data-clear=\"1\"'};\n  else if(own&&own!==me)P={on:0,l:'Take this pick',s:own+' already has this game'};\n  else P={on:1,l:'Take this pick',s:own===me?'Replaces your current leg':'Becomes your leg on the slip',\n          a:'data-pick=\"'+gid+'|'+side+'|'+type+'\"'};\n\n  /* Blacking out is a move against the board, not against a player: any live\n     selection can be killed whether or not anyone has taken it. Only the exact\n     selection dies, so the wording must key off `exact`, never `own`. */\n  let B;\n  if(noline)B={on:0,l:'Black out',s:'No '+(type==='ml'?'money line':'spread')+' for this game yet'};\n  else if(weekShut)B={on:0,l:'Black out',s:'Picks are locked for week '+S.week};\n  else if(killed)B={on:0,l:'Black out',s:'Already dead, killed by '+killed.by};\n  else if(final)B={on:0,l:'Black out',s:'This game is already final'};\n  else if(shut)B={on:0,l:'Black out',s:'Too late, this game has already come around'};\n  else if(spent)B={on:0,l:'Black out',s:'You have already spent your blackout this week'};\n  else B={on:1,l:'Black out this pick',\n          s:exact?'Kills it and voids '+(exact===me?'your own leg, you pick again':exact+\"'s leg, they pick again\")\n                 :'Kills it so nobody can take it',\n          a:'data-bo2=\"'+gid+'|'+side+'|'+type+'\"'};\n\n  const btn=(o,kind)=>'<button class=\"opt2 '+kind+'\" '+(o.on?(o.a||''):'disabled')+'>'+\n    '<span class=\"o1\">'+o.l+'</span><span class=\"o2\">'+o.s+'</span></button>';\n  const whose=!killed?'':killed.on===me?', it was your pick'\n    :killed.on?', it was '+killed.on+\"'s pick\":', before anyone had taken it';\n  const note=killed\n    ? '<div class=\"warn\">'+killed.by+' blacked this out'+whose+\n      '. Nobody can take it for the rest of week '+S.week+'.</div>'\n    : '<p class=\"note\">'+g.a[1]+' at '+g.h[1]+' \\u00b7 '+g.time+'</p>';\n  openSheet(note+btn(P,'ok')+btn(B,'bad')+'<button class=\"ghost\" data-cancel=\"1\">Close</button>',\n    head+'  '+sgn(pr));\n}\nfunction sheetConfirm(gid,side,type){\n  const w=W(),g=G(gid);if(!g)return;\n  const l=ln(g),t=side==='a'?g.a:g.h,sp=side==='a'?l.as:l.hs,pr=price(g,side,type);\n  const what=type==='ml'?t[1]+' to win':t[1]+' '+spr(sp);\n  let own=null;Object.keys(w.picks).forEach(function(n){\n    const pk=w.picks[n];if(pk.g===gid&&pk.s===side&&pk.t===type)own=n});\n  openSheet('<div class=\"warn\">Killing <b>'+what+'</b> at '+sgn(pr)+' for the rest of week '+S.week+'. '+\n    (own?'It is '+(own===me?'your own':own+\"'s\")+' leg, so '+(own===me?'you':own)+' will have to pick again.'\n       :'Nobody has taken it, so this just removes it from the board.')+\n    '</div><button class=\"big\" data-go=\"'+gid+'|'+side+'|'+type+'\">Black it out</button>'+\n    '<button class=\"ghost\" data-cancel=\"1\">Never mind</button>','Confirm blackout');\n}\nfunction sheetSent(victim,txt){\n  if(!victim)return openSheet('<p class=\"note\">Killed. It stays struck through on the board all week and nobody can take it.</p>'+\n    '<button class=\"ghost\" data-cancel=\"1\">Done</button>','Blacked out');\n  const rec=S.roster.filter(r=>r.n===victim)[0],num=rec&&rec.p;\n  const msg=me+' just blacked out your '+txt+' on the week '+S.week+\" slip. You're up again, pick something else.\";\n  openSheet('<p class=\"note\">Killed. The selection stays dead all week.</p>'+\n    (victim===me?'<div class=\"warn\">That was your own leg, so pick again below.</div>'\n     :num?'<a class=\"big\" href=\"sms:'+num.replace(/[^\\d+]/g,'')+'?&body='+encodeURIComponent(msg)+'\">Text '+victim+'</a>'\n       :'<div class=\"warn\">No number saved for '+victim+', so tell them yourself.</div>')+\n    '<button class=\"ghost\" data-cancel=\"1\">Done</button>','Blacked out');\n}\n\ndocument.getElementById('boBar').addEventListener('click',function(e){\n  if(!e.target.closest('#boUndo'))return;\n  const w=W();let i=-1;(w.bo||[]).forEach(function(b,k){if(b.by===me&&i<0)i=k});\n  if(i<0)return;\n  const rec=w.bo[i];\n  const clash=Object.keys(w.picks).some(n=>n!==rec.on&&w.picks[n].g===rec.g);\n  const back=!!rec.on&&!w.picks[rec.on]&&!clash;\n  openSheet('<div class=\"warn\">'+(back?(rec.on===me?'Your':rec.on+\"'s\")+' original pick comes back exactly as it was.'\n    :rec.on?'The selection goes live again, but '+rec.on+' has already moved on, so their current pick stays put.'\n           :'The selection goes live again and anyone can take it.')+\n    ' Your blackout is yours to spend again.</div>'+\n    '<button class=\"big\" data-undo=\"'+i+'\">Take it back</button>'+\n    '<button class=\"ghost\" data-cancel=\"1\">Leave it</button>','Undo blackout');\n});\n\ndocument.getElementById('sheet').addEventListener('click',async function(e){\n  if(e.target.id==='sheet'||e.target.closest('[data-cancel]')||e.target.closest('#shClose'))return closeSheet();\n  const take=e.target.closest('[data-pick]');\n  if(take){\n    const q=take.dataset.pick.split('|'),gid=q[0],sd=q[1],ty=q[2];\n    await push(function(){const w=W(),gm=G(gid),l=ln(gm);\n      if(isLocked())return;                                            // deadline passed while you decided\n      if(!hasMarket(gm,ty))return;                                     // that market has no price\n      if(boOn(w,gid,sd,ty))return;                                     // killed since the sheet opened\n      if(!gameOpen(gm))return;                                         // its day arrived while you decided\n      if(Object.keys(w.picks).some(n=>n!==me&&w.picks[n].g===gid))return; // claimed since\n      w.picks[me]={g:gid,s:sd,t:ty,sp:sd==='a'?l.as:l.hs,pr:price(gm,sd,ty),\n        op:price(gm,sd==='a'?'h':'a',ty),at:Date.now()}});\n    return closeSheet();\n  }\n  if(e.target.closest('[data-clear]')){\n    await push(function(){if(isLocked())return;delete W().picks[me]});\n    return closeSheet();\n  }\n  if(e.target.closest('[data-setweekname]')){\n    const box=document.getElementById('wkName');\n    const v=(box&&box.value||'').trim();\n    await push(function(){ if(v)W().label=v; else delete W().label });\n    return closeSheet();\n  }\n  if(e.target.closest('[data-players]'))return sheetPlayers();\n  const pl=e.target.closest('[data-player]');\n  if(pl)return sheetPlayer(pl.dataset.player);\n  const ra=e.target.closest('[data-removeask]');\n  if(ra)return sheetRemove(ra.dataset.removeask);\n  const rn=e.target.closest('[data-rename]');\n  if(rn){\n    const from=rn.dataset.rename;\n    const box=document.getElementById('renameIn');\n    let to=(box&&box.value||'').trim();\n    if(!to)return;\n    to=to.charAt(0).toUpperCase()+to.slice(1);\n    if(to===from)return sheetPlayers();\n    if(S.roster.some(r=>r.n===to))\n      return openSheet('<div class=\"warn\">Somebody is already called <b>'+to+\n        '</b>. Pick a name that is not taken, or remove the duplicate first.</div>'+\n        '<button class=\"ghost\" data-player=\"'+from.replace(/\"/g,'&quot;')+'\">Back</button>','Name taken');\n    identityBusy=true;\n    try{\n      if(me===from){me=to;await sset('me',me,false)}\n      await push(function(){renamePlayer(from,to)});\n    } finally { identityBusy=false; }\n    return sheetPlayers();\n  }\n  const cp=e.target.closest('[data-clearpick]');\n  if(cp){const n=cp.dataset.clearpick;await push(function(){delete W().picks[n]});return sheetPlayers()}\n  const rm=e.target.closest('[data-remove]');\n  if(rm){\n    const n=rm.dataset.remove;\n    identityBusy=true;\n    try{\n      await push(function(){removePlayer(n)});\n      /* Also delete the account, otherwise they sign back in and reappear. */\n      const res=await authPost('admin',{action:'delete',name:n});\n      if(!res.ok&&res.status!==404)\n        return openSheet('<div class=\"warn\">Their picks were cleared, but the account could not be deleted: '+\n          (res.body.error||res.status)+'</div><button class=\"ghost\" data-players=\"1\">Back</button>','Partly done');\n      if(me===n)await signOut();\n    } finally { identityBusy=false; }\n    return sheetPlayers();\n  }\n  const rs=e.target.closest('[data-resetpw]');\n  if(rs){\n    const n=rs.dataset.resetpw;\n    const box=document.getElementById('newPw');\n    const pw=(box&&box.value||'').trim();\n    if(pw.length<6)return openSheet('<div class=\"warn\">Give them a password of at least 6 characters.</div>'+\n      '<button class=\"ghost\" data-player=\"'+n.replace(/\"/g,'&quot;')+'\">Back</button>','Too short');\n    const salt=newSalt();\n    const res=await authPost('admin',{action:'password',name:n,salt:salt,dk:await deriveKey(pw,salt)});\n    return openSheet('<div class=\"warn\">'+(res.ok\n      ? n+' can now sign in with that password. They have been signed out everywhere.'\n      : (res.body.error||'That did not work'))+'</div>'+\n      '<button class=\"ghost\" data-players=\"1\">Back</button>',res.ok?'Password set':'Not allowed');\n  }\n  const pr=e.target.closest('[data-promote]');\n  if(pr){\n    const q=pr.dataset.promote.split('|');\n    const res=await authPost('admin',{action:'role',name:q[0],role:q[1]});\n    if(!res.ok)return openSheet('<div class=\"warn\">'+(res.body.error||'Could not change that')+\n      '</div><button class=\"ghost\" data-players=\"1\">Back</button>','Not allowed');\n    await loadMembers();\n    return sheetPlayer(q[0]);\n  }\n  const v=e.target.closest('[data-bo2]');\n  if(v){const q=v.dataset.bo2.split('|');return sheetConfirm(q[0],q[1],q[2])}\n  const go=e.target.closest('[data-go]');\n  if(go){\n    const q=go.dataset.go.split('|'),gid=q[0],sd=q[1],ty=q[2];\n    let victim=null,txt='';\n    await push(function(){const w=W(),gm=G(gid);if(!gm)return;\n      if(isLocked())return;                               // deadline passed while you decided\n      if(!hasMarket(gm,ty))return;                        // that market has no price\n      if(boOn(w,gid,sd,ty))return;                        // someone beat us to it\n      if(!gameOpen(gm))return;                            // its day arrived while you decided\n      if((w.bo||[]).some(b=>b.by===me))return;            // already spent this week\n      const l=ln(gm);\n      Object.keys(w.picks).forEach(function(n){\n        const pk=w.picks[n];\n        if(pk.g===gid&&pk.s===sd&&pk.t===ty)victim=n;     // only the exact selection dies\n      });\n      if(victim)txt=label(w.picks[victim]);\n      /* Priced at the moment of the blackout -- it is its own bet, and there may\n         be no pick to inherit a price from. */\n      w.bo.push({by:me,on:victim,g:gid,s:sd,t:ty,sp:sd==='a'?l.as:l.hs,\n        pr:price(gm,sd,ty),op:price(gm,sd==='a'?'h':'a',ty),at:Date.now()});\n      if(victim)delete w.picks[victim];\n    });\n    return sheetSent(victim,txt);\n  }\n  const un=e.target.closest('[data-undo]');\n  if(un){\n    const i=+un.dataset.undo;\n    await push(function(){const w=W(),r=(w.bo||[])[i];if(!r||r.by!==me)return;\n      w.bo.splice(i,1);\n      if(r.on&&!w.picks[r.on]&&!Object.keys(w.picks).some(n=>w.picks[n].g===r.g))\n        w.picks[r.on]={g:r.g,s:r.s,t:r.t,sp:r.sp,pr:r.pr,op:r.op,at:r.at}});\n    return closeSheet();\n  }\n});\n\ndocument.getElementById('stake').addEventListener('change',function(e){\n  push(function(){W().stake=Math.max(0,Number(e.target.value)||0)})});\nfunction on(id,fn){document.getElementById(id).addEventListener('click',fn)}\non('editBtn',function(){edit=!edit;if(edit)resMode=false;sync()});\non('resBtn',function(){resMode=!resMode;if(resMode)edit=false;sync()});\nfunction sync(){\n  const a=document.getElementById('editBtn'),b=document.getElementById('resBtn');\n  a.setAttribute('aria-pressed',edit);a.textContent=edit?'Done editing':'Edit lines';\n  b.setAttribute('aria-pressed',resMode);b.textContent=resMode?'Done scoring':'Fix a score';\n  render();\n}\non('lockBtn',function(){push(function(){W().locked=!W().locked})});\non('playersBtn',function(){sheetPlayers()});\non('diagBtn',function(){\n  const w=W(),gs=games();\n  const row=(k,label)=>{const f=FEED[k];\n    return '<div class=\"dl\"><span class=\"dw\">'+(f?(f.ok?'\\u2713':'\\u2715'):'\\u2014')+'</span>'+\n      '<span><div>'+label+'</div><div class=\"dsub\">'+(f?f.msg:'not called yet')+'</div></span>'+\n      '<span class=\"res '+(f?(f.ok?'w':'l'):'p')+'\">'+\n      (f?new Date(f.at).toLocaleTimeString():'')+'</span></div>'};\n  const priced=gs.filter(g=>isPriced(g)).length;\n  openSheet('<p class=\"note\">Week '+S.week+' \\u00b7 '+gs.length+' games \\u00b7 '+\n      priced+' priced \\u00b7 '+(gs.length-priced)+' waiting on a line.</p>'+\n    row('schedule','Schedule (ESPN)')+row('polymarket','Money lines (Polymarket)')+\n    row('espn','Spreads and fallback money lines (ESPN)')+row('scores','Final scores (ESPN)')+\n    '<p class=\"note\">'+(gs.length?gs.map(g=>g.a[0]+'/'+g.h[0]+' '+\n      (isPriced(g)?lineSrc(g):'no line')).join(' \\u00b7 '):'no games loaded')+'</p>'+\n    '<a class=\"big\" href=\"/api/diag\" target=\"_blank\">Probe the feeds now</a>'+\n    '<button class=\"ghost\" data-cancel=\"1\">Close</button>','Diagnostics');\n});\non('exportBtn',function(){\n  openSheet('<p class=\"note\">Downloads the whole season as a file: every week, pick, blackout and score, plus who has an account. Passwords are never included. Redeploying does not touch your data, so this is belt and braces.</p>'+\n    '<a class=\"big\" href=\"/api/export\" download=\"parlay-backup.json\">Download backup</a>'+\n    '<button class=\"ghost\" data-cancel=\"1\">Close</button>','Back up the season');\n});\non('nameWkBtn',function(){\n  openSheet('<p class=\"note\">Give this week a name instead of a number. Useful for a one-off card &mdash; put the Thanksgiving games in their own week and it locks itself the night before, separately from the Sunday slate.</p>'+\n    '<label class=\"fld\"><span>Name</span><input id=\"wkName\" maxlength=\"24\" placeholder=\"Week '+S.week+'\" value=\"'+\n      esc(W().label||'')+'\"></label>'+\n    '<button class=\"opt2 ok\" data-setweekname=\"1\"><span class=\"o1\">Save</span>'+\n      '<span class=\"o2\">Leave it empty to go back to Week '+S.week+'</span></button>'+\n    '<button class=\"ghost\" data-cancel=\"1\">Close</button>','Name this week');\n});\ndocument.getElementById('whoami').addEventListener('click',function(e){\n  if(e.target.closest('#signOut'))signOut()});\n/* Changing week has to fetch that week's schedule. Without this the slate only\n   ever loaded for whichever week the app happened to boot on, so every other\n   week sat empty forever. Tried at most once a minute per week so flicking\n   back and forth does not hammer the feed. */\nconst slateTried={};\nasync function ensureWeek(n){\n  if(games(n).length)return;\n  if(W(n).auto===false)return;                 // built by hand, leave it alone\n  if(slateTried[n]&&Date.now()-slateTried[n]<6e4)return;\n  slateTried[n]=Date.now();\n  status('loading the week '+n+' schedule');\n  try{\n    const r=await syncSlate(n);\n    render();\n    if(r&&r.built){ await poly() }\n    else if(r&&r.none){ status('no games listed for week '+n+' yet') }\n  }catch(e){\n    slateTried[n]=0;                            // a failure should be retryable\n    status('could not load week '+n+' \\u2014 '+(e.message||'failed'));\n  }\n}\non('prev',function(){if(S.week>1){S.week--;render();ensureWeek(S.week)}});\nconst MAXWK=22;\non('next',function(){if(S.week<MAXWK){S.week++;render();ensureWeek(S.week)}});\non('mStraight',function(){mode='straight';render()});\non('mRisk',function(){mode='risk';render()});\non('tabWeek',function(){setView('week')});\non('tabSeason',function(){setView('season')});\nfunction setView(v){view=v;\n  document.getElementById('tabWeek').setAttribute('aria-selected',v==='week');\n  document.getElementById('tabSeason').setAttribute('aria-selected',v==='season');\n  document.getElementById('viewWeek').classList.toggle('hide',v!=='week');\n  document.getElementById('viewSeason').classList.toggle('hide',v==='week');render()}\ndocument.getElementById('stand').addEventListener('click',function(e){\n  const tr=e.target.closest('tr[data-p]');if(tr){sel=tr.dataset.p;render()}});\n\nfunction buildSlate(){\n  const ta=document.getElementById('pasteIn');if(!ta)return;\n  const raw=ta.value.trim();if(!raw)return;\n  const byName={};Object.keys(TEAMS).forEach(function(ab){\n    byName[TEAMS[ab].toLowerCase()]=ab;byName[ab.toLowerCase()]=ab});\n  const out=[];\n  raw.split('\\n').forEach(function(line){\n    if(!line.trim())return;\n    const bits=line.split('|'),mt=bits[0].trim(),tm=(bits[1]||'').trim();\n    const parts=mt.split(/\\s+(?:@|at|vs\\.?)\\s+/i);if(parts.length<2)return;\n    const a=byName[parts[0].trim().toLowerCase()],h=byName[parts[1].trim().toLowerCase()];\n    if(!a||!h)return;\n    let dt=null,day=tm||'Date to be set',time='';\n    const m=tm.match(/(\\d{4})-(\\d{2})-(\\d{2})/);\n    if(m){\n      dt=m[1]+'-'+m[2]+'-'+m[3];\n      const dd=new Date(+m[1],+m[2]-1,+m[3]);\n      day=dd.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});\n      time=(tm.slice(m[0].length).trim())||'';   // anything after the date is display only\n    }\n    out.push({id:(a+'-'+h).toLowerCase(),day:day,time:time,d:dt,\n      a:[a,TEAMS[a]],h:[h,TEAMS[h]],l:{as:0,ao:-110,am:-110,hs:0,ho:-110,hm:-110}});\n  });\n  if(!out.length){alert(\"Couldn't read any matchups. Use team names or abbreviations, one game per line.\");return}\n  push(function(){W().games=out;W().auto=false});\n}\n\nfunction status(t,c){document.getElementById('stxt').textContent=t;\n  document.getElementById('dot').className='dot '+(c||'')}\n\n/* Scores come from ESPN's public scoreboard feed \u2014 no key, no signup. There is\n   no scheduler in a page like this, so instead of running at a fixed hour it\n   syncs whenever someone opens the board and at most twice an hour after that.\n   Only games ESPN marks completed are written, so a live score never grades a\n   pick early. Manual entry stays as a fallback if the feed is unreachable. */\nconst ESPN_AB={WSH:'WAS',LA:'LAR',LARM:'LAR'};\nlet lastSync=0;\nfunction needScores(){\n  const need=[],now=Date.now();\n  Object.keys(S.weeks).forEach(function(wk){\n    const w=S.weeks[wk];\n    (w.games||[]).forEach(function(g){\n      const d=gameDate(g);if(!d)return;\n      const r=(w.res||{})[g.id];\n      if(r&&r.a!=null&&r.h!=null)return;            // already have it\n      if(zonedMidnight(d).getTime()>now)return;     // hasn't been played yet\n      need.push({wk:wk,g:g,d:d});\n    });\n  });\n  return need;\n}\nasync function syncScores(manual){\n  const need=needScores();\n  lastSync=Date.now();\n  if(!need.length){if(manual)status('every played game is already scored','on');return}\n  const ds=need.map(n=>n.d).sort(),strip=s=>s.replace(/-/g,'');\n  const range=strip(ds[0])+'-'+strip(ds[ds.length-1]);\n  status('pulling final scores');\n  try{\n    const r=await fetch('/api/scores?dates='+range);\n    if(!r.ok)throw 0;\n    const j=await r.json(),ev=j.events||[],found={};\n    ev.forEach(function(e){\n      const c=(e.competitions||[])[0];if(!c)return;\n      const st=e.status||c.status||{};\n      if(!(st.type&&st.type.completed))return;      // still live or scheduled\n      const cs=c.competitors||[];\n      const home=cs.filter(x=>x.homeAway==='home')[0],away=cs.filter(x=>x.homeAway==='away')[0];\n      if(!home||!away)return;\n      const ab=t=>{const v=((t.team&&t.team.abbreviation)||'').toUpperCase();return ESPN_AB[v]||v};\n      const a=parseInt(away.score,10),h=parseInt(home.score,10);\n      if(isNaN(a)||isNaN(h))return;\n      found[ab(away)+'@'+ab(home)]={a:a,h:h};\n    });\n    let n=0;\n    await push(function(){\n      need.forEach(function(x){\n        const f=found[x.g.a[0]+'@'+x.g.h[0]];if(!f)return;\n        const w=S.weeks[x.wk];w.res=w.res||{};\n        if(w.res[x.g.id]&&w.res[x.g.id].a!=null)return;\n        w.res[x.g.id]={a:f.a,h:f.h};n++;\n      });\n    });\n    status(n?n+' final score'+(n>1?'s':'')+' in':'nothing final yet, '+need.length+' still to play out','on');\n  }catch(e){status('could not reach the score feed, use Fix a score')}\n}\n/* Every feed call records what happened, so a failure can be read off the\n   screen instead of guessed at from a stale number. */\nconst FEED={};\nfunction note(k,ok,msg){FEED[k]={ok:ok,msg:msg,at:Date.now()}}\nlet lastLines=0;\nfunction maybeLines(){\n  if(Date.now()-lastLines<9e5)return;      // at most every 15 minutes\n  lastLines=Date.now();\n  poly();\n}\nfunction maybeSync(){\n  if(Date.now()-lastSync<18e5)return;               // at most twice an hour\n  if(!needScores().length)return;\n  syncScores(false);\n}\n/* The slate builds itself from ESPN's schedule. Before this, the shipped Week 1\n   was written into shared storage on first load and never revisited, so\n   correcting the code could not correct a board that already existed -- the\n   stale games simply persisted. Weeks fetched this way carry auto:true and are\n   kept in step with the feed; a week built by hand keeps auto:false and is\n   never touched. */\nconst SEASON=2026;\nfunction etParts(iso){\n  const d=new Date(iso);\n  if(isNaN(d))return null;\n  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',\n    year:'numeric',month:'2-digit',day:'2-digit'}).format(d);\n  const label=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',\n    weekday:'long',month:'short',day:'numeric'}).format(d);\n  const time=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',\n    hour:'numeric',minute:'2-digit'}).format(d)+' ET';\n  return {d:day,day:label,time:time};\n}\nfunction slateFromEspn(json){\n  const out=[];\n  (json&&json.events||[]).forEach(function(e){\n    const c=(e.competitions||[])[0];if(!c)return;\n    const cs=c.competitors||[];\n    const home=cs.filter(x=>x.homeAway==='home')[0],away=cs.filter(x=>x.homeAway==='away')[0];\n    if(!home||!away)return;\n    const ab=t=>{const v=(((t.team||{}).abbreviation)||'').toUpperCase();return ESPN_AB[v]||v};\n    const nm=t=>TEAMS[ab(t)]||((t.team||{}).shortDisplayName)||ab(t);\n    const lg=t=>safeLogo(((t.team||{}).logo)||'');\n    const A=ab(away),H=ab(home);\n    if(!A||!H)return;\n    const when=etParts(e.date||c.date);\n    if(!when)return;\n    out.push({id:(A+'-'+H).toLowerCase(),day:when.day,time:when.time,d:when.d,\n      a:[A,nm(away),lg(away)],h:[H,nm(home),lg(home)]});\n  });\n  return out;\n}\n/* Merge rather than replace: a game already on the board keeps its stored line\n   so a rebuild never silently discards a hand-set number, and picks keep\n   pointing at the same ids. */\n/* Nothing to carry across: games hold identity only. Prices live in\n   week.lines and survive a rebuild because they are stored separately. */\nfunction mergeSlate(existing,fresh){ return fresh; }\n/* Throttled per week. Loading a week and then refreshing its lines both want\n   the schedule, and without this every visit fetched it twice. */\n/* The whole schedule is published, so load all of it rather than a week at a\n   time. Runs once per session; weeks already built by hand are left alone. */\nlet seasonDone=false;\nasync function loadSeason(){\n  if(seasonDone)return {skipped:true};\n  seasonDone=true;\n  let j=null;\n  try{\n    const r=await fetch('/api/season?year='+SEASON);\n    if(!r.ok)throw new Error('season '+r.status);\n    j=await r.json();\n  }catch(e){ seasonDone=false; note('schedule',false,e.message||'season failed'); throw e }\n  const wk=(j&&j.weeks)||{};\n  const nums=Object.keys(wk).map(Number).filter(n=>n>=1&&n<=MAXWK).sort((a,b)=>a-b);\n  let built=0,games=0;\n  await push(function(S){\n    nums.forEach(function(n){\n      const w=S.weeks[n]||(S.weeks[n]={stake:50,locked:false,games:[],lines:{},picks:{},bo:[],res:{}});\n      if(w.auto===false)return;                       // hand-built, leave it\n      if((w.games||[]).length)return;                 // already loaded\n      const rows=wk[n].map(function(r){\n        const when=etParts(r[2]);\n        if(!when)return null;\n        const A=ESPN_AB[r[0]]||r[0], H=ESPN_AB[r[1]]||r[1];\n        return {id:(A+'-'+H).toLowerCase(),day:when.day,time:when.time,d:when.d,\n          a:[A,TEAMS[A]||A,safeLogo(r[3])],h:[H,TEAMS[H]||H,safeLogo(r[4])]};\n      }).filter(Boolean);\n      if(!rows.length)return;\n      w.games=rows; w.auto=true; built++; games+=rows.length;\n    });\n  });\n  note('schedule',built>0||nums.length>0,nums.length+' weeks in the feed, '+built+' built, '+games+' games');\n  return {weeks:nums.length,built:built,games:games};\n}\n\nconst slateAt={};\nconst slateInflight={};\nasync function syncSlate(n,force){\n  const w=W(n);\n  if(w.auto===false)return {skipped:'built by hand'};\n  if(!force&&games(n).length&&slateAt[n]&&Date.now()-slateAt[n]<3e5)\n    return {cached:true,count:games(n).length};\n  /* Boot and a week change can both ask for the same schedule before either\n     finishes, so share one request rather than firing two. */\n  if(slateInflight[n])return slateInflight[n];\n  const job=(async function(){\n    slateAt[n]=Date.now();\n    const r=await fetch('/api/schedule?week='+n+'&year='+SEASON);\n    if(!r.ok){slateAt[n]=0;note('schedule',false,'HTTP '+r.status);throw new Error('schedule '+r.status)}\n    const fresh=slateFromEspn(await r.json());\n    note('schedule',fresh.length>0,fresh.length+' games returned for week '+n);\n    if(!fresh.length)return {none:true};\n    const cur=W(n);\n    const before=JSON.stringify((cur.games||[]).map(g=>[g.id,g.d]));\n    const merged=mergeSlate(cur.games,fresh);\n    if(JSON.stringify(merged.map(g=>[g.id,g.d]))===before&&(cur.games||[]).length===merged.length)\n      return {same:true,count:merged.length};\n    await push(function(){const x=W(n);x.games=merged;x.auto=true});\n    return {built:merged.length};\n  })();\n  slateInflight[n]=job;\n  try{ return await job } finally { delete slateInflight[n] }\n}\n\n/* Cents are implied probability, so the conversion is exact arithmetic, not a\n   fit: p >= 0.5 -> -100p/(1-p), p < 0.5 -> +100(1-p)/p. */\nconst toAm=p=>p>=.5?-Math.round(100*p/(1-p)):Math.round(100*(1-p)/p);\n\nconst PM_QUERIES=[\n  'limit=100&closed=false&active=true&tag_slug=nfl',\n  'limit=100&closed=false&active=true&series_slug=nfl',\n  'limit=300&closed=false&active=true&order=startDate&ascending=true',\n  'limit=300&closed=false&active=true'\n];\n/* Polymarket runs a separate Yes/No market per handicap, worded \"will X beat Y\n   by more than N points\". The Yes price is the probability of covering, which\n   converts to spread juice the same way any probability does. */\nfunction pmSpread(e,g,J){\n  const an=g.a[1].toLowerCase(),hn=g.h[1].toLowerCase();\n  for(const m of (e.markets||[])){\n    const q=String(m.question||m.slug||'').toLowerCase();\n    const hit=q.match(/(?:will\\s+the\\s+)?([a-z0-9' .-]+?)\\s+beat\\s+(?:the\\s+)?([a-z0-9' .-]+?)\\s+by\\s+(?:more\\s+than\\s+)?([\\d.]+)/);\n    if(!hit)continue;\n    const favTxt=hit[1],n=parseFloat(hit[3]);\n    if(!isFinite(n))continue;\n    const outs=J(m.outcomes),pr=J(m.outcomePrices);\n    if(!Array.isArray(outs)||!Array.isArray(pr)||outs.length!==2)continue;\n    const yi=outs.map(x=>String(x).toLowerCase()).indexOf('yes');\n    if(yi<0)continue;\n    const py=parseFloat(pr[yi]);\n    if(!(py>0&&py<1))continue;\n    const favHome=favTxt.indexOf(hn)>-1, favAway=favTxt.indexOf(an)>-1;\n    if(!favHome&&!favAway)continue;\n    return favHome?{hs:-n,as:n,ho:toAm(py),ao:toAm(1-py)}\n                  :{as:-n,hs:n,ao:toAm(py),ho:toAm(1-py)};\n  }\n  return null;\n}\nfunction pmMatch(ev,gs){\n  const J=v=>{try{return typeof v==='string'?JSON.parse(v):v}catch(e){return null}};\n  const got={};\n  gs.forEach(function(g){\n    const an=g.a[1].toLowerCase(),hn=g.h[1].toLowerCase();\n    const hay=e=>((e.title||'')+' '+(e.slug||'')).toLowerCase();\n    const e=ev.filter(x=>hay(x).indexOf(an)>-1&&hay(x).indexOf(hn)>-1)[0];\n    if(!e||!e.markets)return;\n    for(const m of e.markets){\n      const outs=J(m.outcomes),pr=J(m.outcomePrices);\n      if(!Array.isArray(outs)||!Array.isArray(pr)||outs.length!==2)continue;\n      const lo=outs.map(x=>String(x).toLowerCase());\n      const ai=lo.findIndex(x=>x.indexOf(an)>-1),hi=lo.findIndex(x=>x.indexOf(hn)>-1);\n      if(ai<0||hi<0||ai===hi)continue;      // Yes/No market, not the winner market\n      const pa=parseFloat(pr[ai]),ph=parseFloat(pr[hi]);\n      if(!(pa>0&&pa<1&&ph>0&&ph<1))continue;\n      got[g.id]={am:toAm(pa),hm:toAm(ph)};\n      const sp=pmSpread(e,g,J);\n      if(sp)Object.assign(got[g.id],sp);\n      break;\n    }\n  });\n  return got;\n}\n/* Which filter returns current NFL game markets is not documented and has\n   changed, so try the plausible shapes and keep the first that matches. */\nasync function fromPolymarket(gs){\n  const tried=[];\n  for(const q of PM_QUERIES){\n    let ev=null;\n    try{\n      const r=await fetch('/api/polymarket?'+q);\n      if(!r.ok){tried.push(q.split('&').slice(-1)[0]+' HTTP '+r.status);continue}\n      ev=await r.json();\n    }catch(e){tried.push('fetch failed');continue}\n    if(!Array.isArray(ev)){tried.push('not a list');continue}\n    const got=pmMatch(ev,gs);\n    const n=Object.keys(got).length;\n    tried.push(ev.length+' events \\u2192 '+n+' matched');\n    if(n){note('polymarket',true,'\"'+q.split('&').slice(-1)[0]+'\" '+tried[tried.length-1]);return got}\n  }\n  note('polymarket',false,'no NFL game markets found \\u2014 '+tried.join('; '));\n  return {};\n}\n\n/* Last resort only. NFL margins are roughly normal, and a standard deviation\n   near 10.5 fits the market far better than the textbook 13.9: it puts -3.5 at\n   about 63% and -6.5 at about 74%, which is where the board prices them.\n   A derived price is always tagged so it is never taken for a market price. */\nfunction normCdf(z){\n  const t=1/(1+0.2316419*Math.abs(z));\n  const d=0.3989423*Math.exp(-z*z/2);\n  let p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));\n  return z>0?1-p:p;\n}\nconst SPREAD_SD=10.5;\nconst VIG=0.02;\nfunction mlFromSpread(homeSpread){\n  const n=Number(homeSpread);\n  if(!isFinite(n))return null;\n  const pHome=normCdf(-n/SPREAD_SD);\n  const clamp=x=>Math.min(Math.max(x,.02),.98);\n  return {hm:toAm(clamp(pHome+VIG)),am:toAm(clamp(1-pHome+VIG))};\n}\n\n/* ESPN moves money lines between shapes and is not consistent between games,\n   so try every known location and accept \"+160\" strings as well as numbers. */\nfunction pickNum(v){\n  if(v===null||v===undefined)return null;\n  /* Zero is not a money line -- ESPN uses it as a placeholder for \"no price\". */\n  if(typeof v==='number')return (isFinite(v)&&v!==0)?v:null;\n  const m=String(v).replace(/[^0-9+-]/g,'');\n  if(!/^[+-]?\\d+$/.test(m))return null;\n  const n=parseInt(m,10);\n  return isFinite(n)&&n!==0?n:null;\n}\nfunction mlFrom(o,side){\n  if(!o)return null;\n  const t=side==='a'?o.awayTeamOdds:o.homeTeamOdds;\n  const cands=[\n    t&&t.moneyLine,\n    t&&t.current&&t.current.moneyLine&&t.current.moneyLine.american,\n    t&&t.close&&t.close.moneyLine&&t.close.moneyLine.american,\n    t&&t.open&&t.open.moneyLine&&t.open.moneyLine.american,\n    side==='a'?o.moneylineAway:o.moneylineHome,\n    side==='a'?o.awayTeamMoneyLine:o.homeTeamMoneyLine\n  ];\n  for(const c of cands){const n=pickNum(c);if(n!==null)return n}\n  return null;\n}\nfunction parseSpread(details,away,home){\n  if(!details)return null;\n  const t=String(details).trim();\n  if(/^even$/i.test(t))return {a:0,h:0};\n  const m=t.match(/^([A-Z]{2,4})\\s*([+-]?\\d+(?:\\.\\d+)?)$/i);\n  if(!m)return null;\n  const ab=m[1].toUpperCase(),n=parseFloat(m[2]);\n  if(!isFinite(n))return null;\n  if(ab===home)return {h:n,a:-n};\n  if(ab===away)return {a:n,h:-n};\n  return null;\n}\nasync function fromEspn(gs){\n  const ds=gs.map(gameDate).filter(Boolean).sort();\n  if(!ds.length)return {};\n  const strip=x=>x.replace(/-/g,'');\n  const r=await fetch('/api/scores?dates='+strip(ds[0])+'-'+strip(ds[ds.length-1]));\n  if(!r.ok){note('espn',false,'HTTP '+r.status);throw new Error('espn '+r.status)}\n  const j=await r.json(),ev=j.events||[];\n  const AB={WSH:'WAS',LA:'LAR'},norm=v=>AB[v]||v;\n  const got={};\n  gs.forEach(function(g){\n    const e=ev.filter(function(x){\n      const c=(x.competitions||[])[0];if(!c)return false;\n      const cs=c.competitors||[];\n      const ab=t=>norm((((t.team||{}).abbreviation)||'').toUpperCase());\n      return cs.some(t=>ab(t)===g.a[0])&&cs.some(t=>ab(t)===g.h[0]);\n    })[0];\n    const c=e&&(e.competitions||[])[0], o=c&&(c.odds||[])[0];\n    if(!o)return;\n    const out={};\n    const sp=parseSpread(o.details,g.a[0],g.h[0]);\n    if(sp){const jz=v=>isFinite(Number(v))?Math.round(Number(v)):-110;\n      out.as=sp.a;out.hs=sp.h;\n      out.ao=jz(o.awayTeamOdds&&o.awayTeamOdds.spreadOdds);\n      out.ho=jz(o.homeTeamOdds&&o.homeTeamOdds.spreadOdds);}\n    const am=mlFrom(o,'a'),hm=mlFrom(o,'h');\n    if(am!==null&&hm!==null){out.am=am;out.hm=hm}\n    if(Object.keys(out).length)got[g.id]=out;\n  });\n  const withMl=Object.keys(got).filter(k=>got[k].am!==undefined).length;\n  note('espn',Object.keys(got).length>0,Object.keys(got).length+' of '+gs.length+\n    ' had odds, '+withMl+' with money lines');\n  return got;\n}\n\nasync function poly(forceSlate,ahead){\n  if(!ahead)status('refreshing');\n  let built=null;\n  try{ built=await syncSlate(S.week,forceSlate) }catch(e){ built={err:e.message||'schedule failed'} }\n  const gs=games();\n  if(!gs.length){\n    status(built&&built.err?'could not load the week 1 schedule ('+built.err+')'\n      :'no games listed for this week yet');\n    render();return;\n  }\n  let pm={},es={},notes=[];\n  try{ pm=await fromPolymarket(gs) }\n  catch(e){ note('polymarket',false,e.message||'failed'); notes.push('Polymarket: '+(e.message||'failed')) }\n  try{ es=await fromEspn(gs) }\n  catch(e){ note('espn',false,e.message||'failed'); notes.push('ESPN: '+(e.message||'failed')) }\n  let ml=0,sp=0,der=0;\n  const upd={};\n  gs.forEach(function(g){\n    const L=Object.assign({},W().lines[g.id]||{});\n    let touched=false;\n    const p=pm[g.id],e=es[g.id];\n\n    /* Spread: Polymarket if it published one, otherwise ESPN. */\n    if(p&&p.as!==undefined){L.as=p.as;L.hs=p.hs;L.ao=p.ao;L.ho=p.ho;L.ssrc='polymarket';sp++;touched=true}\n    else if(e&&e.as!==undefined){L.as=e.as;L.hs=e.hs;L.ao=e.ao;L.ho=e.ho;L.ssrc='espn';sp++;touched=true}\n\n    /* Money line: a real market price wins; only if neither feed has one do we\n       derive it from the spread, and then we say so. */\n    if(p&&p.am!==undefined){L.am=p.am;L.hm=p.hm;L.msrc='polymarket';ml++;touched=true}\n    else if(e&&e.am!==undefined){L.am=e.am;L.hm=e.hm;L.msrc='espn';ml++;touched=true}\n    else if(isFinite(Number(L.hs))&&(L.msrc===undefined||L.msrc==='derived')){\n      /* Only fill a gap. A money line already fetched from a market must never\n         be replaced by a derived one just because this refresh could not reach\n         the feed. */\n      const d=mlFromSpread(L.hs);\n      if(d&&(L.am!==d.am||L.hm!==d.hm)){L.am=d.am;L.hm=d.hm;L.msrc='derived';der++;touched=true}\n    }\n    if(!touched)return;\n    L.src='live';L.at=Date.now();\n    upd[g.id]=L;\n  });\n  if(!ml&&!sp&&!der){if(ahead)return;status('could not refresh'+(notes.length?' \\u2014 '+notes.join('; '):'')+\n    ', showing saved lines');return}\n  /* Applied inside the write, not before it. push() re-reads the shared board\n     first, so anything mutated beforehand is discarded -- which is exactly why\n     refreshed lines were reported as saved and never actually were. */\n  await push(function(){\n    const w=W();\n    w.lines=w.lines||{};\n    Object.keys(upd).forEach(function(id){w.lines[id]=upd[id]});\n  });\n  const pmCount=Object.keys(pm).length;\n  if(ahead)return;      // the write above is all the look-ahead needs\n  /* Next week's markets are usually live before this week is played, so price\n     them too. Failures there are silent: this week is what matters. */\n  if(!ahead&&S.week<MAXWK&&games(S.week+1).length){\n    const keep=S.week;\n    S.week=keep+1;\n    try{ await poly(false,true) }catch(e){}\n    S.week=keep;\n  }\n  const head=built&&built.built?built.built+' games loaded, ':'';\n  status(head+sp+' spreads and '+ml+' money lines of '+gs.length+\n    (pmCount?', '+pmCount+' from Polymarket':'')+(der?', '+der+' derived from the spread':'')+\n    (notes.length?' \\u2014 '+notes.join('; '):''),'on');\n}\ndocument.getElementById('refresh').addEventListener('click',function(){poly(true);syncScores(true)});\n\nfunction checkRemoved(){\n  /* Removed mid-session: send them back to the gate rather than let them keep\n     writing picks as somebody no longer on the roster. Never while a join or\n     rename is in flight -- between the roster write and the local identity\n     update you legitimately look absent, and acting on that logs you out\n     mid-join and can push a null name onto the roster. */\n  if(identityBusy)return;\n  if(!me||!S.roster.length)return;\n  if(S.roster.some(r=>r.n===me))return;\n  /* Removed from the roster by a moderator. The session may still be valid, so\n     re-add rather than log out -- the server decides whether that is allowed. */\n  push(function(){if(!S.roster.some(r=>r.n===me))S.roster.push({n:me,p:''})});\n}\n/* Auth. The server is the authority on identity and role -- everything below is\n   presentation. Someone who edits `role` in the console still gets a 403 on the\n   write, because permissions are enforced server-side against the stored state. */\nlet signup=false;\nfunction gateMsg(m,bad){\n  const el=document.getElementById('nameWarn');\n  if(!m)return el.classList.add('hide');\n  el.innerHTML=bad?'<b>'+m+'</b>':m; el.classList.remove('hide');\n}\nfunction setGateMode(su){\n  signup=su;\n  document.getElementById('gateTitle').textContent=su?'Create an account':'Sign in';\n  document.getElementById('gateSub').textContent=su\n    ? 'Pick a name your friends will recognise on the slip.'\n    : 'Your account keeps your picks yours. Nobody else can change them.';\n  document.getElementById('phoneIn').classList.toggle('hide',!su);\n  document.getElementById('pwIn').setAttribute('autocomplete',su?'new-password':'current-password');\n  document.getElementById('join').textContent=su?'Create account':'Sign in';\n  document.getElementById('swapMode').textContent=su\n    ? 'Already have an account? Sign in' : 'New here? Create an account';\n  gateMsg('');\n}\n/* The password never leaves the browser. PBKDF2 runs here, where there is no\n   CPU budget to blow, and only the derived key is sent. */\nconst KDF_ITER=200000;\nconst toB64=b=>btoa(String.fromCharCode.apply(null,new Uint8Array(b)));\nasync function deriveKey(password,saltB64){\n  const salt=new TextEncoder().encode(saltB64);\n  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),\n    'PBKDF2',false,['deriveBits']);\n  return toB64(await crypto.subtle.deriveBits(\n    {name:'PBKDF2',salt:salt,iterations:KDF_ITER,hash:'SHA-256'},key,256));\n}\nconst newSalt=()=>toB64(crypto.getRandomValues(new Uint8Array(18)));\nasync function saltFor(name){\n  const r=await fetch('/api/auth/salt?name='+encodeURIComponent(name),{cache:'no-store'});\n  if(!r.ok)throw new Error('Could not reach the server ('+r.status+')');\n  return (await r.json()).salt;\n}\nasync function authPost(path,body){\n  try{\n    const r=await fetch('/api/auth/'+path,{method:'POST',\n      headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});\n    let j=null,txt='';\n    try{ txt=await r.text(); j=JSON.parse(txt) }catch(e){}\n    /* If the response was not JSON the server failed in a way it could not\n       describe, so surface the status rather than a useless generic line. */\n    if(!j)return {ok:false,status:r.status,\n      body:{error:'Server error '+r.status+(txt?': '+txt.slice(0,120):'')}};\n    return {ok:r.ok,status:r.status,body:j};\n  }catch(e){ return {ok:false,status:0,body:{error:'No connection to the server'}} }\n}\nasync function whoAmI(){\n  try{\n    const r=await fetch('/api/auth/me',{cache:'no-store'});\n    if(!r.ok)return null;\n    const j=await r.json();\n    if(!j.name)return null;\n    me=j.name; role=j.role||'member';\n    return j;\n  }catch(e){ return null }\n}\nasync function signOut(){\n  try{ await fetch('/api/auth/logout',{method:'POST'}) }catch(e){}\n  me=null; role='member';\n  setGateMode(false);\n  document.getElementById('gate').classList.remove('hide');\n  render();\n}\ndocument.getElementById('swapMode').addEventListener('click',function(){setGateMode(!signup)});\ndocument.getElementById('join').addEventListener('click',async function(){\n  const name=document.getElementById('nameIn').value.trim();\n  const pw=document.getElementById('pwIn').value;\n  if(!name||!pw)return gateMsg('Name and password, please',true);\n  const btn=document.getElementById('join');\n  btn.disabled=true; gateMsg(''); identityBusy=true;\n  try{\n    if(signup&&pw.length<6){gateMsg('Password must be at least 6 characters',true);return}\n    gateMsg('Checking\\u2026');\n    let res;\n    if(signup){\n      const salt=newSalt();\n      res=await authPost('register',{name:name,salt:salt,dk:await deriveKey(pw,salt),\n        phone:document.getElementById('phoneIn').value.trim()});\n    }else{\n      const salt=await saltFor(name);\n      res=await authPost('login',{name:name,dk:await deriveKey(pw,salt)});\n    }\n    if(!res.ok){\n      gateMsg(res.body.error||'That did not work',true);\n      if(res.status===409)setGateMode(false);\n      return;\n    }\n    me=res.body.name; role=res.body.role||'member';\n    document.getElementById('pwIn').value='';\n    await push(function(){\n      let i=-1;S.roster.forEach(function(r,k){if(r.n===me)i=k});\n      const ph=document.getElementById('phoneIn').value.trim();\n      if(i<0)S.roster.push({n:me,p:ph});else if(ph)S.roster[i].p=ph;\n    });\n    document.getElementById('gate').classList.add('hide');\n  } finally { identityBusy=false; btn.disabled=false; }\n});\n\nasync function boot(){\n  await pull();\n  const who=await whoAmI();\n  if(who)document.getElementById('gate').classList.add('hide');\n  else {setGateMode(false);document.getElementById('gate').classList.remove('hide')}\n  checkRemoved();render();lastLines=Date.now();\n  loadSeason().then(function(){render();return poly()})\n    .catch(function(){ensureWeek(S.week).then(function(){poly()})});\n  syncScores(false);\n  setInterval(async function(){await pull();checkRemoved();render();maybeSync();maybeLines()},10000);\n  setInterval(whoAmI,120000);   // pick up a role change or a revoked session\n}\n['nameIn','pwIn','phoneIn'].forEach(function(id){\n  document.getElementById(id).addEventListener('keydown',function(e){\n    if(e.key==='Enter')document.getElementById('join').click()})});\nboot();\n</script>\n";

const SESSION_DAYS = 220;
const MAX_FAILS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;
const DK_LEN = 44;                      // base64 of 32 bytes

const J = (o, s, extra) => new Response(JSON.stringify(o), {
  status: s || 200,
  headers: Object.assign(
    { 'content-type': 'application/json', 'cache-control': 'no-store' }, extra || {})
});

const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function sha(str) {
  return b64(await crypto.subtle.digest('SHA-256', enc.encode(str)));
}

/* Constant time, so a wrong key can't be narrowed down by timing. */
function sameHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const token = () => b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, '');
const norm = n => String(n || '').trim();
const keyOf = n => norm(n).toLowerCase();

/* ------------------------- delta authorisation ------------------------- */

const S = v => JSON.stringify(v === undefined ? null : v);

/* The time deadline is enforced here too, not just in the page. It mirrors the
   client: midnight Pacific starting the main slate day -- the date carrying the
   most games. Without this, "locked" would be advisory and a stale tab or a
   crafted request could still write after the cutoff. */
const LOCK_TZ = 'America/Los_Angeles';
function tzOffsetMin(t) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: LOCK_TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = {}; f.formatToParts(new Date(t)).forEach(x => { p[x.type] = x.value; });
  return (Date.UTC(+p.year, +p.month - 1, +p.day,
    p.hour === '24' ? 0 : +p.hour, +p.minute, +p.second) - t) / 60000;
}
function zonedMidnight(dateStr) {
  const p = dateStr.split('-').map(Number);
  const wall = Date.UTC(p[0], p[1] - 1, p[2], 0, 0, 0);
  try { let t = wall; for (let i = 0; i < 2; i++) t = wall - tzOffsetMin(t) * 60000; return t; }
  catch (e) { return wall + 8 * 36e5; }
}
function weekPastDue(w) {
  const dates = (w && w.games || []).map(g => g.d || (g.ko ? String(g.ko).slice(0, 10) : null))
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d || ''));
  if (!dates.length) return false;
  const count = {};
  dates.forEach(d => { count[d] = (count[d] || 0) + 1; });
  const main = Object.keys(count).sort((a, b) => count[b] - count[a] || (a < b ? -1 : 1))[0];
  return Date.now() >= zonedMidnight(main);
}
function gameShut(g) {
  const d = g.d || (g.ko ? String(g.ko).slice(0, 10) : null);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return false;
  return Date.now() >= zonedMidnight(d);
}

/* A leg is only usable if the ticket could have been placed before that game
   came around. The slip counts as "placed" the moment every member has a live
   pick; if a game closes before that, no bet existed to carry it, so the pick
   is voided and that person picks again, and any blackout on it is refunded.
   This runs server-side because one member's browser is not allowed to delete
   another member's pick. */
function reconcile(state) {
  let changed = 0;
  const names = (state.roster || []).map(r => r && r.n).filter(Boolean);
  Object.keys(state.weeks || {}).forEach(wk => {
    const w = state.weeks[wk];
    if (!w) return;
    w.picks = w.picks || {}; w.bo = w.bo || [];
    if (!w.placed && names.length && names.every(n => w.picks[n])) {
      w.placed = Date.now(); changed++;
    }
    /* A parlay is placed at the deadline, not when someone taps, so every leg
       tracks the current line until the week locks and then freezes. Done here
       because a member's browser may not rewrite another member's pick. */
    if (!weekPastDue(w) && !w.locked) {
      const num = v => (v !== null && v !== undefined && v !== '' && isFinite(Number(v))) ? Number(v) : null;
      const reprice = leg => {
        const L = (w.lines || {})[leg.g];
        if (!L) return 0;
        const sp = num(leg.s === 'a' ? L.as : L.hs);
        const pr = leg.t === 'ml' ? num(leg.s === 'a' ? L.am : L.hm) : num(leg.s === 'a' ? L.ao : L.ho);
        const op = leg.t === 'ml' ? num(leg.s === 'a' ? L.hm : L.am) : num(leg.s === 'a' ? L.ho : L.ao);
        if (sp === null || pr === null || op === null) return 0;
        if (leg.sp === sp && leg.pr === pr && leg.op === op) return 0;
        leg.sp = sp; leg.pr = pr; leg.op = op;
        return 1;
      };
      Object.keys(w.picks).forEach(n => { changed += reprice(w.picks[n]); });
      w.bo.forEach(b => { changed += reprice(b); });
    }

    (w.games || []).forEach(g => {
      if (!gameShut(g)) return;
      const d = g.d || (g.ko ? String(g.ko).slice(0, 10) : null);
      const shutAt = zonedMidnight(d);
      if (w.placed && w.placed < shutAt) return;        // the bet was already down
      Object.keys(w.picks).forEach(n => {
        if (w.picks[n].g !== g.id) return;
        w.voided = (w.voided || []).concat([
          { n: n, g: g.id, s: w.picks[n].s, t: w.picks[n].t, at: Date.now() }]);
        delete w.picks[n]; changed++;
      });
      const before = w.bo.length;
      w.bo = w.bo.filter(b => b.g !== g.id);
      if (w.bo.length !== before) changed++;
    });
  });
  return changed;
}

/* Returns null if the change is allowed, otherwise the reason to show. */
function authorize(prev, next, user) {
  if (!prev) return null;                       // first write bootstraps the board
  const who = user.name;

  /* Moderators keep their admin powers after a lock -- fixing scores, removing
     someone, correcting a leg. What they do not get is a later deadline than
     everyone else for their OWN pick, since the moderator is also a player. */
  if (user.role === 'mod') {
    for (const wk of Object.keys(next.weeks || {})) {
      const A = (prev.weeks || {})[wk], B = (next.weeks || {})[wk];
      if (!A || !B) continue;
      if (!weekPastDue(B) && !(A.locked && B.locked)) continue;
      if (S((A.picks || {})[who]) !== S((B.picks || {})[who]))
        return 'That week is locked, even for you';
      if (S((A.bo || []).filter(b => b.by === who)) !== S((B.bo || []).filter(b => b.by === who)))
        return 'That week is locked, even for you';
    }
    return null;
  }

  /* A member may add themselves on sign-up and edit their own phone number,
     and nothing else. Blocking the roster wholesale meant everyone but the
     moderator signed up successfully and then never appeared on the board. */
  if (S(prev.roster) !== S(next.roster)) {
    const before = (prev.roster || []), after = (next.roster || []);
    const others = r => S((r || []).filter(x => x && x.n !== who));
    if (others(before) !== others(after))
      return 'Only a moderator can change other players';
    const mineAfter = after.filter(x => x && x.n === who);
    if (mineAfter.length > 1) return 'Duplicate roster entry';
    if (!mineAfter.length) return 'Only a moderator can remove someone';
    const keys = Object.keys(mineAfter[0]);
    if (keys.some(k => k !== 'n' && k !== 'p'))
      return 'A roster entry holds a name and a number';
  }

  const weeks = new Set([...Object.keys(prev.weeks || {}), ...Object.keys(next.weeks || {})]);
  for (const wk of weeks) {
    const A = (prev.weeks || {})[wk], B = (next.weeks || {})[wk];
    /* Loading the published schedule creates week entries, and any member's
       browser does that. What they may add is a bare slate: games only, no
       picks, no lines, no results. Anything else is still moderator work. */
    if (!A && B) {
      const bare = !Object.keys(B.picks || {}).length
        && !(B.bo || []).length
        && !Object.keys(B.res || {}).length
        && !Object.keys(B.lines || {}).length
        && !B.locked;
      const wellFormed = (B.games || []).length
        && (B.games || []).every(g => g && g.id && Array.isArray(g.a) && Array.isArray(g.h));
      if (!bare || !wellFormed) return 'Only a moderator can add a week';
      continue;
    }
    if (A && !B) return 'Only a moderator can delete a week';
    if (S(A) === S(B)) continue;

    /* Filling in a week that had no games is just loading the schedule, and
       any member's browser may do it. Editing a slate that already exists
       stays with moderators. */
    if (S(A.games) !== S(B.games)) {
      const had = (A.games || []).length;
      if (had) return 'Only a moderator can change the slate';
      if (!(B.games || []).length) return 'Only a moderator can clear the slate';
      const bad = (B.games || []).some(g => !g || !g.id || !Array.isArray(g.a) || !Array.isArray(g.h));
      if (bad) return 'That slate is malformed';
      if (B.lines && S(B.lines) !== S(A.lines || {})) return 'Only a moderator can set lines with a slate';
    }
    if (A.label !== B.label) return 'Only a moderator can name a week';
    if (S(A.res) !== S(B.res)) return 'Only a moderator can change scores';
    if (A.locked !== B.locked) return 'Only a moderator can lock or unlock a week';
    if (A.stake !== B.stake) return 'Only a moderator can change the stake';
    if (A.locked && B.locked) return 'That week is locked';
    if (weekPastDue(B)) return 'Picks for that week are locked';

    if (JSON.stringify(A.voided || []) !== JSON.stringify(B.voided || []))
      return 'The board manages voided picks itself';
    if (A.placed !== B.placed) return 'The board manages the slip itself';

    const myBefore = (A.bo || []).filter(b => b.by === who);
    const myAfter = (B.bo || []).filter(b => b.by === who);
    if (S((A.bo || []).filter(b => b.by !== who)) !== S((B.bo || []).filter(b => b.by !== who)))
      return 'You can only change your own blackout';
    if (myAfter.length > 1) return 'One blackout each per week';

    const added = myAfter.filter(b => !myBefore.some(x => S(x) === S(b)));
    const dropped = myBefore.filter(b => !myAfter.some(x => S(x) === S(b)));
    const hits = sel => added.concat(dropped)
      .some(b => b.g === sel.g && b.s === sel.s && b.t === sel.t);

    const names = new Set([...Object.keys(A.picks || {}), ...Object.keys(B.picks || {})]);
    for (const n of names) {
      const a = (A.picks || {})[n], b = (B.picks || {})[n];
      if (S(a) === S(b)) continue;
      if (n === who) continue;                             // your own leg, always fine
      /* A blackout voids the holder's leg, and undoing one restores it. Both
         touch somebody else's pick, but only for the exact selection involved. */
      if (!b && a && hits(a)) continue;
      if (b && !a && hits(b)) continue;
      return 'You can only change your own pick';
    }
    const mine = (B.picks || {})[who];
    if (mine && JSON.stringify(mine) !== JSON.stringify((A.picks || {})[who])) {
      const g = (B.games || []).filter(x => x.id === mine.g)[0];
      if (g && gameShut(g)) return 'That game has already come around';
    }
    for (const b of added) {
      const g = (B.games || []).filter(x => x.id === b.g)[0];
      if (g && gameShut(g)) return 'That game has already come around';
    }
  }
  return null;
}

/* ------------------------------ the object ----------------------------- */

export class Board {
  constructor(state) { this.state = state; }
  s(k) { return this.state.storage.get(k); }
  p(k, v) { return this.state.storage.put(k, v); }

  async users() { return (await this.s('users')) || {}; }
  async board() { return (await this.s('board')) || { version: 0, value: null }; }

  async session(req) {
    const raw = (req.headers.get('cookie') || '').match(/(?:^|;\s*)sid=([^;]+)/);
    if (!raw) return null;
    const sess = (await this.s('sessions')) || {};
    const s = sess[raw[1]];
    if (!s || s.exp < Date.now()) return null;
    const u = (await this.users())[s.k];
    return u ? { name: u.name, role: u.role, k: s.k } : null;
  }

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const body = req.method === 'POST' || req.method === 'PUT'
      ? await req.json().catch(() => ({})) : {};

    /* ---- accounts ---- */
    /* The client needs the salt before it can derive a key. For an unknown
       name we return a stable fake derived from a server secret, so this
       cannot be used to discover who has an account. */
    if (path === '/auth/salt') {
      const k = keyOf(url.searchParams.get('name'));
      const users = await this.users();
      if (users[k]) return J({ salt: users[k].salt });
      let secret = await this.s('secret');
      if (!secret) { secret = b64(crypto.getRandomValues(new Uint8Array(32))); await this.p('secret', secret); }
      return J({ salt: (await sha(secret + '|' + k)).slice(0, 24) });
    }

    if (path === '/auth/register') {
      const name = norm(body.name), k = keyOf(name);
      const salt = String(body.salt || ''), dk = String(body.dk || '');
      if (name.length < 2 || name.length > 14) return J({ error: 'Name must be 2 to 14 characters' }, 400);
      if (dk.length !== DK_LEN || salt.length < 16) return J({ error: 'Bad sign-up request' }, 400);
      const users = await this.users();
      if (users[k]) return J({ error: 'That name is taken. Sign in instead, or pick another.' }, 409);
      const first = Object.keys(users).length === 0;
      users[k] = { name, salt, hash: await sha(dk), role: first ? 'mod' : 'member',
        phone: norm(body.phone), at: Date.now() };
      await this.p('users', users);
      return this.grant(k, users[k]);
    }

    if (path === '/auth/login') {
      const k = keyOf(body.name), dk = String(body.dk || '');
      const users = await this.users();
      const u = users[k];
      const fails = (await this.s('fails')) || {};
      const f = fails[k];
      if (f && f.n >= MAX_FAILS && Date.now() - f.at < LOCKOUT_MS)
        return J({ error: 'Too many attempts. Try again in a few minutes.' }, 429);
      if (!u) return J({ error: 'No account with that name' }, 401);
      const hash = await sha(dk);
      if (!sameHash(hash, u.hash)) {
        fails[k] = { n: (f && Date.now() - f.at < LOCKOUT_MS ? f.n : 0) + 1, at: Date.now() };
        await this.p('fails', fails);
        return J({ error: 'Wrong password' }, 401);
      }
      delete fails[k]; await this.p('fails', fails);
      return this.grant(k, u);
    }

    if (path === '/auth/me') {
      const u = await this.session(req);
      return J(u ? { name: u.name, role: u.role } : { name: null });
    }

    if (path === '/auth/logout') {
      const raw = (req.headers.get('cookie') || '').match(/(?:^|;\s*)sid=([^;]+)/);
      if (raw) { const s = (await this.s('sessions')) || {}; delete s[raw[1]]; await this.p('sessions', s); }
      return J({ ok: true }, 200, { 'set-cookie': 'sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' });
    }

    /* ---- moderator tools ---- */
    if (path === '/export') {
      const me = await this.session(req);
      if (!me || me.role !== 'mod') return J({ error: 'Moderators only' }, 403);
      const users = await this.users();
      const board = await this.board();
      /* Accounts are listed by name and role only. Password material is never
         exported -- if it were ever restored elsewhere it would be a second
         copy of everyone's credentials sitting in a downloads folder. */
      return J({ exported: new Date().toISOString(), board: board,
        accounts: Object.keys(users).map(k => ({ name: users[k].name, role: users[k].role })) });
    }

    if (path === '/auth/members') {
      const me = await this.session(req);
      if (!me || me.role !== 'mod') return J({ error: 'Moderators only' }, 403);
      const users = await this.users();
      return J({
        members: Object.keys(users).map(k => ({ key: k, name: users[k].name, role: users[k].role }))
      });
    }

    if (path === '/auth/admin') {
      const me = await this.session(req);
      if (!me || me.role !== 'mod') return J({ error: 'Moderators only' }, 403);
      const users = await this.users();
      const k = keyOf(body.name);
      const target = users[k];
      if (!target) return J({ error: 'No such member' }, 404);

      if (body.action === 'role') {
        if (k === me.k) return J({ error: 'You cannot change your own role' }, 400);
        target.role = body.role === 'mod' ? 'mod' : 'member';
        await this.p('users', users);
        return J({ ok: true });
      }
      if (body.action === 'delete') {
        if (k === me.k) return J({ error: 'You cannot delete your own account' }, 400);
        delete users[k];
        await this.p('users', users);
        const sess = (await this.s('sessions')) || {};
        Object.keys(sess).forEach(t => { if (sess[t].k === k) delete sess[t]; });
        await this.p('sessions', sess);      // log them out everywhere at once
        return J({ ok: true });
      }
      if (body.action === 'password') {
        const salt = String(body.salt || ''), dk = String(body.dk || '');
        if (dk.length !== DK_LEN || salt.length < 16) return J({ error: 'Bad reset request' }, 400);
        target.salt = salt; target.hash = await sha(dk);
        await this.p('users', users);
        const sess = (await this.s('sessions')) || {};
        Object.keys(sess).forEach(t => { if (sess[t].k === k) delete sess[t]; });
        await this.p('sessions', sess);          // old sessions die with the old password
        return J({ ok: true });
      }
      return J({ error: 'Unknown action' }, 400);
    }

    /* ---- board state ---- */
    if (path === '/state' && req.method === 'GET') {
      /* Closures are applied on read too, so a board nobody has written to
         still voids a leg the moment that game comes around. */
      const cur = await this.board();
      if (!cur.value) return J(cur);
      let obj; try { obj = JSON.parse(cur.value); } catch (e) { return J(cur); }
      if (reconcile(obj)) {
        const next = { version: cur.version + 1, value: JSON.stringify(obj), at: Date.now() };
        await this.p('board', next);
        return J(next);
      }
      return J(cur);
    }

    if (path === '/state' && req.method === 'PUT') {
      const me = await this.session(req);
      if (!me) return J({ error: 'Log in first' }, 401);
      if (typeof body.value !== 'string') return J({ error: 'value must be a string' }, 400);
      if (body.value.length > 2000000) return J({ error: 'too large' }, 413);

      const cur = await this.board();
      if (typeof body.version === 'number' && body.version !== cur.version)
        return J({ error: 'conflict', version: cur.version, value: cur.value }, 409);

      let prev = null, next = null;
      try { prev = cur.value ? JSON.parse(cur.value) : null; } catch (e) { prev = null; }
      try { next = JSON.parse(body.value); } catch (e) { return J({ error: 'value is not JSON' }, 400); }

      const denied = authorize(prev, next, me);
      if (denied) return J({ error: denied, version: cur.version, value: cur.value }, 403);

      reconcile(next);          // apply closures before storing, not after
      const rec = { version: cur.version + 1, value: JSON.stringify(next), at: Date.now() };
      await this.p('board', rec);
      return J({ version: rec.version });
    }

    /* Scores are fetched outside the object and applied here, so a slow network
       call never holds the lock. */
    if (path === '/apply-scores' && req.method === 'POST') {
      const found = body.found || {};
      const cur = await this.board();
      if (!cur.value) return J({ ok: false, reason: 'no state yet' });
      let obj; try { obj = JSON.parse(cur.value); } catch (e) { return J({ ok: false, reason: 'unparseable' }); }
      let n = 0;
      Object.keys(obj.weeks || {}).forEach(wk => {
        const w = obj.weeks[wk];
        (w.games || []).forEach(g => {
          const f = found[g.a[0] + '@' + g.h[0]];
          if (!f) return;
          w.res = w.res || {};
          if (w.res[g.id] && w.res[g.id].a != null) return;   // never overwrite a hand-entered score
          w.res[g.id] = { a: f.a, h: f.h };
          n++;
        });
      });
      if (n) await this.p('board', { version: cur.version + 1, value: JSON.stringify(obj), at: Date.now() });
      return J({ ok: true, changed: n });
    }

    return J({ error: 'not found' }, 404);
  }

  async grant(k, u) {
    const t = token();
    const sess = (await this.s('sessions')) || {};
    const now = Date.now();
    Object.keys(sess).forEach(x => { if (sess[x].exp < now) delete sess[x]; });
    sess[t] = { k, exp: now + SESSION_DAYS * 864e5 };
    await this.p('sessions', sess);
    return J({ name: u.name, role: u.role }, 200, {
      'set-cookie': 'sid=' + t + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + (SESSION_DAYS * 86400)
    });
  }
}

/* ------------------------------- scores -------------------------------- */

const ESPN_AB = { WSH: 'WAS', LA: 'LAR' };
const gameDate = g => g.d || (g.ko ? String(g.ko).slice(0, 10) : null);

function pending(state) {
  const out = [], now = Date.now();
  Object.keys(state.weeks || {}).forEach(wk => {
    const w = state.weeks[wk];
    (w.games || []).forEach(g => {
      const d = gameDate(g);
      if (!d) return;
      const r = (w.res || {})[g.id];
      if (r && r.a != null && r.h != null) return;
      if (Date.parse(d + 'T00:00:00Z') > now) return;
      out.push({ wk, g, d });
    });
  });
  return out;
}

async function fetchFinals(dates) {
  const strip = s => s.replace(/-/g, '');
  const range = strip(dates[0]) + '-' + strip(dates[dates.length - 1]);
  const r = await proxy(
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=1000&dates=' + range);
  if (!r.ok) throw new Error('espn ' + r.status);
  const j = await r.json();
  const found = {};
  (j.events || []).forEach(e => {
    const c = (e.competitions || [])[0];
    if (!c) return;
    const st = e.status || c.status || {};
    if (!(st.type && st.type.completed)) return;
    const cs = c.competitors || [];
    const home = cs.filter(x => x.homeAway === 'home')[0];
    const away = cs.filter(x => x.homeAway === 'away')[0];
    if (!home || !away) return;
    const ab = t => {
      const v = ((t.team && t.team.abbreviation) || '').toUpperCase();
      return ESPN_AB[v] || v;
    };
    const a = parseInt(away.score, 10), h = parseInt(home.score, 10);
    if (isNaN(a) || isNaN(h)) return;
    found[ab(away) + '@' + ab(home)] = { a, h };
  });
  return found;
}

const stub = env => env.BOARD.get(env.BOARD.idFromName('the-board'));

async function syncScores(env) {
  const s = stub(env);
  const cur = await (await s.fetch('https://do/state')).json();
  if (!cur.value) return { ok: false, reason: 'no state yet' };
  let state; try { state = JSON.parse(cur.value); } catch (e) { return { ok: false, reason: 'unparseable' }; }
  const need = pending(state);
  if (!need.length) return { ok: true, changed: 0, reason: 'nothing pending' };
  const found = await fetchFinals(need.map(n => n.d).sort());
  const r = await s.fetch('https://do/apply-scores', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ found })
  });
  return r.json();
}

/* ESPN's site.api rejects a bare custom User-Agent with 403, and rejects
   browser strings too -- sending Chrome's UA is the one change guaranteed to
   stay blocked. What it accepts is an agent that identifies the client and
   links to it, or a plain library default. We try in that order and remember
   which worked, so a future change on their side shows up in diagnostics
   rather than as an empty board. */
const AGENTS = [
  'parlay-board/1.0 (+https://github.com/parlay-board)',
  'curl/8.7.1',
  'python-requests/2.32.3'
];
let goodAgent = 0;

async function proxy(target) {
  let last = null;
  for (let i = 0; i < AGENTS.length; i++) {
    const ua = AGENTS[(goodAgent + i) % AGENTS.length];
    const r = await fetch(target, {
      headers: { 'user-agent': ua, 'accept': 'application/json' }
    });
    if (r.status !== 403) {
      goodAgent = (goodAgent + i) % AGENTS.length;
      const body = await r.text();
      return new Response(body, {
        status: r.status,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'x-upstream-agent': ua,
          'x-upstream-status': String(r.status)
        }
      });
    }
    last = r;
  }
  return new Response(JSON.stringify({
    error: 'upstream refused every user agent', status: 403, tried: AGENTS
  }), { status: 502, headers: { 'content-type': 'application/json' } });
}

/* Cookies must ride both ways through the Worker to the object. */
function forward(req, path, extraBody) {
  return {
    method: req.method,
    headers: { 'content-type': 'application/json', cookie: req.headers.get('cookie') || '' },
    body: extraBody
  };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    const s = stub(env);

    if (p === '/api/export') {
      return stub(env).fetch('https://do/export', forward(req, p));
    }
    if (p.startsWith('/api/auth/')) {
      const body = req.method === 'POST' ? await req.text() : undefined;
      /* url.search must ride along -- /auth/salt reads ?name= from it, and
         dropping it silently returns the decoy salt for every account. */
      return s.fetch('https://do/auth/' + p.slice('/api/auth/'.length) + url.search,
        forward(req, p, body));
    }
    if (p === '/api/state') {
      const body = req.method === 'PUT' ? await req.text() : undefined;
      return s.fetch('https://do/state', forward(req, p, body));
    }
    if (p === '/api/polymarket') {
      try { return await proxy('https://gamma-api.polymarket.com/events?' + url.searchParams.toString()); }
      catch (e) { return J({ error: String(e) }, 502); }
    }
    /* Week schedule. ESPN keys the regular season as seasontype=2 with a week
       number, which is exactly how the board is organised. */
    if (p === '/api/schedule') {
      const wk = url.searchParams.get('week') || '';
      const yr = url.searchParams.get('year') || '2026';
      if (!/^\d{1,2}$/.test(wk) || !/^\d{4}$/.test(yr)) return J({ error: 'bad week' }, 400);
      try {
        return await proxy('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
          + '?limit=100&dates=' + yr + '&seasontype=2&week=' + wk);
      } catch (e) { return J({ error: String(e) }, 502); }
    }
    /* The full regular season in one request. ESPN keys weeks separately, so
       this fans out server-side and returns a slim shape: eighteen small
       arrays instead of eighteen round trips from every phone. */
    if (p === '/api/season') {
      const yr = url.searchParams.get('year') || '2026';
      if (!/^\d{4}$/.test(yr)) return J({ error: 'bad year' }, 400);
      const weeks = {};
      const errs = [];
      for (let wk = 1; wk <= 18; wk++) {
        try {
          const r = await proxy('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
            + '?limit=100&dates=' + yr + '&seasontype=2&week=' + wk);
          if (!r.ok) { errs.push(wk + ':' + r.status); continue; }
          const j = await r.json();
          const rows = [];
          (j.events || []).forEach(e => {
            const c = (e.competitions || [])[0];
            if (!c) return;
            const cs = c.competitors || [];
            const h = cs.filter(x => x.homeAway === 'home')[0];
            const a = cs.filter(x => x.homeAway === 'away')[0];
            if (!h || !a) return;
            const ab = t => (((t.team || {}).abbreviation) || '').toUpperCase();
            /* The feed carries each club's own logo URL, so pass it through
               rather than guessing a CDN path that could quietly 404. */
            const logo = t => {
              const u = ((t.team || {}).logo) || '';
              return /^https:\/\/[a-z0-9.-]*espncdn\.com\//i.test(u) ? u : '';
            };
            if (!ab(a) || !ab(h)) return;
            rows.push([ab(a), ab(h), e.date || c.date, logo(a), logo(h)]);
          });
          if (rows.length) weeks[wk] = rows;
        } catch (e) { errs.push(wk + ':' + String(e).slice(0, 40)); }
      }
      return J({ year: yr, weeks, errors: errs });
    }
    if (p === '/api/scores') {
      const d = url.searchParams.get('dates') || '';
      if (!/^[\d-]+$/.test(d)) return J({ error: 'bad dates' }, 400);
      try { return await proxy('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=1000&dates=' + d); }
      catch (e) { return J({ error: String(e) }, 502); }
    }
    /* One call that actually exercises the upstreams and reports what came
       back, so a live failure can be read rather than guessed at. */
    if (p === '/api/version') return J({
      build: '2026-09-08k', weeks: 22, slate: 'auto', lines: 'polymarket+espn',
      seeded: false, agents: AGENTS.length
    });
    if (p === '/api/diag') {
      const out = { at: new Date().toISOString(), agents: AGENTS, checks: {} };
      const probe = async (name, url) => {
        const t0 = Date.now();
        try {
          const r = await proxy(url);
          const txt = await r.text();
          let n = null;
          try { const j = JSON.parse(txt); n = Array.isArray(j) ? j.length : (j.events || []).length; }
          catch (e) { n = null; }
          out.checks[name] = { status: r.status, agent: r.headers.get('x-upstream-agent'),
            upstream: r.headers.get('x-upstream-status'), items: n, ms: Date.now() - t0,
            sample: txt.slice(0, 160) };
        } catch (e) { out.checks[name] = { error: String(e), ms: Date.now() - t0 }; }
      };
      await probe('schedule', 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=100&dates=2026&seasontype=2&week=1');
      await probe('scores', 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=100&dates=20260913');
      await probe('polymarket', 'https://gamma-api.polymarket.com/events?limit=50&closed=false&active=true&order=startDate&ascending=false');
      return J(out);
    }
    if (p === '/api/scores/sync') {
      try { return J(await syncScores(env)); } catch (e) { return J({ ok: false, error: String(e) }, 502); }
    }
    return new Response(HTML, { headers: {
      'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }});
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncScores(env).catch(e => console.log('score sync failed', e)));
  }
};

export const _test = { authorize, pending, sha, sameHash, syncScores };
