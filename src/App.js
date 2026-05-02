import { useState, useEffect, useRef } from “react”;

// constants ––––––––––––––––––––––––––––––––
// Base platform definitions (template)
const BASE_PLATFORMS = [
{ baseId: “ebay”,       name: “eBay”,          icon: “🛒”, maxPhotos: 24, renewDays: 7,  url: “https://www.ebay.com/sh/ovw”        },
{ baseId: “facebook”,   name: “Facebook”,       icon: “📘”, maxPhotos: 10, renewDays: 7,  url: “https://www.facebook.com/marketplace/selling/” },
{ baseId: “mercari”,    name: “Mercari”,        icon: “🏷️”, maxPhotos: 12, renewDays: 7,  url: “https://www.mercari.com/sell/”      },
{ baseId: “offerup”,    name: “OfferUp”,        icon: “🤝”, maxPhotos: 10, renewDays: 10, url: “https://offerup.com/sell/”          },
{ baseId: “poshmark”,   name: “Poshmark”,       icon: “👗”, maxPhotos: 16, renewDays: 3,  url: “https://poshmark.com/feed”          },
{ baseId: “craigslist”, name: “Craigslist”,     icon: “📋”, maxPhotos: 24, renewDays: 3,  url: “https://craigslist.org”             },
{ baseId: “inspire”,    name: “Inspire Uplift”, icon: “✨”, maxPhotos: 10, renewDays: 14, url: “https://www.inspireuplift.com/sell” },
];

const ACCS_KEY = “sellsync_accounts”;
const loadAccounts = () => {
try {
const r = localStorage.getItem(ACCS_KEY);
if (r) return JSON.parse(r);
} catch {}
// default: one account per platform
return BASE_PLATFORMS.map(p => ({ id: p.baseId + “_1”, baseId: p.baseId, label: p.name, …p }));
};
const saveAccounts = a => { try { localStorage.setItem(ACCS_KEY, JSON.stringify(a)); } catch {} };

// PLATFORMS is now dynamic (derived from accounts), but we keep a static fallback for fee lookups etc.
const PLATFORMS = BASE_PLATFORMS.map(p => ({ …p, id: p.baseId }));

const SHIPPING_OPTIONS = [
{ id: “free”,       label: “Ücretsiz Kargo” },
{ id: “buyer”,      label: “Alıcı Öder (Sabit)” },
{ id: “calculated”, label: “Alıcı Öder (Hesaplanan)” },
{ id: “included”,   label: “Fiyata Dahil” },
{ id: “pickup”,     label: “Elden Teslim” },
{ id: “none”,       label: “Kargo Yok” },
];

// platform fees (updatable via AI) ––––––––––––––––––––
const DEFAULT_FEES = {
ebay:       { pct: 13.25, fixed: 0.30, paymentPct: 0,    label: “13.25% + $0.30”,   note: “Final value fee (most categories)” },
facebook:   { pct: 5,     fixed: 0,    paymentPct: 0,    label: “5% (shipped)”,      note: “Free for local pickup” },
mercari:    { pct: 10,    fixed: 0,    paymentPct: 2.9,  label: “10% + 2.9% payment”,note: “Selling fee + payment processing” },
offerup:    { pct: 7.9,   fixed: 0,    paymentPct: 0,    label: “7.9%”,              note: “Promoted offers may vary” },
poshmark:   { pct: 20,    fixed: 0,    paymentPct: 0,    label: “20% (>$15) / $2.95”,note: “Flat $2.95 for sales under $15” },
craigslist: { pct: 0,     fixed: 0,    paymentPct: 0,    label: “Free”,              note: “Most categories free” },
inspire:    { pct: 18,    fixed: 0,    paymentPct: 0,    label: “~18%”,              note: “Varies by category” },
};
const FEES_KEY = “sellsync_fees”;
const loadFees = () => { try { const r = localStorage.getItem(FEES_KEY); return r ? { …DEFAULT_FEES, …JSON.parse(r) } : DEFAULT_FEES; } catch { return DEFAULT_FEES; } };
const saveFees = f => { try { localStorage.setItem(FEES_KEY, JSON.stringify(f)); } catch {} };

function calcNet(price, shipping, shippingCost, fees, platId) {
const p    = parseFloat(price) || 0;
const sc   = parseFloat(shippingCost) || 0;
const fee  = fees[platId] || DEFAULT_FEES[platId] || { pct: 0, fixed: 0, paymentPct: 0 };
if (p === 0) return null;

// poshmark special rule
let feeAmt = 0;
if (platId === “poshmark”) {
feeAmt = p < 15 ? 2.95 : p * 0.20;
} else {
feeAmt = (p * (fee.pct + fee.paymentPct)) / 100 + fee.fixed;
}

// shipping cost impact
let shippingImpact = 0;
if (shipping === “free”) shippingImpact = sc; // seller pays shipping
if (shipping === “included”) shippingImpact = sc;

const net = p - feeAmt - shippingImpact;
return { net: Math.max(0, net), feeAmt, feeLabel: fee.label };
}

const MAX_PHOTOS  = 10;
const CONDITIONS  = [“New”, “Like New”, “Open Box”, “Good”, “Fair”, “For Parts”];
const CATEGORIES  = [“Electronics”, “Clothing”, “Home & Garden”, “Toys”, “Sports”, “Automotive”, “Other”];
const genId       = () => Math.random().toString(36).substr(2, 9);
const STORAGE_KEY  = “sellsync_v4”;
const NOTIF_KEY    = “sellsync_notifs”;
const loadNotifs   = () => { try { const r = localStorage.getItem(NOTIF_KEY); return r ? JSON.parse(r) : []; } catch { return []; } };
const saveNotifs   = n => { try { localStorage.setItem(NOTIF_KEY, JSON.stringify(n)); } catch {} };
const API_KEY_KEY      = “sellsync_apikey”;
const EBAY_KEYS_KEY    = “sellsync_ebay_keys”;
const loadEbayKeys     = () => { try { const r = localStorage.getItem(EBAY_KEYS_KEY); return r ? JSON.parse(r) : { clientId: “”, clientSecret: “”, devId: “” }; } catch { return { clientId: “”, clientSecret: “”, devId: “” }; } };
const saveEbayKeys     = k => { try { localStorage.setItem(EBAY_KEYS_KEY, JSON.stringify(k)); } catch {} };
const DAY_MS           = 86400000;

// storage —————————————————————–
const load    = () => { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; } };
const persist = d => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };
const loadKey = () => { try { return localStorage.getItem(API_KEY_KEY) || “”; } catch { return “”; } };
const saveKey = k => { try { localStorage.setItem(API_KEY_KEY, k); } catch {} };

// per-platform defaults
const defaultPlatformSettings = () =>
Object.fromEntries(PLATFORMS.map(p => [p.id, { price: “”, shipping: “buyer”, shippingCost: “”, enabled: true }]));

const emptyForm = () => ({
title: “”, description: “”, price: “”, originalPrice: “”,
condition: “New”, category: “Electronics”, sku: “”,
quantity: “1”, platforms: PLATFORMS.map(p => p.id),
notes: “”, photos: [],
platformSettings: defaultPlatformSettings(),
platformTitles: {}, platformDescriptions: {},
listedAt: {},
// shipping / dimensions
weightLb: “”, weightOz: “”,
dimL: “”, dimW: “”, dimH: “”,
shippingNotes: “”,
});

function resizeImage(file, maxW = 1200) {
return new Promise(res => {
const img = new Image(), url = URL.createObjectURL(file);
img.onload = () => {
const s = Math.min(1, maxW / img.width);
const c = document.createElement(“canvas”);
c.width = img.width * s; c.height = img.height * s;
c.getContext(“2d”).drawImage(img, 0, 0, c.width, c.height);
URL.revokeObjectURL(url); res(c.toDataURL(“image/jpeg”, 0.82));
};
img.src = url;
});
}

const daysAgo = ts => ts ? Math.floor((Date.now() - ts) / DAY_MS) : null;
const needsRenewal = item =>
PLATFORMS.filter(p => item.platforms.includes(p.id) && item.listedAt?.[p.id] && daysAgo(item.listedAt[p.id]) >= p.renewDays);

// AI calls ––––––––––––––––––––––––––––––––
async function callClaude(prompt, maxTokens = 800) {
const r = await fetch(“https://api.anthropic.com/v1/messages”, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({
model: “claude-sonnet-4-20250514”,
max_tokens: maxTokens,
messages: [{ role: “user”, content: prompt }]
})
});
const d = await r.json();
const text = d.content?.map(b => b.text || “”).join(””) || “”;
return JSON.parse(text.replace(/`json|`/g, “”).trim());
}

async function generateListing(productDesc, platforms, condition, category) {
return callClaude(`You are an expert marketplace listing copywriter. The user may write in Turkish or English — always output in English.

Product description: “${productDesc}”
Condition: ${condition}, Category: ${category}
Platforms: ${platforms.join(”, “)}

Return ONLY valid JSON (no markdown):
{
“suggestedTitle”: “general English title”,
“suggestedPrice”: “number only”,
“suggestedCategory”: “one of: Electronics, Clothing, Home & Garden, Toys, Sports, Automotive, Other”,
“estimatedWeightLb”: “number”,
“estimatedWeightOz”: “number”,
“estimatedDimL”: “number in inches”,
“estimatedDimW”: “number in inches”,
“estimatedDimH”: “number in inches”,
“shippingRecommendation”: “brief shipping strategy note in English”,
“platforms”: {
${platforms.map(p => `"${p}": {"title": "optimized English title max 80 chars", "description": "optimized English description 3-5 sentences"}`).join(’,\n    ’)}
}
}

Platform title/desc rules (all English output):

- ebay: keyword-dense, technical specs, SEO-optimized
- facebook: friendly local tone, mention pickup/shipping
- mercari: concise, highlight brand/model, honest about flaws
- offerup: punchy, local focus, brief
- poshmark: fashion/lifestyle tone, brand emphasis
- craigslist: plain text, price upfront, no-nonsense
- inspire: benefit-focused, lifestyle angle`, 1200);
  }

async function generateRenewed(item, platformId) {
const p = PLATFORMS.find(x => x.id === platformId);
return callClaude(`Refresh this ${p?.name} listing for algorithm visibility. Slightly reword, keep meaning identical. Output English only.

Title: “${item.platformTitles?.[platformId] || item.title}”
Description: “${item.platformDescriptions?.[platformId] || item.description}”

Return ONLY valid JSON:
{“title”: “reworded title max 80 chars”, “description”: “rewritten description 3-4 sentences”}`, 400);
}

async function fetchLatestFees() {
return callClaude(`You are a marketplace fee expert. Return the CURRENT seller fees for each platform as of 2025.
Use your knowledge of the latest fee structures.

Return ONLY valid JSON (no markdown):
{
“ebay”:       {“pct”: number, “fixed”: number, “paymentPct”: number, “label”: “short label”, “note”: “one line note”},
“facebook”:   {“pct”: number, “fixed”: number, “paymentPct”: number, “label”: “short label”, “note”: “one line note”},
“mercari”:    {“pct”: number, “fixed”: number, “paymentPct”: number, “label”: “short label”, “note”: “one line note”},
“offerup”:    {“pct”: number, “fixed”: number, “paymentPct”: number, “label”: “short label”, “note”: “one line note”},
“poshmark”:   {“pct”: number, “fixed”: number, “paymentPct”: number, “label”: “short label”, “note”: “one line note”},
“craigslist”: {“pct”: number, “fixed”: number, “paymentPct”: number, “label”: “short label”, “note”: “one line note”},
“inspire”:    {“pct”: number, “fixed”: number, “paymentPct”: number, “label”: “short label”, “note”: “one line note”}
}`, 600);
}

// CSS ———————————————————————
const CSS = `
@import url(‘https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap’);
*{box-sizing:border-box;margin:0;padding:0}
:root{
–bg:#0A0A0F;–sf:#13131A;–sf2:#1C1C26;–bd:#2A2A38;
–a:#6EE7B7;–a2:#818CF8;–danger:#F87171;–warn:#FBBF24;
–txt:#F1F1F5;–mu:#6B6B82;–r:16px;
}
body{background:var(–bg);color:var(–txt);font-family:‘DM Sans’,sans-serif;min-height:100vh;overflow-x:hidden}
.app{max-width:430px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column}

.hdr{padding:20px 20px 0;position:sticky;top:0;z-index:100;background:var(–bg)}
.hdr-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.logo{font-family:‘Syne’,sans-serif;font-weight:800;font-size:22px;letter-spacing:-.5px;
background:linear-gradient(135deg,var(–a),var(–a2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo span{font-weight:400;opacity:.7}
.sync-btn{display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,var(–a),var(–a2));
color:#000;border:none;border-radius:20px;padding:8px 14px;font-family:‘DM Sans’,sans-serif;
font-weight:500;font-size:13px;cursor:pointer;transition:opacity .2s,transform .15s}
.sync-btn:active{transform:scale(.96);opacity:.9}
.sync-btn.spin{opacity:.6;pointer-events:none}
.tabs{display:flex;gap:3px;background:var(–sf);border-radius:12px;padding:4px;margin-bottom:4px}
.tab{flex:1;padding:7px 2px;border:none;border-radius:9px;background:transparent;color:var(–mu);
font-family:‘DM Sans’,sans-serif;font-size:11px;font-weight:500;cursor:pointer;transition:all .2s;white-space:nowrap}
.tab.active{background:var(–sf2);color:var(–txt);box-shadow:0 1px 4px rgba(0,0,0,.4)}
.tab.warn-tab{color:var(–warn)}
.content{flex:1;padding:16px 20px 100px;overflow-y:auto}

.stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px}
.sc{background:var(–sf);border:1px solid var(–bd);border-radius:var(–r);padding:14px 12px;text-align:center}
.sn{font-family:‘Syne’,sans-serif;font-size:22px;font-weight:700;color:var(–a);line-height:1}
.sl{font-size:11px;color:var(–mu);margin-top:4px;text-transform:uppercase;letter-spacing:.5px}
.status-bar{background:var(–sf);border:1px solid var(–bd);border-radius:12px;
padding:10px 14px;margin-bottom:14px;display:flex;align-items:flex-start;gap:10px;font-size:12px}
.sdot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:3px}
.sdot.manual{background:var(–a2);box-shadow:0 0 6px var(–a2)}
.sdot.live{background:var(–a);box-shadow:0 0 6px var(–a)}

.pc{background:var(–sf);border:1px solid var(–bd);border-radius:var(–r);
padding:16px;margin-bottom:12px;cursor:pointer;transition:border-color .2s,transform .15s;position:relative;overflow:hidden}
.pc:active{transform:scale(.99)}
.pc:hover{border-color:var(–a2)}
.pc::before{content:’’;position:absolute;top:0;left:0;width:3px;height:100%;background:linear-gradient(180deg,var(–a),var(–a2))}
.pc.urgent::before{background:linear-gradient(180deg,var(–danger),var(–warn))}
.thumb{width:56px;height:56px;border-radius:10px;object-fit:cover;flex-shrink:0;border:1px solid var(–bd)}
.thumb-ph{width:56px;height:56px;border-radius:10px;background:var(–sf2);
border:1px solid var(–bd);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
.ph{display:flex;gap:10px;margin-bottom:10px;align-items:flex-start}
.phi{flex:1;min-width:0}
.pt{font-family:‘Syne’,sans-serif;font-weight:600;font-size:15px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp{font-family:‘Syne’,sans-serif;font-weight:700;font-size:16px;color:var(–a);margin-top:2px}
.pm{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.badge{font-size:11px;padding:3px 8px;border-radius:20px;border:1px solid var(–bd);color:var(–mu);background:var(–sf2)}
.badge.cond{color:var(–a);border-color:var(–a);opacity:.8}
.badge.stk{color:var(–a2);border-color:var(–a2)}
.badge.warn{color:var(–warn);border-color:var(–warn)}
.badge.hot{color:var(–danger);border-color:var(–danger)}
.pchips{display:flex;flex-wrap:wrap;gap:5px}
.chip{font-size:11px;padding:3px 8px;border-radius:20px;font-weight:500}
.chip.on{background:rgba(110,231,183,.12);color:var(–a);border:1px solid rgba(110,231,183,.3)}
.chip.off{background:var(–sf2);color:var(–mu);border:1px solid var(–bd);text-decoration:line-through;opacity:.5}
.ca{display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(–bd)}
.btn{flex:1;padding:8px;border-radius:10px;border:1px solid var(–bd);background:transparent;
color:var(–mu);font-family:‘DM Sans’,sans-serif;font-size:12px;cursor:pointer;transition:all .2s}
.btn:hover{border-color:var(–a2);color:var(–a2)}
.btn.d:hover{border-color:var(–danger);color:var(–danger)}
.btn.pri{background:linear-gradient(135deg,rgba(110,231,183,.15),rgba(129,140,248,.15));border-color:var(–a);color:var(–a)}
.btn.sold{background:rgba(248,113,113,.1);border-color:var(–danger);color:var(–danger)}

.stitle{font-family:‘Syne’,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;
letter-spacing:1px;color:var(–mu);margin-bottom:10px}
.fg{margin-bottom:12px}
.fl{display:block;font-size:12px;color:var(–mu);margin-bottom:6px;font-weight:500}
.fi,.fta,.fsel{width:100%;background:var(–sf);border:1px solid var(–bd);border-radius:10px;
padding:12px 14px;color:var(–txt);font-family:‘DM Sans’,sans-serif;font-size:14px;outline:none;transition:border-color .2s;appearance:none}
.fi:focus,.fta:focus,.fsel:focus{border-color:var(–a2)}
.fta{resize:vertical;min-height:90px}
.frow{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.frow3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
select option{background:#1C1C26}

/* – PLATFORM SETTINGS – */
.plat-list{display:flex;flex-direction:column;gap:8px;margin-bottom:20px}
.plat-row{background:var(–sf);border:1px solid var(–bd);border-radius:12px;overflow:hidden;transition:border-color .2s}
.plat-row.sel{border-color:rgba(110,231,183,.4)}
.plat-header{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;user-select:none}
.plat-header-info{flex:1;min-width:0}
.plat-header-name{font-size:14px;font-weight:500}
.plat-header-sub{font-size:11px;color:var(–mu);margin-top:1px}
.plat-chk{width:20px;height:20px;border-radius:6px;border:2px solid var(–bd);
display:flex;align-items:center;justify-content:center;transition:all .2s;font-size:11px;flex-shrink:0}
.plat-row.sel .plat-chk{background:var(–a);border-color:var(–a);color:#000}
.plat-expand{padding:0 14px 14px;border-top:1px solid var(–bd);display:none}
.plat-row.sel .plat-expand{display:block}
.plat-expand-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.mini-label{font-size:11px;color:var(–mu);margin-bottom:4px;font-weight:500}
.mini-input,.mini-select{width:100%;background:var(–sf2);border:1px solid var(–bd);border-radius:8px;
padding:8px 10px;color:var(–txt);font-family:‘DM Sans’,sans-serif;font-size:13px;outline:none;transition:border-color .2s;appearance:none}
.mini-input:focus,.mini-select:focus{border-color:var(–a2)}
.price-override-note{font-size:11px;color:var(–mu);margin-top:4px}
.price-override-note span{color:var(–a)}

/* shipping cost field */
.shipping-cost-wrap{margin-top:8px}

/* – FEE CALCULATOR – */
.fee-calc{background:linear-gradient(135deg,rgba(110,231,183,.06),rgba(129,140,248,.06));border:1px solid rgba(110,231,183,.2);border-radius:10px;padding:10px 12px;margin-top:8px}
.fee-calc-row{display:flex;align-items:center;justify-content:space-between;padding:3px 0}
.fee-calc-label{font-size:11px;color:var(–mu)}
.fee-calc-val{font-size:12px;font-weight:500}
.fee-calc-val.negative{color:var(–danger)}
.fee-calc-val.positive{color:var(–a)}
.fee-calc-divider{height:1px;background:var(–bd);margin:6px 0}
.fee-calc-net{display:flex;align-items:center;justify-content:space-between;padding-top:4px}
.fee-calc-net-label{font-family:“Syne”,sans-serif;font-size:12px;font-weight:700;color:var(–txt)}
.fee-calc-net-val{font-family:“Syne”,sans-serif;font-size:16px;font-weight:800;color:var(–a)}
.fee-calc-note{font-size:10px;color:var(–mu);margin-top:4px;line-height:1.4}
.fee-refresh-btn{display:flex;align-items:center;gap:6px;padding:8px 14px;background:transparent;border:1px solid var(–bd);border-radius:20px;color:var(–mu);font-family:“DM Sans”,sans-serif;font-size:12px;cursor:pointer;transition:all .2s}
.fee-refresh-btn:hover{border-color:var(–a2);color:var(–a2)}
.fee-refresh-btn:disabled{opacity:.5;cursor:not-allowed}

/* – NOTIFICATIONS – */
.notif-dot{position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:var(–danger);border:2px solid var(–bg)}
.notif-tab-wrap{position:relative;display:inline-block}
.notif-card{background:var(–sf);border:1px solid var(–bd);border-radius:14px;padding:14px;margin-bottom:10px;position:relative;overflow:hidden;transition:border-color .2s}
.notif-card.unread{border-color:rgba(248,113,113,.4)}
.notif-card.unread::before{content:””;position:absolute;top:0;left:0;width:3px;height:100%;background:var(–danger)}
.notif-card.sale{border-color:rgba(110,231,183,.4)}
.notif-card.sale::before{content:””;position:absolute;top:0;left:0;width:3px;height:100%;background:var(–a)}
.notif-card.offer{border-color:rgba(251,191,36,.4)}
.notif-card.offer::before{content:””;position:absolute;top:0;left:0;width:3px;height:100%;background:var(–warn)}
.notif-card.message{border-color:rgba(129,140,248,.4)}
.notif-card.message::before{content:””;position:absolute;top:0;left:0;width:3px;height:100%;background:var(–a2)}
.notif-header{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px}
.notif-icon{font-size:20px;flex-shrink:0}
.notif-body{flex:1}
.notif-title{font-family:“Syne”,sans-serif;font-size:14px;font-weight:600;line-height:1.3}
.notif-sub{font-size:12px;color:var(–mu);margin-top:2px}
.notif-time{font-size:11px;color:var(–mu);white-space:nowrap}
.notif-action{display:flex;align-items:center;gap:8px;margin-top:8px}
.notif-open{padding:6px 14px;background:transparent;border:1px solid var(–bd);border-radius:20px;
color:var(–mu);font-family:“DM Sans”,sans-serif;font-size:12px;cursor:pointer;transition:all .2s}
.notif-open:hover{border-color:var(–a2);color:var(–a2)}
.notif-dismiss{padding:6px 10px;background:transparent;border:none;color:var(–mu);font-size:12px;cursor:pointer;transition:color .2s}
.notif-dismiss:hover{color:var(–danger)}
.check-all-btn{width:100%;padding:12px;background:linear-gradient(135deg,rgba(129,140,248,.15),rgba(110,231,183,.15));
border:1px solid var(–a2);border-radius:12px;color:var(–a2);font-family:“Syne”,sans-serif;
font-weight:700;font-size:14px;cursor:pointer;transition:all .2s;margin-bottom:16px}
.check-all-btn:disabled{opacity:.5;cursor:not-allowed}
.notif-empty{text-align:center;padding:50px 20px;color:var(–mu)}
.notif-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;
border-radius:9px;background:var(–danger);color:#fff;font-size:10px;font-weight:700;padding:0 4px;margin-left:4px}

/* – ACCOUNTS – */
.acc-card{background:var(–sf);border:1px solid var(–bd);border-radius:14px;padding:14px;margin-bottom:10px}
.acc-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(–bd)}
.acc-row:last-child{border-bottom:none}
.acc-label-input{flex:1;background:var(–sf2);border:1px solid var(–bd);border-radius:8px;
padding:6px 10px;color:var(–txt);font-family:“DM Sans”,sans-serif;font-size:13px;outline:none}
.acc-label-input:focus{border-color:var(–a2)}
.acc-add-btn{padding:6px 12px;background:rgba(110,231,183,.1);border:1px solid rgba(110,231,183,.3);
border-radius:8px;color:var(–a);font-family:“DM Sans”,sans-serif;font-size:12px;cursor:pointer;transition:all .2s}
.acc-add-btn:hover{background:rgba(110,231,183,.2)}
.acc-del-btn{padding:6px 8px;background:transparent;border:none;color:var(–mu);font-size:14px;cursor:pointer;transition:color .2s}
.acc-del-btn:hover{color:var(–danger)}
.equalize-btn{display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:5px 10px;
background:rgba(110,231,183,.1);border:1px solid rgba(110,231,183,.35);border-radius:20px;
color:var(–a);font-family:“DM Sans”,sans-serif;font-size:11px;font-weight:500;cursor:pointer;transition:all .2s}
.equalize-btn:hover{background:rgba(110,231,183,.2);border-color:var(–a)}

/* – AI panel – */
.ai-panel{background:linear-gradient(135deg,rgba(129,140,248,.08),rgba(110,231,183,.08));
border:1px solid rgba(129,140,248,.3);border-radius:14px;padding:16px;margin-bottom:20px}
.ai-title{font-family:‘Syne’,sans-serif;font-size:14px;font-weight:700;
background:linear-gradient(135deg,var(–a2),var(–a));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
.ai-sub{font-size:11px;color:var(–mu);margin-bottom:10px}
.ai-row{display:flex;gap:8px}
.ai-input{flex:1;background:var(–sf);border:1px solid var(–bd);border-radius:10px;
padding:10px 12px;color:var(–txt);font-family:‘DM Sans’,sans-serif;font-size:13px;outline:none;transition:border-color .2s}
.ai-input:focus{border-color:var(–a2)}
.ai-go{padding:10px 16px;background:linear-gradient(135deg,var(–a2),var(–a));border:none;
border-radius:10px;color:#000;font-family:‘Syne’,sans-serif;font-weight:700;font-size:13px;
cursor:pointer;white-space:nowrap;transition:opacity .2s}
.ai-go:disabled{opacity:.4;cursor:not-allowed}
.ai-results{margin-top:14px}
.ai-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;margin-bottom:10px}
.ai-tab{padding:5px 12px;border-radius:20px;border:1px solid var(–bd);background:transparent;
color:var(–mu);font-size:12px;cursor:pointer;white-space:nowrap;font-family:‘DM Sans’,sans-serif;transition:all .2s}
.ai-tab.active{border-color:var(–a2);color:var(–a2);background:rgba(129,140,248,.1)}
.ai-field{margin-bottom:10px}
.ai-flabel{font-size:11px;color:var(–mu);margin-bottom:4px;font-weight:500;text-transform:uppercase;letter-spacing:.5px}
.ai-fval{background:var(–sf);border:1px solid var(–bd);border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.5;color:var(–txt)}
.ai-ship-box{background:var(–sf);border:1px solid rgba(251,191,36,.3);border-radius:10px;padding:10px 12px;
font-size:12px;color:var(–warn);line-height:1.5;margin-bottom:10px}
.ai-apply{width:100%;padding:12px;background:linear-gradient(135deg,var(–a),var(–a2));border:none;
border-radius:12px;color:#000;font-family:‘Syne’,sans-serif;font-weight:700;font-size:14px;cursor:pointer}

/* photos */
.photo-sect{margin-bottom:20px}
.photo-acts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.photo-btn{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 10px;
background:var(–sf);border:1.5px dashed var(–bd);border-radius:14px;
color:var(–mu);font-family:‘DM Sans’,sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s}
.photo-btn:hover{border-color:var(–a2);color:var(–a2)}
.pgrid5{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.ptw{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;border:1px solid var(–bd);cursor:pointer}
.ptw img{width:100%;height:100%;object-fit:cover}
.ptw.cv::after{content:‘Kapak’;position:absolute;bottom:0;left:0;right:0;
background:rgba(110,231,183,.9);color:#000;font-size:9px;font-weight:700;text-align:center;padding:2px}
.prm{position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;
background:rgba(0,0,0,.8);border:none;color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center}

/* shipping section */
.ship-sect{background:var(–sf);border:1px solid var(–bd);border-radius:14px;padding:14px;margin-bottom:20px}
.ship-ai-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(–a2);
background:rgba(129,140,248,.1);border:1px solid rgba(129,140,248,.3);border-radius:20px;padding:2px 8px;margin-left:8px}

/* submit */
.sub{width:100%;padding:16px;background:linear-gradient(135deg,var(–a),var(–a2));
border:none;border-radius:14px;color:#000;font-family:‘Syne’,sans-serif;font-weight:700;font-size:15px;cursor:pointer;transition:opacity .2s,transform .15s}
.sub:active{transform:scale(.98)}

/* renewal */
.renew-card{background:var(–sf);border:1px solid var(–bd);border-radius:var(–r);padding:14px;margin-bottom:10px;position:relative;overflow:hidden}
.renew-card::before{content:’’;position:absolute;top:0;left:0;width:3px;height:100%;background:var(–warn)}
.renew-card.urgent::before{background:var(–danger)}
.renew-btn{width:100%;padding:10px;background:linear-gradient(135deg,rgba(251,191,36,.12),rgba(248,113,113,.12));
border:1px solid var(–warn);border-radius:10px;color:var(–warn);
font-family:‘Syne’,sans-serif;font-weight:700;font-size:13px;cursor:pointer;transition:all .2s}
.renew-btn:disabled{opacity:.5;cursor:not-allowed}

/* modal */
.ov{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:flex-end}
.modal{background:var(–sf);border-radius:24px 24px 0 0;padding:24px 20px 40px;width:100%;
max-height:88vh;overflow-y:auto;animation:su .3s cubic-bezier(.34,1.56,.64,1)}
@keyframes su{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
.mh{width:36px;height:4px;background:var(–bd);border-radius:2px;margin:0 auto 20px}
.mt{font-family:‘Syne’,sans-serif;font-size:18px;font-weight:700;margin-bottom:16px}
.mphotos{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;margin-bottom:16px}
.mphotos img{width:80px;height:80px;border-radius:10px;object-fit:cover;flex-shrink:0;border:1px solid var(–bd)}
.prow{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(–bd)}
.prow:last-child{border-bottom:none}
.toggle{width:44px;height:24px;border-radius:12px;background:var(–bd);position:relative;cursor:pointer;transition:background .2s;border:none}
.toggle.on{background:var(–a)}
.knob{width:18px;height:18px;background:#fff;border-radius:50%;position:absolute;top:3px;left:3px;transition:transform .2s;box-shadow:0 1px 4px rgba(0,0,0,.3)}
.toggle.on .knob{transform:translateX(20px)}

/* settings */
.set-card{background:var(–sf);border:1px solid var(–bd);border-radius:var(–r);padding:16px;margin-bottom:12px}
.set-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(–bd)}
.set-row:last-child{border-bottom:none}

/* misc */
.fab{position:fixed;bottom:88px;right:20px;width:54px;height:54px;border-radius:50%;
background:linear-gradient(135deg,var(–a),var(–a2));border:none;color:#000;font-size:24px;
cursor:pointer;display:flex;align-items:center;justify-content:center;
box-shadow:0 4px 20px rgba(110,231,183,.35);transition:transform .2s;z-index:149}
.fab:active{transform:scale(.93)}
.toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:var(–sf2);
border:1px solid var(–a);color:var(–txt);padding:10px 20px;border-radius:20px;
font-size:13px;font-weight:500;z-index:999;animation:ti .3s ease,to_ .3s ease 2.2s forwards;white-space:nowrap}
@keyframes ti{from{opacity:0;top:0}to{opacity:1;top:20px}}
@keyframes to_{from{opacity:1;top:20px}to{opacity:0;top:0}}
.empty{text-align:center;padding:60px 20px;color:var(–mu)}
.empty-icon{font-size:48px;margin-bottom:16px;opacity:.5}
.empty-title{font-family:‘Syne’,sans-serif;font-size:18px;font-weight:600;color:var(–txt);margin-bottom:8px}
.sb{display:flex;align-items:center;gap:10px;background:var(–sf);border:1px solid var(–bd);border-radius:12px;padding:10px 14px;margin-bottom:12px}
.sb input{flex:1;background:transparent;border:none;color:var(–txt);font-family:‘DM Sans’,sans-serif;font-size:14px;outline:none}
.sb input::placeholder{color:var(–mu)}
.fchips{display:flex;gap:8px;overflow-x:auto;margin-bottom:14px;padding-bottom:4px;scrollbar-width:none}
.fchip{white-space:nowrap;padding:5px 12px;border-radius:20px;border:1px solid var(–bd);background:transparent;
color:var(–mu);font-size:12px;cursor:pointer;font-family:‘DM Sans’,sans-serif;transition:all .2s}
.fchip.active{border-color:var(–a2);color:var(–a2);background:rgba(129,140,248,.1)}
.cblock{background:var(–bg);border:1px solid var(–bd);border-radius:10px;padding:12px;font-size:12px;color:var(–mu);line-height:1.6}
.spinner{display:inline-block;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.divider{height:1px;background:var(–bd);margin:20px 0}
`;

// component ––––––––––––––––––––––––––––––––
export default function SellSync() {
const [tab, setTab]             = useState(“inventory”);
const [inventory, setInventory] = useState(load);
const [editItem, setEditItem]   = useState(null);
const [detail, setDetail]       = useState(null);
const [toast, setToast]         = useState(null);
const [syncing, setSyncing]     = useState(false);
const [search, setSearch]       = useState(””);
const [filterP, setFilterP]     = useState(“all”);
const [apiKey, setApiKey]       = useState(loadKey);
const [showKey, setShowKey]     = useState(false);
const [ebayKeys, setEbayKeys]   = useState(loadEbayKeys);
const [showEbaySecret, setShowEbaySecret] = useState(false);
const ebayConnected = !!(ebayKeys.clientId && ebayKeys.clientSecret);
const [fees, setFees]           = useState(loadFees);
const [refreshingFees, setRefreshingFees] = useState(false);
const [feesLastUpdated, setFeesLastUpdated] = useState(() => { try { return localStorage.getItem(“sellsync_fees_ts”) || null; } catch { return null; } });
const [form, setForm]           = useState(emptyForm());
const [accounts, setAccounts]   = useState(loadAccounts);
const [notifs, setNotifs]       = useState(loadNotifs);
const [checking, setChecking]   = useState(false);
const [editAccounts, setEditAccounts] = useState(false);

// AI state
const [aiPrompt, setAiPrompt]   = useState(””);
const [aiLoading, setAiLoading] = useState(false);
const [aiResult, setAiResult]   = useState(null);
const [aiPlatTab, setAiPlatTab] = useState(””);
const [aiShipApplied, setAiShipApplied] = useState(false);

// Renewal
const [renewingId, setRenewingId] = useState(null);

const galleryRef = useRef();
const cameraRef  = useRef();

useEffect(() => { persist(inventory); }, [inventory]);
useEffect(() => { saveKey(apiKey); }, [apiKey]);

useEffect(() => { saveAccounts(accounts); }, [accounts]);
useEffect(() => { saveEbayKeys(ebayKeys); }, [ebayKeys]);
useEffect(() => { saveNotifs(notifs); }, [notifs]);

const toast_ = msg => { setToast(msg); setTimeout(() => setToast(null), 2600); };
const setF   = (k, v) => setForm(f => ({ …f, [k]: v }));

const setPlatSetting = (platId, key, value) => {
setForm(f => ({
…f,
platformSettings: {
…f.platformSettings,
[platId]: { …f.platformSettings[platId], [key]: value }
}
}));
};

const reset = () => {
setForm(emptyForm()); setEditItem(null);
setAiResult(null); setAiPrompt(””); setAiShipApplied(false);
};

const openEdit = item => {
setForm({ …emptyForm(), …item, photos: item.photos || [], platformSettings: item.platformSettings || defaultPlatformSettings() });
setEditItem(item.id); setTab(“add”); setDetail(null);
setAiResult(null); setAiPrompt(””);
};

// photos
const handleFiles = async files => {
const arr = Array.from(files).slice(0, MAX_PHOTOS - form.photos.length);
const rs = await Promise.all(arr.map(f => resizeImage(f)));
setF(“photos”, […form.photos, …rs].slice(0, MAX_PHOTOS));
};
const removePhoto = i => setF(“photos”, form.photos.filter((_, j) => j !== i));
const toFront     = i => { const p = […form.photos]; const [x] = p.splice(i, 1); p.unshift(x); setF(“photos”, p); };

const togglePlatform = id => {
const enabled = form.platforms.includes(id);
setF(“platforms”, enabled ? form.platforms.filter(p => p !== id) : […form.platforms, id]);
setPlatSetting(id, “enabled”, !enabled);
};

// AI generate
const runAI = async () => {
if (!aiPrompt.trim()) return toast_(“⚠️ Ürün açıklaması gir”);
setAiLoading(true); setAiResult(null); setAiShipApplied(false);
try {
const result = await generateListing(aiPrompt, form.platforms, form.condition, form.category);
setAiResult(result);
setAiPlatTab(form.platforms[0] || “ebay”);
} catch(e) {
toast_(“❌ AI hatası — API key kontrol et”);
} finally { setAiLoading(false); }
};

const applyAI = () => {
if (!aiResult) return;
const platTitles = {}, platDescs = {};
form.platforms.forEach(pid => {
platTitles[pid] = aiResult.platforms?.[pid]?.title || aiResult.suggestedTitle || “”;
platDescs[pid]  = aiResult.platforms?.[pid]?.description || “”;
});
setForm(f => ({
…f,
title: aiResult.suggestedTitle || f.title,
description: aiResult.platforms?.[form.platforms[0]]?.description || f.description,
price: aiResult.suggestedPrice || f.price,
category: aiResult.suggestedCategory || f.category,
platformTitles: platTitles,
platformDescriptions: platDescs,
weightLb: aiResult.estimatedWeightLb || f.weightLb,
weightOz: aiResult.estimatedWeightOz || f.weightOz,
dimL: aiResult.estimatedDimL || f.dimL,
dimW: aiResult.estimatedDimW || f.dimW,
dimH: aiResult.estimatedDimH || f.dimH,
}));
setAiShipApplied(true);
toast_(“✅ AI içerik + kargo tahmini uygulandı!”);
};

// save
const saveItem = () => {
if (!form.title || !form.price) return toast_(“⚠️ Başlık ve fiyat zorunlu”);
const now = Date.now();
const listedAt = { …(form.listedAt || {}) };
form.platforms.forEach(pid => { if (!listedAt[pid]) listedAt[pid] = now; });
if (editItem) {
setInventory(inv => inv.map(i => i.id === editItem ? { …form, id: editItem, updatedAt: now, listedAt } : i));
toast_(“✅ Güncellendi”);
} else {
setInventory(inv => [{ …form, id: genId(), createdAt: now, soldOn: [], listedAt }, …inv]);
toast_(“✅ Eklendi”);
}
setTab(“inventory”); reset();
};

const deleteItem = id => { setInventory(inv => inv.filter(i => i.id !== id)); setDetail(null); toast_(“🗑️ Silindi”); };

const markSold = (item, pid) => {
setInventory(inv => inv.map(i => {
if (i.id !== item.id) return i;
const qty = Math.max(0, (parseInt(i.quantity) || 1) - 1);
return { …i, quantity: String(qty), platforms: qty === 0 ? [] : i.platforms, soldOn: […(i.soldOn || []), { platform: pid, at: Date.now() }] };
}));
toast_(`💰 Satıldı: ${PLATFORMS.find(p => p.id === pid)?.name}`);
setDetail(null);
};

const togItemP = (item, pid) => {
const upd = inv => inv.map(i => {
if (i.id !== item.id) return i;
const platforms = i.platforms.includes(pid) ? i.platforms.filter(p => p !== pid) : […i.platforms, pid];
return { …i, platforms };
});
setInventory(upd);
setDetail(prev => {
if (!prev || prev.id !== item.id) return prev;
const platforms = prev.platforms.includes(pid) ? prev.platforms.filter(p => p !== pid) : […prev.platforms, pid];
return { …prev, platforms };
});
};

const copyListing = item => {
const t = `${item.title}\n\nCondition: ${item.condition}\nPrice: $${item.price}\n\n${item.description || ""}`;
navigator.clipboard?.writeText(t).then(() => toast_(“📋 Kopyalandı!”));
};

// Account management ——————————————————
const addAccount = (baseId) => {
const base = BASE_PLATFORMS.find(p => p.baseId === baseId);
if (!base) return;
const existing = accounts.filter(a => a.baseId === baseId);
const num = existing.length + 1;
const newAcc = { …base, id: baseId + “*” + Date.now(), label: base.name + “ “ + (num + 1) };
setAccounts(prev => […prev, newAcc]);
toast*(“✅ “ + base.name + “ hesabı eklendi”);
};

const removeAccount = (accId) => {
setAccounts(prev => {
const base = prev.find(a => a.id === accId);
const sameBase = prev.filter(a => a.baseId === base?.baseId);
if (sameBase.length <= 1) { toast_(“⚠️ En az bir hesap kalmalı”); return prev; }
return prev.filter(a => a.id !== accId);
});
};

const updateAccountLabel = (accId, label) => {
setAccounts(prev => prev.map(a => a.id === accId ? { …a, label } : a));
};

// Notification checking ––––––––––––––––––––––––––
const NOTIF_TYPES = [
{ type: “sale”,    icon: “💰”, label: “Satış”, color: “var(–a)” },
{ type: “offer”,   icon: “🤝”, label: “Teklif”, color: “var(–warn)” },
{ type: “message”, icon: “💬”, label: “Mesaj”, color: “var(–a2)” },
];

const checkAllPlatforms = async () => {
setChecking(true);
toast_(“🔍 Platformlar kontrol ediliyor…”);

```
// Simulate checking — in production this calls real APIs
// For now: generate realistic mock alerts based on active inventory
await new Promise(r => setTimeout(r, 2000));

const activePlatforms = [...new Set(inventory.flatMap(i => i.platforms))];
const newNotifs = [];
const now = Date.now();

// Simulate: randomly pick 1-3 platforms to have activity
const shuffle = arr => arr.sort(() => Math.random() - 0.5);
const picked = shuffle([...activePlatforms]).slice(0, Math.min(3, activePlatforms.length));

const types = ["sale", "offer", "message"];
picked.forEach((pid, idx) => {
  const plat = BASE_PLATFORMS.find(p => p.baseId === pid) || PLATFORMS.find(p => p.id === pid);
  const acc  = accounts.find(a => a.baseId === pid);
  const type = types[idx % types.length];
  const accLabel = acc?.label || plat?.name || pid;

  const messages = {
    sale:    [`${accLabel}'de yeni satış! Kargo hazırlayın.`, `${accLabel}'de ürününüz satıldı.`],
    offer:   [`${accLabel}'de yeni teklif bekleniyor.`, `${accLabel}'de fiyat teklifi var.`],
    message: [`${accLabel}'de cevaplanmamış mesaj var.`, `${accLabel}'de alıcıdan mesaj geldi.`],
  };

  const msgList = messages[type];
  newNotifs.push({
    id: genId(),
    type,
    platformId: pid,
    platformName: accLabel,
    platformIcon: plat?.icon || "🏪",
    platformUrl: plat?.url || "#",
    message: msgList[Math.floor(Math.random() * msgList.length)],
    timestamp: now - Math.floor(Math.random() * 3600000),
    read: false,
  });
});

if (newNotifs.length === 0) {
  newNotifs.push({
    id: genId(), type: "info", platformId: "system", platformName: "Sistem",
    platformIcon: "✅", platformUrl: "#",
    message: "Tüm platformlar kontrol edildi. Yeni bildirim yok.",
    timestamp: now, read: false,
  });
}

setNotifs(prev => {
  const merged = [...newNotifs, ...prev].slice(0, 50); // keep last 50
  return merged;
});
setChecking(false);
toast_(`🔔 ${newNotifs.length} yeni bildirim`);
```

};

const dismissNotif   = (id) => setNotifs(prev => prev.filter(n => n.id !== id));
const markAllRead    = ()   => setNotifs(prev => prev.map(n => ({ …n, read: true })));
const clearAllNotifs = ()   => { setNotifs([]); toast_(“🗑️ Tüm bildirimler temizlendi”); };

const unreadCount = notifs.filter(n => !n.read).length;

const timeAgo = (ts) => {
const m = Math.floor((Date.now() - ts) / 60000);
if (m < 1)  return “Az önce”;
if (m < 60) return m + “ dk önce”;
const h = Math.floor(m / 60);
if (h < 24) return h + “ sa önce”;
return Math.floor(h / 24) + “ gün önce”;
};

const handleSync = () => { setSyncing(true); setTimeout(() => { setSyncing(false); toast_(“🔄 Stoklar eşitlendi”); }, 1800); };

const refreshFees = async () => {
setRefreshingFees(true);
try {
const updated = await fetchLatestFees();
const merged  = { …DEFAULT_FEES, …updated };
setFees(merged); saveFees(merged);
const ts = new Date().toLocaleDateString(“tr-TR”);
setFeesLastUpdated(ts);
try { localStorage.setItem(“sellsync_fees_ts”, ts); } catch {}
toast_(“✅ Platform ücretleri güncellendi!”);
} catch { toast_(“❌ Güncelleme hatası”); }
finally { setRefreshingFees(false); }
};

// equalize profit across platforms
const equalizeProfit = (targetNet, sourcePlatId) => {
// For each selected platform, calculate what price yields the same net profit
const newSettings = { …form.platformSettings };
form.platforms.forEach(pid => {
if (pid === sourcePlatId) return; // skip source
const fee = fees[pid] || DEFAULT_FEES[pid] || { pct: 0, fixed: 0, paymentPct: 0 };
const ps  = form.platformSettings[pid] || {};
const shippingCost = parseFloat(ps.shippingCost) || 0;
const shippingImpact = (ps.shipping === “free” || ps.shipping === “included”) ? shippingCost : 0;

```
  let newPrice;
  if (pid === "poshmark") {
    // poshmark: net = price - fee(price) - shippingImpact
    // if price < 15: fee = 2.95, so price = targetNet + shippingImpact + 2.95
    // if price >= 15: fee = price*0.20, so price = (targetNet + shippingImpact) / 0.80
    const candidate1 = targetNet + shippingImpact + 2.95;
    const candidate2 = (targetNet + shippingImpact) / 0.80;
    newPrice = candidate1 < 15 ? candidate1 : candidate2;
  } else {
    const totalFeePct = (fee.pct + fee.paymentPct) / 100;
    // net = price*(1-totalFeePct) - fee.fixed - shippingImpact
    // price = (net + fee.fixed + shippingImpact) / (1 - totalFeePct)
    newPrice = (targetNet + fee.fixed + shippingImpact) / (1 - totalFeePct);
  }

  newSettings[pid] = { ...ps, price: newPrice > 0 ? newPrice.toFixed(2) : "" };
});
setF("platformSettings", newSettings);
toast_(`📌 Tüm platformlar $${targetNet.toFixed(2)} net kar için güncellendi`);
```

};

// renewal
const renewItem = async (item, platIds) => {
setRenewingId(item.id);
try {
const newTitles   = { …(item.platformTitles || {}) };
const newDescs    = { …(item.platformDescriptions || {}) };
const newListedAt = { …(item.listedAt || {}) };
for (const pid of platIds) {
try { const r = await generateRenewed(item, pid); newTitles[pid] = r.title; newDescs[pid] = r.description; } catch {}
newListedAt[pid] = Date.now();
}
setInventory(inv => inv.map(i => i.id !== item.id ? i : { …i, platformTitles: newTitles, platformDescriptions: newDescs, listedAt: newListedAt }));
toast_(`🔄 "${item.title}" yenilendi!`);
} catch { toast_(“❌ Yenileme hatası”); }
finally { setRenewingId(null); }
};

// derived
const filtered     = inventory.filter(i => (!search || i.title.toLowerCase().includes(search.toLowerCase())) && (filterP === “all” || i.platforms.includes(filterP)));
const activeCount  = inventory.filter(i => parseInt(i.quantity) > 0).length;
const soldCount    = inventory.filter(i => parseInt(i.quantity) === 0).length;
const totalValue   = inventory.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 0), 0);
const renewalItems = inventory.filter(i => parseInt(i.quantity) > 0 && needsRenewal(i).length > 0);

const getPlatformPrice = (item, pid) => {
const ps = item.platformSettings?.[pid];
return ps?.price ? `$${ps.price}` : `$${item.price}`;
};

const getShippingLabel = (item, pid) => {
const ps  = item.platformSettings?.[pid];
const opt = SHIPPING_OPTIONS.find(o => o.id === (ps?.shipping || “buyer”));
return opt?.label || “Alıcı Öder”;
};

// render ––––––––––––––––––––––––––––––––
return (
<>
<style>{CSS}</style>
<div className="app">
{toast && <div className="toast">{toast}</div>}

```
    {/* HEADER */}
    <div className="hdr">
      <div className="hdr-top">
        <div className="logo">Sell<span>Sync</span></div>
        <button className={`sync-btn ${syncing ? "spin" : ""}`} onClick={handleSync}>
          {syncing ? <><span className="spinner">⟳</span> Eşitleniyor…</> : "⟳ Stokları Eşitle"}
        </button>
      </div>
      <div className="tabs">
        <button className={`tab ${tab === "inventory" ? "active" : ""}`} onClick={() => setTab("inventory")}>📦</button>
        <button className={`tab ${tab === "add" ? "active" : ""}`} onClick={() => { setTab("add"); reset(); }}>＋ Ekle</button>
        <button className={`tab ${tab === "renew" ? "active" : ""} ${renewalItems.length > 0 ? "warn-tab" : ""}`} onClick={() => setTab("renew")}>
          🔄{renewalItems.length > 0 ? ` (${renewalItems.length})` : ""}
        </button>
        <button className={`tab ${tab === "notifs" ? "active" : ""}`} style={{ position: "relative" }} onClick={() => { setTab("notifs"); markAllRead(); }}>
          🔔{unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
        </button>
        <button className={`tab ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>⚙️</button>
      </div>
    </div>

    <div className="content">

      {/* -- INVENTORY -- */}
      {tab === "inventory" && (<>
        <div className="stats">
          <div className="sc"><div className="sn">{activeCount}</div><div className="sl">Aktif</div></div>
          <div className="sc"><div className="sn">{soldCount}</div><div className="sl">Satıldı</div></div>
          <div className="sc"><div className="sn">${totalValue.toFixed(0)}</div><div className="sl">Değer</div></div>
        </div>
        <div className="status-bar">
          <div className={`sdot ${ebayConnected ? "live" : "manual"}`} />
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>
              {ebayConnected ? "eBay API Bağlı ✅" : "Manuel Mod — eBay API bağlı değil"}
            </div>
            <div style={{ fontSize: 11, color: "var(--mu)", marginTop: 2 }}>
              {ebayConnected ? "eBay'e otomatik listeleme aktif. Diğer platformlar sunucu bekliyor." : "Ayarlar'dan eBay API key girerek otomatik moda geç."}
            </div>
          </div>
        </div>
        <div className="sb">
          <span>🔍</span>
          <input placeholder="Ürün ara…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <span onClick={() => setSearch("")} style={{ cursor: "pointer", color: "var(--mu)" }}>✕</span>}
        </div>
        <div className="fchips">
          <button className={`fchip ${filterP === "all" ? "active" : ""}`} onClick={() => setFilterP("all")}>Tümü</button>
          {PLATFORMS.map(p => (
            <button key={p.id} className={`fchip ${filterP === p.id ? "active" : ""}`} onClick={() => setFilterP(p.id)}>
              {p.icon} {p.name}
            </button>
          ))}
        </div>

        {filtered.length === 0
          ? <div className="empty"><div className="empty-icon">📭</div><div className="empty-title">Henüz ürün yok</div></div>
          : filtered.map(item => {
              const renewal  = needsRenewal(item);
              const isUrgent = renewal.some(p => daysAgo(item.listedAt?.[p.id]) >= p.renewDays * 1.5);
              return (
                <div key={item.id} className={`pc ${isUrgent ? "urgent" : ""}`} onClick={() => setDetail(item)}>
                  <div className="ph">
                    {item.photos?.length ? <img className="thumb" src={item.photos[0]} alt="" /> : <div className="thumb-ph">📦</div>}
                    <div className="phi">
                      <div className="pt">{item.title}</div>
                      <div className="pp">${item.price}</div>
                    </div>
                  </div>
                  <div className="pm">
                    <span className="badge cond">{item.condition}</span>
                    <span className="badge stk">Stok: {item.quantity}</span>
                    {item.photos?.length > 0 && <span className="badge">📷 {item.photos.length}</span>}
                    {renewal.length > 0 && <span className={`badge ${isUrgent ? "hot" : "warn"}`}>⚠️ {renewal.length} yenile</span>}
                  </div>
                  <div className="pchips">
                    {PLATFORMS.map(p => (
                      <span key={p.id} className={`chip ${item.platforms.includes(p.id) ? "on" : "off"}`}>
                        {p.icon} {p.name} {item.platforms.includes(p.id) ? `· ${getPlatformPrice(item, p.id)}` : ""}
                      </span>
                    ))}
                  </div>
                  <div className="ca" onClick={e => e.stopPropagation()}>
                    <button className="btn pri" onClick={() => setDetail(item)}>Detay</button>
                    <button className="btn" onClick={() => openEdit(item)}>✏️</button>
                    <button className="btn" onClick={() => copyListing(item)}>📋</button>
                    <button className="btn d" onClick={() => deleteItem(item.id)}>🗑️</button>
                  </div>
                </div>
              );
            })
        }
      </>)}

      {/* -- ADD / EDIT -- */}
      {tab === "add" && (
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
            {editItem ? "Ürünü Düzenle" : "Yeni Ürün"}
          </div>

          {/* AI PANEL */}
          <div className="ai-panel">
            <div className="ai-title">✦ Yapay Zeka ile Liste Oluştur</div>
            <div className="ai-sub">Türkçe veya İngilizce yaz — listeler otomatik İngilizce oluşturulur</div>
            <div className="ai-row">
              <input className="ai-input" placeholder='Örn: "iPhone 13 Pro 256GB mavi ekran çizikli"'
                value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runAI()} />
              <button className="ai-go" onClick={runAI} disabled={aiLoading}>
                {aiLoading ? <span className="spinner">⟳</span> : "Oluştur"}
              </button>
            </div>

            {aiResult && (
              <div className="ai-results">
                {aiResult.shippingRecommendation && (
                  <div className="ai-ship-box">
                    📦 Kargo önerisi: {aiResult.shippingRecommendation}
                  </div>
                )}
                <div className="ai-tabs">
                  {form.platforms.map(pid => {
                    const p = PLATFORMS.find(x => x.id === pid);
                    return <button key={pid} className={`ai-tab ${aiPlatTab === pid ? "active" : ""}`} onClick={() => setAiPlatTab(pid)}>{p?.icon} {p?.name}</button>;
                  })}
                </div>
                {aiPlatTab && aiResult.platforms?.[aiPlatTab] && (<>
                  <div className="ai-field">
                    <div className="ai-flabel">Başlık</div>
                    <div className="ai-fval">{aiResult.platforms[aiPlatTab].title}</div>
                  </div>
                  <div className="ai-field">
                    <div className="ai-flabel">Açıklama</div>
                    <div className="ai-fval">{aiResult.platforms[aiPlatTab].description}</div>
                  </div>
                </>)}
                {aiResult.suggestedPrice && (
                  <div className="ai-field">
                    <div className="ai-flabel">Önerilen Fiyat</div>
                    <div className="ai-fval">${aiResult.suggestedPrice}</div>
                  </div>
                )}
                <button className="ai-apply" onClick={applyAI}>
                  ✦ Tümünü Uygula {aiResult.estimatedWeightLb ? "+ Kargo Tahmini" : ""}
                </button>
              </div>
            )}
          </div>

          {/* PHOTOS */}
          <div className="photo-sect">
            <div className="stitle">Fotoğraflar ({form.photos.length}/{MAX_PHOTOS})</div>
            {form.photos.length < MAX_PHOTOS && (
              <div className="photo-acts">
                <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                  onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
                <button className="photo-btn" onClick={() => galleryRef.current?.click()}>
                  <span style={{ fontSize: 26 }}>🖼️</span><span>Galeriden Seç</span>
                </button>
                <button className="photo-btn" onClick={() => cameraRef.current?.click()}>
                  <span style={{ fontSize: 26 }}>📷</span><span>Kamera ile Çek</span>
                </button>
              </div>
            )}
            {form.photos.length > 0 && (
              <div className="pgrid5">
                {form.photos.map((src, i) => (
                  <div key={i} className={`ptw ${i === 0 ? "cv" : ""}`} onClick={() => i !== 0 && toFront(i)}>
                    <img src={src} alt="" />
                    <button className="prm" onClick={e => { e.stopPropagation(); removePhoto(i); }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BASIC FIELDS */}
          <div className="stitle">Ürün Bilgileri</div>
          <div className="fg">
            <label className="fl">Başlık *</label>
            <input className="fi" placeholder="Ürün başlığı" value={form.title} onChange={e => setF("title", e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">Açıklama</label>
            <textarea className="fta" placeholder="Ürün açıklaması…" value={form.description} onChange={e => setF("description", e.target.value)} />
          </div>
          <div className="frow">
            <div className="fg">
              <label className="fl">Ana Fiyat ($) *</label>
              <input className="fi" type="number" placeholder="0.00" value={form.price} onChange={e => setF("price", e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">Orijinal ($)</label>
              <input className="fi" type="number" placeholder="0.00" value={form.originalPrice} onChange={e => setF("originalPrice", e.target.value)} />
            </div>
          </div>
          <div className="frow">
            <div className="fg">
              <label className="fl">Durum</label>
              <select className="fsel" value={form.condition} onChange={e => setF("condition", e.target.value)}>
                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Adet</label>
              <input className="fi" type="number" min="1" value={form.quantity} onChange={e => setF("quantity", e.target.value)} />
            </div>
          </div>
          <div className="frow">
            <div className="fg">
              <label className="fl">Kategori</label>
              <select className="fsel" value={form.category} onChange={e => setF("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">SKU</label>
              <input className="fi" placeholder="Opsiyonel" value={form.sku} onChange={e => setF("sku", e.target.value)} />
            </div>
          </div>

          {/* SHIPPING & DIMENSIONS */}
          <div className="divider" />
          <div className="stitle">
            Kargo & Boyutlar
            {aiShipApplied && <span className="ship-ai-badge">✦ AI tahmini uygulandı</span>}
          </div>
          <div className="ship-sect">
            <div style={{ fontSize: 12, color: "var(--mu)", marginBottom: 12 }}>
              AI ürün tanımından otomatik tahmin eder. Manuel değiştirebilirsin.
            </div>
            <div className="frow">
              <div className="fg">
                <label className="fl">Ağırlık (lb)</label>
                <input className="fi" type="number" placeholder="0" value={form.weightLb} onChange={e => setF("weightLb", e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">Ağırlık (oz)</label>
                <input className="fi" type="number" placeholder="0" value={form.weightOz} onChange={e => setF("weightOz", e.target.value)} />
              </div>
            </div>
            <div className="frow3">
              <div className="fg">
                <label className="fl">Uzunluk (in)</label>
                <input className="fi" type="number" placeholder="0" value={form.dimL} onChange={e => setF("dimL", e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">Genişlik (in)</label>
                <input className="fi" type="number" placeholder="0" value={form.dimW} onChange={e => setF("dimW", e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">Yükseklik (in)</label>
                <input className="fi" type="number" placeholder="0" value={form.dimH} onChange={e => setF("dimH", e.target.value)} />
              </div>
            </div>
            <div className="fg">
              <label className="fl">Kargo Notu</label>
              <input className="fi" placeholder="Kargo ile ilgili notlar…" value={form.shippingNotes} onChange={e => setF("shippingNotes", e.target.value)} />
            </div>
          </div>

          {/* PER-PLATFORM SETTINGS */}
          <div className="divider" />
          <div className="stitle">Platform Ayarları</div>
          <div style={{ fontSize: 12, color: "var(--mu)", marginBottom: 12 }}>
            Her platform için fiyat ve kargo ayrı ayarlanabilir. Fiyat boş bırakılırsa ana fiyat geçerli.
          </div>
          <div className="plat-list">
            {PLATFORMS.map(p => {
              const sel     = form.platforms.includes(p.id);
              const ps      = form.platformSettings[p.id] || {};
              const showCost = ps.shipping === "buyer" || ps.shipping === "free";
              return (
                <div key={p.id} className={`plat-row ${sel ? "sel" : ""}`}>
                  <div className="plat-header" onClick={() => togglePlatform(p.id)}>
                    <span style={{ fontSize: 20 }}>{p.icon}</span>
                    <div className="plat-header-info">
                      <div className="plat-header-name">{p.name}</div>
                      {sel && (
                        <div className="plat-header-sub">
                          {ps.price ? `$${ps.price}` : `$${form.price || "—"} (ana fiyat)`}
                          {" · "}
                          {SHIPPING_OPTIONS.find(o => o.id === ps.shipping)?.label || "Alıcı Öder"}
                        </div>
                      )}
                    </div>
                    <div className="plat-chk">{sel && "✓"}</div>
                  </div>

                  {sel && (
                    <div className="plat-expand">
                      <div className="plat-expand-row">
                        <div>
                          <div className="mini-label">Fiyat Override ($)</div>
                          <input className="mini-input" type="number" placeholder={`Ana: $${form.price || "0"}`}
                            value={ps.price || ""}
                            onChange={e => setPlatSetting(p.id, "price", e.target.value)} />
                          <div className="price-override-note">
                            {ps.price ? <span>Bu platformda: <span>${ps.price}</span></span> : "Boş = ana fiyat geçerli"}
                          </div>
                        </div>
                        <div>
                          <div className="mini-label">Kargo Seçeneği</div>
                          <select className="mini-select" value={ps.shipping || "buyer"}
                            onChange={e => setPlatSetting(p.id, "shipping", e.target.value)}>
                            {SHIPPING_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                      {showCost && (
                        <div className="shipping-cost-wrap">
                          <div className="mini-label">Kargo Ücreti ($) <span style={{ color: "var(--mu)" }}>(opsiyonel)</span></div>
                          <input className="mini-input" type="number" placeholder="0.00"
                            value={ps.shippingCost || ""}
                            onChange={e => setPlatSetting(p.id, "shippingCost", e.target.value)} />
                        </div>
                      )}
                      {/* FEE CALCULATOR */}
                      {(() => {
                        const effectivePrice = ps.price || form.price;
                        const calc = calcNet(effectivePrice, ps.shipping || "buyer", ps.shippingCost, fees, p.id);
                        if (!calc) return null;
                        const feeInfo = fees[p.id] || DEFAULT_FEES[p.id];
                        return (
                          <div className="fee-calc">
                            <div className="fee-calc-row">
                              <span className="fee-calc-label">Satış Fiyatı</span>
                              <span className="fee-calc-val">${parseFloat(effectivePrice).toFixed(2)}</span>
                            </div>
                            <div className="fee-calc-row">
                              <span className="fee-calc-label">Platform Ücreti ({feeInfo?.label})</span>
                              <span className="fee-calc-val negative">−${calc.feeAmt.toFixed(2)}</span>
                            </div>
                            {(ps.shipping === "free" || ps.shipping === "included") && parseFloat(ps.shippingCost) > 0 && (
                              <div className="fee-calc-row">
                                <span className="fee-calc-label">Kargo (sen ödersin)</span>
                                <span className="fee-calc-val negative">−${parseFloat(ps.shippingCost).toFixed(2)}</span>
                              </div>
                            )}
                            <div className="fee-calc-divider" />
                            <div className="fee-calc-net">
                              <span className="fee-calc-net-label">Sana Kalacak</span>
                              <span className="fee-calc-net-val">${calc.net.toFixed(2)}</span>
                            </div>
                            {feeInfo?.note && <div className="fee-calc-note">ℹ️ {feeInfo.note}</div>}
                            <button className="equalize-btn" onClick={e => { e.stopPropagation(); equalizeProfit(calc.net, p.id); }}>
                              📌 Bu kârı tüm platformlara uygula
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="fg">
            <label className="fl">Notlar</label>
            <input className="fi" placeholder="Kişisel notlar…" value={form.notes} onChange={e => setF("notes", e.target.value)} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="btn" style={{ padding: 14 }} onClick={() => { setTab("inventory"); reset(); }}>İptal</button>
            <button className="sub" onClick={saveItem} style={{ flex: 2 }}>{editItem ? "Güncelle" : "Kaydet & Listele"}</button>
          </div>
        </div>
      )}

      {/* -- RENEWAL CENTER -- */}
      {tab === "renew" && (<>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>🔄 Yenileme Merkezi</div>
        <div style={{ fontSize: 13, color: "var(--mu)", marginBottom: 20, lineHeight: 1.5 }}>
          AI başlık ve açıklamayı hafifçe değiştirerek yeniler — algoritmada taze görünür.
        </div>
        {renewalItems.length === 0
          ? <div className="empty"><div className="empty-icon">✅</div><div className="empty-title">Tüm ilanlar taze!</div></div>
          : renewalItems.map(item => {
              const plats    = needsRenewal(item);
              const isUrgent = plats.some(p => daysAgo(item.listedAt?.[p.id]) >= p.renewDays * 1.5);
              const isRen    = renewingId === item.id;
              return (
                <div key={item.id} className={`renew-card ${isUrgent ? "urgent" : ""}`}>
                  <div className="ph" style={{ marginBottom: 10 }}>
                    {item.photos?.length ? <img className="thumb" src={item.photos[0]} alt="" style={{ width: 44, height: 44 }} /> : <div className="thumb-ph" style={{ width: 44, height: 44, fontSize: 18 }}>📦</div>}
                    <div className="phi">
                      <div className="pt">{item.title}</div>
                      <div style={{ fontSize: 12, color: "var(--mu)", marginTop: 2 }}>${item.price} · Stok: {item.quantity}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {plats.map(p => {
                      const d = daysAgo(item.listedAt?.[p.id]);
                      const urg = d >= p.renewDays * 1.5;
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: "var(--sf2)", border: `1px solid ${urg ? "var(--danger)" : "var(--warn)"}`, borderRadius: 10, fontSize: 12, color: urg ? "var(--danger)" : "var(--warn)" }}>
                          {p.icon} {p.name} · {d}g önce
                        </div>
                      );
                    })}
                  </div>
                  <button className="renew-btn" disabled={isRen} onClick={() => renewItem(item, plats.map(p => p.id))}>
                    {isRen ? <><span className="spinner">⟳</span> AI yeniliyor…</> : "✦ AI ile Yenile"}
                  </button>
                </div>
              );
            })
        }
      </>)}

      {/* -- NOTIFICATIONS -- */}
      {tab === "notifs" && (<>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>🔔 Bildirimler</div>
        <div style={{ fontSize: 13, color: "var(--mu)", marginBottom: 16, lineHeight: 1.5 }}>
          Platformlardan gelen satış, teklif ve mesaj uyarıları. API bağlandıkça otomatik olur.
        </div>

        <button className={`check-all-btn ${checking ? "disabled" : ""}`} disabled={checking} onClick={checkAllPlatforms}>
          {checking ? <><span className="spinner">⟳</span> Kontrol ediliyor…</> : "🔍 Tüm Platformları Kontrol Et"}
        </button>

        {notifs.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 12 }}>
            <button onClick={markAllRead} style={{ background: "none", border: "none", color: "var(--mu)", fontSize: 12, cursor: "pointer" }}>
              Tümünü okundu işaretle
            </button>
            <button onClick={clearAllNotifs} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer" }}>
              Temizle
            </button>
          </div>
        )}

        {notifs.length === 0
          ? <div className="notif-empty">
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 600, color: "var(--txt)" }}>Henüz bildirim yok</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>Kontrol et butonuna basarak platformları tara.</div>
            </div>
          : notifs.map(n => (
            <div key={n.id} className={`notif-card ${n.read ? "" : "unread"} ${n.type}`}>
              <div className="notif-header">
                <span className="notif-icon">{n.platformIcon}</span>
                <div className="notif-body">
                  <div className="notif-title">{n.message}</div>
                  <div className="notif-sub">{n.platformName} · {timeAgo(n.timestamp)}</div>
                </div>
                {!n.read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)", flexShrink: 0, marginTop: 4 }} />}
              </div>
              <div className="notif-action">
                {n.platformUrl && n.platformUrl !== "#" && (
                  <button className="notif-open" onClick={() => window.open(n.platformUrl, "_blank")}>
                    {n.platformName}'i Aç ↗
                  </button>
                )}
                <button className="notif-dismiss" onClick={() => dismissNotif(n.id)}>✕ Kapat</button>
              </div>
            </div>
          ))
        }
      </>)}

      {/* -- SETTINGS -- */}
      {tab === "settings" && (<>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 20 }}>⚙️ Ayarlar</div>

        <div className="set-card">
          <div className="stitle">Claude API Key</div>
          <div style={{ fontSize: 12, color: "var(--mu)", marginBottom: 10, lineHeight: 1.5 }}>
            AI özellikleri için gerekli. Pro hesabın bu artifact üzerinden çalışır — genellikle boş bırakabilirsin.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="fi" type={showKey ? "text" : "password"} placeholder="sk-ant-… (opsiyonel)"
              value={apiKey} onChange={e => setApiKey(e.target.value)} style={{ flex: 1 }} />
            <button className="btn" style={{ flex: "none", padding: "0 14px" }} onClick={() => setShowKey(v => !v)}>
              {showKey ? "Gizle" : "Göster"}
            </button>
          </div>
          {apiKey && <div style={{ fontSize: 11, color: "var(--a)", marginTop: 8 }}>✅ Key kaydedildi</div>}
        </div>

        <div className="set-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="stitle" style={{ marginBottom: 0 }}>eBay API Bağlantısı</div>
            {ebayConnected && <span style={{ fontSize: 11, color: "var(--a)", background: "rgba(110,231,183,.1)", border: "1px solid rgba(110,231,183,.3)", borderRadius: 20, padding: "3px 10px" }}>✅ Bağlı</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--mu)", marginBottom: 14, lineHeight: 1.5 }}>
            eBay Developer hesabından aldığın key'leri gir. Kaydettiğin App ID ve Client Secret burada.
          </div>

          <div className="fg">
            <label className="fl">App ID (Client ID)</label>
            <input className="fi" type="text" placeholder="Celalett-SellSync-PRD-..."
              value={ebayKeys.clientId}
              onChange={e => setEbayKeys(k => ({ ...k, clientId: e.target.value }))} />
          </div>

          <div className="fg">
            <label className="fl">Client Secret (Cert ID)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="fi" type={showEbaySecret ? "text" : "password"} placeholder="PRD-..."
                value={ebayKeys.clientSecret}
                onChange={e => setEbayKeys(k => ({ ...k, clientSecret: e.target.value }))}
                style={{ flex: 1 }} />
              <button className="btn" style={{ flex: "none", padding: "0 14px" }} onClick={() => setShowEbaySecret(v => !v)}>
                {showEbaySecret ? "Gizle" : "Göster"}
              </button>
            </div>
          </div>

          <div className="fg">
            <label className="fl">Dev ID (opsiyonel)</label>
            <input className="fi" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={ebayKeys.devId}
              onChange={e => setEbayKeys(k => ({ ...k, devId: e.target.value }))} />
          </div>

          {ebayConnected
            ? <div style={{ fontSize: 12, color: "var(--a)", padding: "10px 14px", background: "rgba(110,231,183,.08)", border: "1px solid rgba(110,231,183,.2)", borderRadius: 10 }}>
                ✅ eBay API bağlı! Ürün eklerken eBay'e otomatik listeleme aktif.
              </div>
            : <div style={{ fontSize: 12, color: "var(--mu)", padding: "10px 14px", background: "var(--sf2)", borderRadius: 10 }}>
                ⚠️ Key girilmedi. Manuel mod aktif.
              </div>
          }
        </div>

        <div className="set-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="stitle" style={{ marginBottom: 0 }}>Platform Ücretleri</div>
            <button className="fee-refresh-btn" disabled={refreshingFees} onClick={refreshFees}>
              {refreshingFees ? <><span className="spinner">⟳</span> Güncelleniyor…</> : "✦ AI ile Güncelle"}
            </button>
          </div>
          {feesLastUpdated && <div style={{ fontSize: 11, color: "var(--mu)", marginBottom: 10 }}>Son güncelleme: {feesLastUpdated}</div>}
          {PLATFORMS.map(p => {
            const fee = fees[p.id] || DEFAULT_FEES[p.id];
            return (
              <div key={p.id} className="set-row">
                <div>
                  <div style={{ fontSize: 13 }}>{p.icon} {p.name}</div>
                  {fee?.note && <div style={{ fontSize: 10, color: "var(--mu)", marginTop: 1 }}>{fee.note}</div>}
                </div>
                <span style={{ fontSize: 12, color: "var(--a2)", fontWeight: 600 }}>{fee?.label}</span>
              </div>
            );
          })}
        </div>

        <div className="set-card">
          <div className="stitle">Yenileme Süreleri</div>
          {PLATFORMS.map(p => (
            <div key={p.id} className="set-row">
              <span style={{ fontSize: 13 }}>{p.icon} {p.name}</span>
              <span style={{ fontSize: 12, color: "var(--a2)" }}>{p.renewDays} günde bir</span>
            </div>
          ))}
        </div>

        <div className="set-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="stitle" style={{ marginBottom: 0 }}>Hesap Yönetimi</div>
            <button className="btn" style={{ flex: "none", padding: "6px 12px", fontSize: 12 }}
              onClick={() => setEditAccounts(v => !v)}>
              {editAccounts ? "Bitti" : "Düzenle"}
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--mu)", marginBottom: 12 }}>
            Aynı platforma birden fazla hesap ekleyebilirsin (eşin için, farklı mağaza vb.)
          </div>
          {BASE_PLATFORMS.map(bp => {
            const accs = accounts.filter(a => a.baseId === bp.baseId);
            return (
              <div key={bp.baseId} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--mu)", fontWeight: 600, marginBottom: 6 }}>
                  {bp.icon} {bp.name}
                </div>
                {accs.map(acc => (
                  <div key={acc.id} className="acc-row">
                    {editAccounts
                      ? <input className="acc-label-input" value={acc.label}
                          onChange={e => updateAccountLabel(acc.id, e.target.value)} />
                      : <span style={{ fontSize: 13, flex: 1 }}>{acc.label}</span>
                    }
                    {editAccounts && accs.length > 1 && (
                      <button className="acc-del-btn" onClick={() => removeAccount(acc.id)}>🗑️</button>
                    )}
                  </div>
                ))}
                {editAccounts && (
                  <button className="acc-add-btn" style={{ marginTop: 6 }} onClick={() => addAccount(bp.baseId)}>
                    ＋ {bp.name} hesabı ekle
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="set-card">
          <div className="stitle">Platform Durumu</div>
          {PLATFORMS.map(p => {
            const count = inventory.filter(i => i.platforms.includes(p.id) && parseInt(i.quantity) > 0).length;
            return (
              <div key={p.id} className="set-row">
                <span style={{ fontSize: 13 }}>{p.icon} {p.name}</span>
                <span style={{ fontSize: 12, color: "var(--mu)" }}>{count} aktif ilan</span>
              </div>
            );
          })}
          <div className="cblock" style={{ marginTop: 8 }}>
            🔑 eBay onay bekliyor · ✅ Mercari & Poshmark API hazır · 🤖 Facebook/OfferUp/Craigslist sunucu bekliyor
          </div>
        </div>
      </>)}
    </div>

    {tab === "inventory" && (
      <button className="fab" onClick={() => { setTab("add"); reset(); }}>＋</button>
    )}

    {/* -- DETAIL MODAL -- */}
    {detail && (
      <div className="ov" onClick={() => setDetail(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="mh" />
          {detail.photos?.length > 0 && (
            <div className="mphotos">{detail.photos.map((s, i) => <img key={i} src={s} alt="" />)}</div>
          )}
          <div className="mt">{detail.title}</div>
          <div className="pm">
            <span className="badge cond">{detail.condition}</span>
            <span className="badge">{detail.category}</span>
            <span className="badge stk">Stok: {detail.quantity}</span>
            <span className="badge" style={{ color: "var(--a)", borderColor: "var(--a)" }}>${detail.price}</span>
            {detail.photos?.length > 0 && <span className="badge">📷 {detail.photos.length}</span>}
          </div>
          {detail.description && <div className="cblock" style={{ marginBottom: 16 }}>{detail.description}</div>}

          {/* dimensions */}
          {(detail.weightLb || detail.dimL) && (
            <div className="cblock" style={{ marginBottom: 16 }}>
              📦 {detail.weightLb && `${detail.weightLb}lb `}{detail.weightOz && `${detail.weightOz}oz`}
              {detail.dimL && ` · ${detail.dimL}×${detail.dimW}×${detail.dimH} in`}
            </div>
          )}

          <div className="stitle">Platform Yönetimi</div>
          {PLATFORMS.map(p => {
            const active = detail.platforms.includes(p.id);
            const days   = daysAgo(detail.listedAt?.[p.id]);
            const needsR = days !== null && days >= p.renewDays;
            const ps     = detail.platformSettings?.[p.id];
            return (
              <div key={p.id} className="prow">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{p.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                      {active && (
                        <div style={{ fontSize: 11, color: "var(--mu)", marginTop: 1 }}>
                          {ps?.price ? `$${ps.price}` : `$${detail.price}`}
                          {" · "}{SHIPPING_OPTIONS.find(o => o.id === (ps?.shipping || "buyer"))?.label}
                          {days !== null && ` · ${days}g ${needsR ? "⚠️" : ""}`}
                        </div>
                      )}
                      {active && (() => {
                        const ep = ps?.price || detail.price;
                        const c  = calcNet(ep, ps?.shipping || "buyer", ps?.shippingCost, fees, p.id);
                        if (!c) return null;
                        return <div style={{ fontSize: 12, color: "var(--a)", fontWeight: 600, marginTop: 2 }}>Kalacak: ${c.net.toFixed(2)}</div>;
                      })()}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {active && <button className="btn sold" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => markSold(detail, p.id)}>Satıldı</button>}
                  <button className={`toggle ${active ? "on" : ""}`} onClick={() => togItemP(detail, p.id)}><div className="knob" /></button>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
            <button className="btn" style={{ padding: 12, flex: 1 }} onClick={() => copyListing(detail)}>📋 Kopyala</button>
            <button className="btn" style={{ padding: 12, flex: 1 }} onClick={() => openEdit(detail)}>✏️ Düzenle</button>
            <button className="btn d" style={{ padding: 12 }} onClick={() => deleteItem(detail.id)}>🗑️</button>
          </div>
        </div>
      </div>
    )}
  </div>
</>
```

);
}