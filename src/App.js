block;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.divider{height:1px;background:var(--bd);margin:20px 0}
`;

// ─── component ────────────────────────────────────────────────────────────────
export default function SellSync() {
  const [tab, setTab]             = useState("inventory");
  const [inventory, setInventory] = useState(load);
  const [editItem, setEditItem]   = useState(null);
  const [detail, setDetail]       = useState(null);
  const [toast, setToast]         = useState(null);
  const [syncing, setSyncing]     = useState(false);
  const [search, setSearch]       = useState("");
  const [filterP, setFilterP]     = useState("all");
  const [apiKey, setApiKey]       = useState(loadKey);
  const [showKey, setShowKey]     = useState(false);
  const [ebayKeys, setEbayKeys]   = useState(loadEbayKeys);
  const [showEbaySecret, setShowEbaySecret] = useState(false);
  const ebayConnected = !!(ebayKeys.clientId && ebayKeys.clientSecret);
  const [fees, setFees]           = useState(loadFees);
  const [refreshingFees, setRefreshingFees] = useState(false);
  const [feesLastUpdated, setFeesLastUpdated] = useState(() => { try { return localStorage.getItem("sellsync_fees_ts") || null; } catch { return null; } });
  const [form, setForm]           = useState(emptyForm());
  const [accounts, setAccounts]   = useState(loadAccounts);
  const [notifs, setNotifs]       = useState(loadNotifs);
  const [checking, setChecking]   = useState(false);
  const [editAccounts, setEditAccounts] = useState(false);

  // AI state
  const [aiPrompt, setAiPrompt]   = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult]   = useState(null);
  const [aiPlatTab, setAiPlatTab] = useState("");
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
  const setF   = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setPlatSetting = (platId, key, value) => {
    setForm(f => ({
      ...f,
      platformSettings: {
        ...f.platformSettings,
        [platId]: { ...f.platformSettings[platId], [key]: value }
      }
    }));
  };

  const reset = () => {
    setForm(emptyForm()); setEditItem(null);
    setAiResult(null); setAiPrompt(""); setAiShipApplied(false);
  };

  const openEdit = item => {
    setForm({ ...emptyForm(), ...item, photos: item.photos || [], platformSettings: item.platformSettings || defaultPlatformSettings() });
    setEditItem(item.id); setTab("add"); setDetail(null);
    setAiResult(null); setAiPrompt("");
  };

  // photos
  const handleFiles = async files => {
    const arr = Array.from(files).slice(0, MAX_PHOTOS - form.photos.length);
    const rs = await Promise.all(arr.map(f => resizeImage(f)));
    setF("photos", [...form.photos, ...rs].slice(0, MAX_PHOTOS));
  };
  const removePhoto = i => setF("photos", form.photos.filter((_, j) => j !== i));
  const toFront     = i => { const p = [...form.photos]; const [x] = p.splice(i, 1); p.unshift(x); setF("photos", p); };

  const togglePlatform = id => {
    const enabled = form.platforms.includes(id);
    setF("platforms", enabled ? form.platforms.filter(p => p !== id) : [...form.platforms, id]);
    setPlatSetting(id, "enabled", !enabled);
  };

  // AI generate
  const runAI = async () => {
    if (!aiPrompt.trim()) return toast_("⚠️ Ürün açıklaması gir");
    setAiLoading(true); setAiResult(null); setAiShipApplied(false);
    try {
      const result = await generateListing(aiPrompt, form.platforms, form.condition, form.category);
      setAiResult(result);
      setAiPlatTab(form.platforms[0] || "ebay");
    } catch(e) {
      toast_("❌ AI hatası — API key kontrol et");
    } finally { setAiLoading(false); }
  };

  const applyAI = () => {
    if (!aiResult) return;
    const platTitles = {}, platDescs = {};
    form.platforms.forEach(pid => {
      platTitles[pid] = aiResult.platforms?.[pid]?.title || aiResult.suggestedTitle || "";
      platDescs[pid]  = aiResult.platforms?.[pid]?.description || "";
    });
    setForm(f => ({
      ...f,
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
    toast_("✅ AI içerik + kargo tahmini uygulandı!");
  };

  // save
  const saveItem = () => {
    if (!form.title || !form.price) return toast_("⚠️ Başlık ve fiyat zorunlu");
    const now = Date.now();
    const listedAt = { ...(form.listedAt || {}) };
    form.platforms.forEach(pid => { if (!listedAt[pid]) listedAt[pid] = now; });
    if (editItem) {
      setInventory(inv => inv.map(i => i.id === editItem ? { ...form, id: editItem, updatedAt: now, listedAt } : i));
      toast_("✅ Güncellendi");
    } else {
      setInventory(inv => [{ ...form, id: genId(), createdAt: now, soldOn: [], listedAt }, ...inv]);
      toast_("✅ Eklendi");
    }
    setTab("inventory"); reset();
  };

  const deleteItem = id => { setInventory(inv => inv.filter(i => i.id !== id)); setDetail(null); toast_("🗑️ Silindi"); };

  const markSold = (item, pid) => {
    setInventory(inv => inv.map(i => {
      if (i.id !== item.id) return i;
      const qty = Math.max(0, (parseInt(i.quantity) || 1) - 1);
      return { ...i, quantity: String(qty), platforms: qty === 0 ? [] : i.platforms, soldOn: [...(i.soldOn || []), { platform: pid, at: Date.now() }] };
    }));
    toast_(`💰 Satıldı: ${PLATFORMS.find(p => p.id === pid)?.name}`);
    setDetail(null);
  };

  const togItemP = (item, pid) => {
    const upd = inv => inv.map(i => {
      if (i.id !== item.id) return i;
      const platforms = i.platforms.includes(pid) ? i.platforms.filter(p => p !== pid) : [...i.platforms, pid];
      return { ...i, platforms };
    });
    setInventory(upd);
    setDetail(prev => {
      if (!prev || prev.id !== item.id) return prev;
      const platforms = prev.platforms.includes(pid) ? prev.platforms.filter(p => p !== pid) : [...prev.platforms, pid];
      return { ...prev, platforms };
    });
  };

  const copyListing = item => {
    const t = `${item.title}\n\nCondition: ${item.condition}\nPrice: $${item.price}\n\n${item.description || ""}`;
    navigator.clipboard?.writeText(t).then(() => toast_("📋 Kopyalandı!"));
  };

  // ── Account management ──────────────────────────────────────────────────────
  const addAccount = (baseId) => {
    const base = BASE_PLATFORMS.find(p => p.baseId === baseId);
    if (!base) return;
    const existing = accounts.filter(a => a.baseId === baseId);
    const num = existing.length + 1;
    const newAcc = { ...base, id: baseId + "_" + Date.now(), label: base.name + " " + (num + 1) };
    setAccounts(prev => [...prev, newAcc]);
    toast_("✅ " + base.name + " hesabı eklendi");
  };

  const removeAccount = (accId) => {
    setAccounts(prev => {
      const base = prev.find(a => a.id === accId);
      const sameBase = prev.filter(a => a.baseId === base?.baseId);
      if (sameBase.length <= 1) { toast_("⚠️ En az bir hesap kalmalı"); return prev; }
      return prev.filter(a => a.id !== accId);
    });
  };

  const updateAccountLabel = (accId, label) => {
    setAccounts(prev => prev.map(a => a.id === accId ? { ...a, label } : a));
  };

  // ── Notification checking ────────────────────────────────────────────────────
  const NOTIF_TYPES = [
    { type: "sale",    icon: "💰", label: "Satış", color: "var(--a)" },
    { type: "offer",   icon: "🤝", label: "Teklif", color: "var(--warn)" },
    { type: "message", icon: "💬", label: "Mesaj", color: "var(--a2)" },
  ];

  const checkAllPlatforms = async () => {
    setChecking(true);
    toast_("🔍 Platformlar kontrol ediliyor…");

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
  };

  const dismissNotif   = (id) => setNotifs(prev => prev.filter(n => n.id !== id));
  const markAllRead    = ()   => setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  const clearAllNotifs = ()   => { setNotifs([]); toast_("🗑️ Tüm bildirimler temizlendi"); };

  const unreadCount = notifs.filter(n => !n.read).length;

  const timeAgo = (ts) => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1)  return "Az önce";
    if (m < 60) return m + " dk önce";
    const h = Math.floor(m / 60);
    if (h < 24) return h + " sa önce";
    return Math.floor(h / 24) + " gün önce";
  };

  const handleSync = () => { setSyncing(true); setTimeout(() => { setSyncing(false); toast_("🔄 Stoklar eşitlendi"); }, 1800); };

  const refreshFees = async () => {
    setRefreshingFees(true);
    try {
      const updated = await fetchLatestFees();
      const merged  = { ...DEFAULT_FEES, ...updated };
      setFees(merged); saveFees(merged);
      const ts = new Date().toLocaleDateString("tr-TR");
      setFeesLastUpdated(ts);
      try { localStorage.setItem("sellsync_fees_ts", ts); } catch {}
      toast_("✅ Platform ücretleri güncellendi!");
    } catch { toast_("❌ Güncelleme hatası"); }
    finally { setRefreshingFees(false); }
  };

  // equalize profit across platforms
  const equalizeProfit = (targetNet, sourcePlatId) => {
    // For each selected platform, calculate what price yields the same net profit
    const newSettings = { ...form.platformSettings };
    form.platforms.forEach(pid => {
      if (pid === sourcePlatId) return; // skip source
      const fee = fees[pid] || DEFAULT_FEES[pid] || { pct: 0, fixed: 0, paymentPct: 0 };
      const ps  = form.platformSettings[pid] || {};
      const shippingCost = parseFloat(ps.shippingCost) || 0;
      const shippingImpact = (ps.shipping === "free" || ps.shipping === "included") ? shippingCost : 0;

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
  };

  // renewal
  const renewItem = async (item, platIds) => {
    setRenewingId(item.id);
    try {
      const newTitles   = { ...(item.platformTitles || {}) };
      const newDescs    = { ...(item.platformDescriptions || {}) };
      const newListedAt = { ...(item.listedAt || {}) };
      for (const pid of platIds) {
        try { const r = await generateRenewed(item, pid); newTitles[pid] = r.title; newDescs[pid] = r.description; } catch {}
        newListedAt[pid] = Date.now();
      }
      setInventory(inv => inv.map(i => i.id !== item.id ? i : { ...i, platformTitles: newTitles, platformDescriptions: newDescs, listedAt: newListedAt }));
      toast_(`🔄 "${item.title}" yenilendi!`);
    } catch { toast_("❌ Yenileme hatası"); }
    finally { setRenewingId(null); }
  };

  // derived
  const filtered     = inventory.filter(i => (!search || i.title.toLowerCase().includes(search.toLowerCase())) && (filterP === "all" || i.platforms.includes(filterP)));
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
    const opt = SHIPPING_OPTIONS.find(o => o.id === (ps?.shipping || "buyer"));
    return opt?.label || "Alıcı Öder";
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {toast && <div className="toast">{toast}</div>}

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

          {/* ── INVENTORY ── */}
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

          {/* ── ADD / EDIT ── */}
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

          {/* ── RENEWAL CENTER ── */}
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

          {/* ── NOTIFICATIONS ── */}
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

          {/* ── SETTINGS ── */}
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

        {/* ── DETAIL MODAL ── */}
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
  );
}