import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";

const BG_PRESETS = { "深黑": "#080809", "炭灰": "#111318", "暖黑": "#0e0c0a", "靛藍黑": "#090b12", "淺色": "#f0f2f5" };
const FONT_SCALES = { 小: 0.82, 中: 1, 大: 1.18, 特大: 1.35 };
const STATUS_CONFIG = {
  safe:     { color: "#22c55e", bg: "rgba(34,197,94,0.08)",   label: "正常", score: 0 },
  caution:  { color: "#eab308", bg: "rgba(234,179,8,0.08)",   label: "留意", score: 1 },
  warning:  { color: "#f97316", bg: "rgba(249,115,22,0.08)",  label: "警戒", score: 2 },
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.10)",   label: "危險", score: 3 },
};
const LAYER_META = {
  layer1: { name: "第一層", desc: "快速偵測",  speed: "分鐘～日", icon: "◈" },
  layer2: { name: "第二層", desc: "趨勢確認",  speed: "日～週",   icon: "◇" },
  layer3: { name: "第三層", desc: "需求驗證",  speed: "日～週",   icon: "◆" },
  layer4: { name: "第四層", desc: "結構確認",  speed: "週～月",   icon: "▣" },
};
const genSpark = (base, vol, n = 30, trend = 0) =>
  Array.from({ length: n }, (_, i) => ({ i, v: +(base + trend * i + (Math.random() - 0.5) * vol).toFixed(2) }));

const MOCK_INDICATORS = {
  layer1: [
    { id: "vix_structure", label: "VIX 期貨結構",   sublabel: "Contango / Backwardation", value: "BACKWARDATION", numericValue: -0.8, status: "critical", detail: "近月 VIX 高於遠月 0.8pts，持續 6 天。Backwardation 持續超過一週代表市場預期近期出事。", spark: genSpark(0.4,0.3,30,-0.04), threshold: 0, thresholdLabel: "中性線" },
    { id: "fed_futures",   label: "Fed Funds 期貨", sublabel: "隱含降息預期前移幅度",     value: "+87 bps",        numericValue: 87,   status: "warning",  detail: "市場定價 2025 年底前降息 3.5 碼，較上月前移 2 碼。前移超過 50bps 為警戒訊號。", spark: genSpark(45,8,30,1.4), threshold: 50, thresholdLabel: "警戒線 50bps" },
  ],
  layer2: [
    { id: "hy_spread",        label: "HY 信用利差",  sublabel: "vs 52週均值（FRED 實時）", value: "載入中…", numericValue: null, status: "caution", detail: "等待 FRED API 數據（設定 API Key 後自動更新）", spark: genSpark(480,20,30,2), threshold: 500, thresholdLabel: "警戒線 500bps", fredSeries: "BAMLH0A0HYM2" },
    { id: "ig_spread",        label: "IG 信用利差",  sublabel: "投資級同步確認",           value: "142 bps",   numericValue: 142,  status: "warning",  detail: "同步擴大，與 HY 方向一致，系統性壓力確認中。", spark: genSpark(105,8,30,1.2), threshold: 130, thresholdLabel: "警戒線 130bps" },
    { id: "treasury_futures", label: "美債 10 年期", sublabel: "機構避險資金流入",         value: "4.12%",     numericValue: 4.12, status: "warning",  detail: "殖利率快速下行 28bps（兩週），資金湧入避險部位。", spark: genSpark(4.55,0.08,30,-0.015), threshold: 4.3, thresholdLabel: "前期支撐 4.30%" },
  ],
  layer3: [
    { id: "copper", label: "銅期貨 Dr. Copper", sublabel: "全球工業需求領先指標", value: "$8,840", numericValue: 8840, status: "caution", detail: "下跌 6.2%（一個月），尚未確認趨勢性破位。銅股背離是歷史反覆出現的訊號。", spark: genSpark(9500,120,30,-22), threshold: 9000, thresholdLabel: "關鍵支撐 $9,000" },
    { id: "oil",    label: "WTI 原油期貨",       sublabel: "需求衰退感測器",           value: "$68.4",  numericValue: 68.4, status: "warning",  detail: "跌破 $70 關鍵支撐，需求前景惡化，需排除地緣政治雜訊。", spark: genSpark(78,2.5,30,-0.32), threshold: 70, thresholdLabel: "關鍵支撐 $70" },
  ],
  layer4: [
    { id: "private_credit", label: "私募信貸贖回率", sublabel: "BCRED 季度（手動追蹤）", value: "7.9%",     numericValue: 7.9, status: "critical", detail: "超過 5% 封門門檻，Q1 淨流出 $14B，員工自購填補 $1.5B 缺口。", spark: genSpark(2.5,0.5,30,0.18), threshold: 5, thresholdLabel: "封門門檻 5%" },
    { id: "sloos",          label: "SLOOS 放貸標準", sublabel: "聯準會高級貸款官員調查", value: "收緊 62%", numericValue: 62,  status: "warning",  detail: "62% 銀行收緊標準，連續兩季上升。流動性從傳統銀行側收緊確認。", spark: genSpark(35,4,30,0.9), threshold: 50, thresholdLabel: "警戒線 50%" },
  ],
};

// ── Storage ──────────────────────────────────────────────────
const storeGet = async (key, fallback = null) => {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : fallback; } catch { return fallback; }
};
const storeSet = async (key, value) => { try { await window.storage.set(key, JSON.stringify(value)); } catch {} };

// ── FRED Hook ─────────────────────────────────────────────────
const useFRED = (apiKey) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchSeries = useCallback(async (id) => {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${apiKey}&file_type=json&limit=60&sort_order=desc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FRED ${res.status}`);
    const json = await res.json();
    return json.observations.filter(o => o.value !== ".").map((o, i, arr) => ({ i: arr.length - 1 - i, v: parseFloat(o.value), date: o.date })).reverse();
  }, [apiKey]);

  const refresh = useCallback(async () => {
    if (!apiKey || apiKey.length < 8) return;
    setLoading(true); setError(null);
    try {
      const [hy, fsi] = await Promise.all([fetchSeries("BAMLH0A0HYM2"), fetchSeries("STLFSI4")]);
      setData({ BAMLH0A0HYM2: hy, STLFSI4: fsi });
      setLastUpdated(new Date().toLocaleTimeString("zh-TW"));
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [apiKey, fetchSeries]);

  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, error, lastUpdated, refresh };
};

// ── Notifications ─────────────────────────────────────────────
const useNotifications = (score, threshold, settings) => {
  const lastNotified = useRef(0);
  useEffect(() => {
    if (score < threshold) return;
    if (Date.now() - lastNotified.current < 300000) return;
    lastNotified.current = Date.now();
    const msg = `⚠️ 金融壓力指數：${score}/100 超過門檻 ${threshold}\n時間：${new Date().toLocaleString("zh-TW")}`;
    if (settings.browserNotify && typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("IRON RISK MONITOR", { body: msg });
    }
    if (settings.lineToken) {
      fetch("https://notify-api.line.me/api/notify", { method: "POST", headers: { "Authorization": `Bearer ${settings.lineToken}`, "Content-Type": "application/x-www-form-urlencoded" }, body: `message=${encodeURIComponent(msg)}`, mode: "no-cors" }).catch(() => {});
    }
    if (settings.alertEmail) {
      window.open(`mailto:${settings.alertEmail}?subject=${encodeURIComponent(`[警報] 壓力指數 ${score}/100`)}&body=${encodeURIComponent(msg)}`);
    }
  }, [score, threshold, settings]);
};

// ── Spark ─────────────────────────────────────────────────────
const Spark = ({ data, color, threshold, isLight }) => (
  <ResponsiveContainer width="100%" height={52}>
    <LineChart data={data} margin={{ top:4,right:2,left:2,bottom:4 }}>
      {threshold != null && <ReferenceLine y={threshold} stroke={color} strokeDasharray="3 2" strokeOpacity={0.5} />}
      <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      <Tooltip contentStyle={{ background: isLight?"#fff":"#0d0d0f", border:`1px solid ${color}55`, borderRadius:4, fontSize:11, color:isLight?"#222":"#e0e0e0", padding:"2px 8px" }} itemStyle={{ color }} formatter={v=>[v,""]} labelFormatter={()=>""} />
    </LineChart>
  </ResponsiveContainer>
);

// ── Indicator Card ────────────────────────────────────────────
const IndicatorCard = ({ ind, expanded, onToggle, fs, isLight }) => {
  const cfg = STATUS_CONFIG[ind.status];
  const t = isLight?"#1a1a1a":"#e0e0e0", s = isLight?"#777":"#888";
  const bg = isLight?(expanded?cfg.bg:"rgba(0,0,0,0.03)"):(expanded?cfg.bg:"rgba(255,255,255,0.025)");
  const bdr = isLight?`1px solid ${expanded?cfg.color+"66":"#ddd"}`:`1px solid ${expanded?cfg.color+"55":"rgba(255,255,255,0.07)"}`;
  return (
    <div onClick={onToggle} style={{ background:bg, border:bdr, borderRadius:10, padding:`${12*fs}px ${14*fs}px`, cursor:"pointer", transition:"all 0.2s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
            <span style={{ width:7*fs, height:7*fs, borderRadius:"50%", background:cfg.color, flexShrink:0, boxShadow:`0 0 6px ${cfg.color}` }} />
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13*fs, fontWeight:600, color:t }}>{ind.label}</span>
          </div>
          <div style={{ fontSize:10*fs, color:s, fontFamily:"monospace", marginLeft:13*fs }}>{ind.sublabel}</div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:15*fs, fontWeight:700, color:cfg.color }}>{ind.value}</div>
          <div style={{ fontSize:9*fs, fontWeight:700, color:cfg.color, letterSpacing:"0.08em", textTransform:"uppercase", opacity:0.85 }}>{cfg.label}</div>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:11*fs, color:s, marginBottom:8, lineHeight:1.55 }}>{ind.detail}</div>
          <Spark data={ind.spark} color={cfg.color} threshold={ind.threshold} isLight={isLight} />
          <div style={{ fontSize:9*fs, color:cfg.color+"88", marginTop:3, textAlign:"right", fontFamily:"monospace" }}>── {ind.thresholdLabel}</div>
        </div>
      )}
    </div>
  );
};

// ── Layer Section ─────────────────────────────────────────────
const LayerSection = ({ layerKey, indicators, fs, isLight }) => {
  const meta = LAYER_META[layerKey];
  const [expanded, setExpanded] = useState(null);
  const ws = indicators.reduce((w,i) => Math.max(w, STATUS_CONFIG[i.status].score), 0);
  const ls = Object.keys(STATUS_CONFIG).find(k => STATUS_CONFIG[k].score === ws);
  const cfg = STATUS_CONFIG[ls];
  const dc = isLight?"rgba(0,0,0,0.1)":"rgba(255,255,255,0.07)", lc = isLight?"#999":"#555";
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${dc}` }}>
        <span style={{ color:cfg.color, fontSize:14*fs }}>{meta.icon}</span>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10*fs, color:lc, letterSpacing:"0.1em", textTransform:"uppercase" }}>{meta.name}</span>
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13*fs, fontWeight:600, color:isLight?"#333":"#ccc" }}>{meta.desc}</span>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:9*fs, color:lc, fontFamily:"monospace" }}>{meta.speed}</span>
          <span style={{ fontSize:9*fs, fontWeight:700, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.color}44`, borderRadius:4, padding:`2px ${6*fs}px`, letterSpacing:"0.08em", textTransform:"uppercase" }}>{cfg.label}</span>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {indicators.map(ind => <IndicatorCard key={ind.id} ind={ind} expanded={expanded===ind.id} onToggle={()=>setExpanded(expanded===ind.id?null:ind.id)} fs={fs} isLight={isLight} />)}
      </div>
    </div>
  );
};

// ── Gauge ─────────────────────────────────────────────────────
const Gauge = ({ score, allInds, threshold, fs, isLight }) => {
  const cfg = STATUS_CONFIG[score>=70?"critical":score>=50?"warning":score>=30?"caution":"safe"];
  const [disp, setDisp] = useState(0);
  useEffect(() => { let v=0; const s=()=>{v+=2;if(v>=score){setDisp(score);return;}setDisp(v);requestAnimationFrame(s);}; requestAnimationFrame(s); }, [score]);
  const R=46*fs, cx=55*fs, cy=55*fs, circ=2*Math.PI*R;
  const criticals=allInds.filter(i=>i.status==="critical").length;
  const warnings=allInds.filter(i=>i.status==="warning").length;
  const normals=allInds.filter(i=>i.status==="safe"||i.status==="caution").length;
  const verdict=score>=70?"多層指標同時確認，系統性風險已擴散至核心，建議啟動風險因應措施。":score>=50?"壓力訊號累積中，多個跨層指標同步確認，密切追蹤第四層結構指標。":score>=30?"局部壓力訊號，尚未跨層確認，持續觀察中。":"市場平穩，無明顯壓力訊號。";
  const t=isLight?"#1a1a1a":"#e0e0e0", s=isLight?"#888":"#666";
  return (
    <div style={{ background:isLight?"rgba(0,0,0,0.03)":"rgba(255,255,255,0.025)", border:`1px solid ${isLight?"#ddd":"rgba(255,255,255,0.07)"}`, borderRadius:14, padding:`${20*fs}px ${24*fs}px`, display:"flex", alignItems:"center", gap:20*fs, marginBottom:20, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:-40, left:-40, width:200, height:200, background:`radial-gradient(circle,${cfg.color}15 0%,transparent 65%)`, pointerEvents:"none" }} />
      <svg width={110*fs} height={110*fs} style={{ flexShrink:0 }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={isLight?"#e0e0e0":"rgba(255,255,255,0.06)"} strokeWidth={7*fs} />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={cfg.color} strokeWidth={7*fs} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-disp/100)} transform={`rotate(-90 ${cx} ${cy})`} style={{ transition:"stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)", filter:`drop-shadow(0 0 8px ${cfg.color})` }} />
        <text x={cx} y={cy-6*fs} textAnchor="middle" fill={cfg.color} fontSize={24*fs} fontFamily="'IBM Plex Mono',monospace" fontWeight={700}>{disp}</text>
        <text x={cx} y={cy+12*fs} textAnchor="middle" fill={s} fontSize={9*fs} fontFamily="monospace">/100</text>
      </svg>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9*fs, color:s, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:4 }}>綜合壓力指數</div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:20*fs, fontWeight:700, color:cfg.color, marginBottom:8 }}>{cfg.label} — {score>=70?"系統性警報":score>=50?"壓力確認中":score>=30?"觀察累積":"市場平穩"}</div>
        <div style={{ display:"flex", gap:16*fs }}>
          {[["#ef4444",criticals,"危險"],["#f97316",warnings,"警戒"],["#22c55e",normals,"正常"]].map(([c,n,l])=>(
            <div key={l}><span style={{ fontFamily:"monospace", fontSize:17*fs, fontWeight:700, color:c }}>{n}</span><span style={{ fontSize:10*fs, color:s, marginLeft:4 }}>{l}</span></div>
          ))}
        </div>
      </div>
      <div style={{ background:cfg.bg, border:`1px solid ${cfg.color}44`, borderRadius:10, padding:`${12*fs}px ${14*fs}px`, maxWidth:200*fs, flexShrink:0 }}>
        <div style={{ fontSize:9*fs, color:cfg.color, fontFamily:"monospace", letterSpacing:"0.08em", marginBottom:5, textTransform:"uppercase" }}>系統判斷</div>
        <div style={{ fontSize:11*fs, color:isLight?"#444":"#bbb", lineHeight:1.6 }}>{verdict}</div>
        <div style={{ marginTop:8, fontSize:10*fs, color:s, fontFamily:"monospace" }}>警報門檻：{threshold}/100</div>
      </div>
    </div>
  );
};

// ── Private Credit Tracker ────────────────────────────────────
const PrivateCreditTracker = ({ fs, isLight }) => {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ date:"", fund:"BCRED", rate:"", outflow:"", notes:"" });
  const [showForm, setShowForm] = useState(false);
  useEffect(() => { storeGet("pc_entries",[]).then(setEntries); }, []);
  const save = async () => {
    if (!form.date||!form.rate) return;
    const updated = [{ ...form, id:Date.now() }, ...entries];
    setEntries(updated); await storeSet("pc_entries", updated);
    setForm({ date:"",fund:"BCRED",rate:"",outflow:"",notes:"" }); setShowForm(false);
  };
  const remove = async (id) => { const u=entries.filter(e=>e.id!==id); setEntries(u); await storeSet("pc_entries",u); };
  const t=isLight?"#1a1a1a":"#e0e0e0", s=isLight?"#888":"#666";
  const inp={ background:isLight?"#f5f5f5":"rgba(255,255,255,0.04)", border:`1px solid ${isLight?"#ddd":"rgba(255,255,255,0.1)"}`, color:t, borderRadius:6, padding:`${6*fs}px ${8*fs}px`, fontSize:12*fs, outline:"none", fontFamily:"monospace", boxSizing:"border-box", width:"100%" };
  return (
    <div style={{ background:isLight?"rgba(0,0,0,0.02)":"rgba(255,255,255,0.02)", border:`1px solid ${isLight?"#ddd":"rgba(255,255,255,0.07)"}`, borderRadius:12, padding:`${16*fs}px`, marginBottom:24 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <div>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14*fs, fontWeight:700, color:t }}>▣ 私募信貸贖回追蹤</span>
          <span style={{ fontSize:10*fs, color:s, marginLeft:8, fontFamily:"monospace" }}>手動輸入 · 儲存至本機 · 跨 session 保留</span>
        </div>
        <button onClick={()=>setShowForm(!showForm)} style={{ background:showForm?"rgba(239,68,68,0.1)":"rgba(34,197,94,0.1)", border:`1px solid ${showForm?"#ef444455":"#22c55e55"}`, color:showForm?"#ef4444":"#22c55e", borderRadius:6, padding:`${5*fs}px ${10*fs}px`, cursor:"pointer", fontSize:11*fs, fontFamily:"monospace" }}>{showForm?"✕ 取消":"+ 新增記錄"}</button>
      </div>
      {showForm && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 2fr", gap:8, marginBottom:12, padding:`${12*fs}px`, background:isLight?"#f8f8f8":"rgba(255,255,255,0.03)", borderRadius:8, border:`1px solid ${isLight?"#e8e8e8":"rgba(255,255,255,0.06)"}` }}>
          {[["date","季度","2025-Q1"],["fund","基金","BCRED"],["rate","贖回率 (%)","7.9"],["outflow","流出 ($B)","14"]].map(([k,l,p])=>(
            <div key={k}><div style={{ fontSize:9*fs, color:s, marginBottom:3, fontFamily:"monospace" }}>{l}</div><input placeholder={p} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={inp} /></div>
          ))}
          <div><div style={{ fontSize:9*fs, color:s, marginBottom:3, fontFamily:"monospace" }}>備註</div><input placeholder="員工自購填補缺口…" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={inp} /></div>
          <div style={{ gridColumn:"1/-1", display:"flex", justifyContent:"flex-end" }}>
            <button onClick={save} style={{ background:"rgba(34,197,94,0.15)", border:"1px solid #22c55e55", color:"#22c55e", borderRadius:6, padding:`${6*fs}px ${18*fs}px`, cursor:"pointer", fontSize:12*fs }}>儲存</button>
          </div>
        </div>
      )}
      {entries.length===0 ? (
        <div style={{ textAlign:"center", padding:`${20*fs}px`, color:s, fontSize:12*fs, fontFamily:"monospace" }}>尚無記錄 — 點擊「新增記錄」開始追蹤季度數據</div>
      ) : (
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12*fs, fontFamily:"monospace" }}>
          <thead><tr>{["季度","基金","贖回率","淨流出","備註",""].map(h=><th key={h} style={{ textAlign:"left", padding:`${5*fs}px ${8*fs}px`, color:s, fontSize:10*fs, borderBottom:`1px solid ${isLight?"#eee":"rgba(255,255,255,0.06)"}`, letterSpacing:"0.06em" }}>{h}</th>)}</tr></thead>
          <tbody>{entries.map(e=>{
            const r=parseFloat(e.rate), rc=r>=7?"#ef4444":r>=5?"#f97316":"#22c55e";
            return <tr key={e.id} style={{ borderBottom:`1px solid ${isLight?"#f0f0f0":"rgba(255,255,255,0.04)"}` }}>
              <td style={{ padding:`${5*fs}px ${8*fs}px`,color:t }}>{e.date}</td>
              <td style={{ padding:`${5*fs}px ${8*fs}px`,color:t }}>{e.fund}</td>
              <td style={{ padding:`${5*fs}px ${8*fs}px`,color:rc,fontWeight:700 }}>{e.rate}%</td>
              <td style={{ padding:`${5*fs}px ${8*fs}px`,color:t }}>${e.outflow}B</td>
              <td style={{ padding:`${5*fs}px ${8*fs}px`,color:s,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.notes}</td>
              <td style={{ padding:`${5*fs}px ${8*fs}px` }}><button onClick={()=>remove(e.id)} style={{ background:"none",border:"none",color:"#ef444488",cursor:"pointer",fontSize:12*fs }}>✕</button></td>
            </tr>;
          })}</tbody>
        </table>
      )}
    </div>
  );
};

// ── Settings Panel ────────────────────────────────────────────
const SettingsPanel = ({ settings, onChange, onClose, compositeScore, isLight }) => {
  const [notifPerm, setNotifPerm] = useState(typeof Notification!=="undefined"?Notification.permission:"unsupported");
  const bg=isLight?"#fff":"#111318", bdr=isLight?"#ddd":"rgba(255,255,255,0.1)", t=isLight?"#1a1a1a":"#e0e0e0", s=isLight?"#888":"#666";
  const inp={ background:isLight?"#f5f5f5":"rgba(255,255,255,0.05)", border:`1px solid ${isLight?"#ddd":"rgba(255,255,255,0.1)"}`, color:t, borderRadius:6, padding:"8px 10px", fontSize:12, width:"100%", boxSizing:"border-box", outline:"none", fontFamily:"monospace" };
  const Sec=({title,children})=><div style={{ marginBottom:20 }}><div style={{ fontSize:10,color:s,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${bdr}` }}>{title}</div>{children}</div>;
  const Lbl=({children})=><div style={{ fontSize:11,color:s,marginBottom:4,fontFamily:"monospace" }}>{children}</div>;
  return (
    <div style={{ position:"fixed",top:0,right:0,bottom:0,width:310,background:bg,borderLeft:`1px solid ${bdr}`,zIndex:1000,overflowY:"auto",padding:20,boxShadow:"-8px 0 32px rgba(0,0,0,0.5)" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
        <span style={{ fontSize:15,fontWeight:700,color:t,fontFamily:"'DM Sans',sans-serif" }}>⚙ 設定</span>
        <button onClick={onClose} style={{ background:"none",border:"none",color:s,cursor:"pointer",fontSize:20 }}>✕</button>
      </div>
      <Sec title="顯示設定">
        <Lbl>背景色</Lbl>
        <div style={{ display:"flex",gap:5,marginBottom:12,flexWrap:"wrap" }}>
          {Object.entries(BG_PRESETS).map(([name,val])=>(
            <button key={name} onClick={()=>onChange("bgColor",val)} style={{ flex:"1 0 auto",padding:"8px 4px",borderRadius:6,border:settings.bgColor===val?"2px solid #60a5fa":`1px solid ${bdr}`,background:val,color:val==="#f0f2f5"?"#1a1a1a":"#fff",fontSize:11,cursor:"pointer",fontFamily:"monospace",minWidth:48 }}>{name}</button>
          ))}
        </div>
        <Lbl>字型大小</Lbl>
        <div style={{ display:"flex",gap:5,marginBottom:4 }}>
          {Object.keys(FONT_SCALES).map(sz=>(
            <button key={sz} onClick={()=>onChange("fontSize",sz)} style={{ flex:1,padding:"8px 4px",borderRadius:6,border:settings.fontSize===sz?"2px solid #60a5fa":`1px solid ${bdr}`,background:settings.fontSize===sz?"rgba(96,165,250,0.15)":"transparent",color:t,fontSize:12,cursor:"pointer",fontFamily:"monospace" }}>{sz}</button>
          ))}
        </div>
        <div style={{ fontSize:10,color:s,marginTop:4 }}>目前：{settings.fontSize}（比例 ×{FONT_SCALES[settings.fontSize]}）</div>
      </Sec>
      <Sec title="FRED API 接入">
        <Lbl>API Key（fred.stlouisfed.org 免費申請）</Lbl>
        <input type="password" placeholder="輸入您的 FRED API Key…" value={settings.fredApiKey||""} onChange={e=>onChange("fredApiKey",e.target.value)} style={{ ...inp,marginBottom:6 }} />
        <div style={{ fontSize:10,color:s,lineHeight:1.55 }}>自動拉取：HY Spread (BAMLH0A0HYM2) · St. Louis FSI (STLFSI4)</div>
      </Sec>
      <Sec title="警報通知設定">
        <Lbl>觸發門檻（綜合分數）</Lbl>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
          <input type="range" min={20} max={90} value={settings.alertThreshold} onChange={e=>onChange("alertThreshold",parseInt(e.target.value))} style={{ flex:1 }} />
          <span style={{ fontFamily:"monospace",fontSize:16,fontWeight:700,color:"#f97316",minWidth:36 }}>{settings.alertThreshold}</span>
        </div>
        <Lbl>瀏覽器通知</Lbl>
        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
          <button onClick={async()=>{const p=await Notification.requestPermission();setNotifPerm(p);onChange("browserNotify",p==="granted");}} style={{ background:notifPerm==="granted"?"rgba(34,197,94,0.15)":"rgba(249,115,22,0.1)",border:`1px solid ${notifPerm==="granted"?"#22c55e44":"#f9731644"}`,color:notifPerm==="granted"?"#22c55e":"#f97316",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontSize:11,fontFamily:"monospace" }}>
            {notifPerm==="granted"?"✓ 已授權":notifPerm==="denied"?"✕ 被拒絕":"授權通知"}
          </button>
        </div>
        <Lbl>Line Notify Token</Lbl>
        <input type="password" placeholder="Line Notify access token…" value={settings.lineToken||""} onChange={e=>onChange("lineToken",e.target.value)} style={{ ...inp,marginBottom:5 }} />
        <div style={{ fontSize:10,color:s,marginBottom:12,lineHeight:1.55 }}>notify-bot.line.me 申請 · 瀏覽器直連有 CORS 限制，正式環境建議搭配後端 Proxy</div>
        <Lbl>Email 警報</Lbl>
        <input type="email" placeholder="your@email.com" value={settings.alertEmail||""} onChange={e=>onChange("alertEmail",e.target.value)} style={{ ...inp,marginBottom:4 }} />
        <div style={{ fontSize:10,color:s }}>觸發時自動開啟預填郵件草稿</div>
      </Sec>
      <Sec title="測試">
        <button onClick={()=>{
          if(Notification.permission==="granted") new Notification("IRON RISK MONITOR",{body:`測試警報 · 當前分數：${compositeScore}/100`});
          alert(`🧪 測試觸發\n分數：${compositeScore}/100\nLine：${settings.lineToken?"已設定":"未設定"}\nEmail：${settings.alertEmail||"未設定"}\n瀏覽器通知：${notifPerm}`);
        }} style={{ width:"100%",background:"rgba(239,68,68,0.1)",border:"1px solid #ef444455",color:"#ef4444",borderRadius:6,padding:"10px",cursor:"pointer",fontSize:13,fontFamily:"monospace" }}>
          ⚠ 發送測試警報
        </button>
      </Sec>
    </div>
  );
};

// ── Ticker ────────────────────────────────────────────────────
const Ticker = ({ isLight }) => {
  const items = ["🔴 BCRED 贖回率 7.9% — 超過封門門檻","🟠 HY Spread 突破52週均值","🔴 VIX 期貨 Backwardation 持續第6天","🟠 Fed Funds 降息預期前移 2 碼","🟠 WTI 跌破 $70","🟡 銅期貨 -6.2%（一個月）"];
  const text = items.join("   ·   ") + "   ·   ";
  const [off, setOff] = useState(0);
  const ref = useRef(null);
  useEffect(() => { let id; const step=()=>{setOff(o=>{const w=(ref.current?.scrollWidth||1400)/2;return o<=-w?0:o-0.5;});id=requestAnimationFrame(step);}; id=requestAnimationFrame(step); return()=>cancelAnimationFrame(id); }, []);
  return (
    <div style={{ overflow:"hidden",background:isLight?"rgba(239,68,68,0.04)":"rgba(239,68,68,0.06)",borderTop:"1px solid rgba(239,68,68,0.18)",borderBottom:"1px solid rgba(239,68,68,0.18)",padding:"7px 0",marginBottom:20,position:"relative" }}>
      <div style={{ position:"absolute",left:0,top:0,bottom:0,width:40,background:`linear-gradient(to right,${isLight?"#f0f2f5":"#080809"},transparent)`,zIndex:1 }} />
      <div style={{ position:"absolute",right:0,top:0,bottom:0,width:40,background:`linear-gradient(to left,${isLight?"#f0f2f5":"#080809"},transparent)`,zIndex:1 }} />
      <div ref={ref} style={{ display:"inline-block",transform:`translateX(${off}px)`,whiteSpace:"nowrap",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:isLight?"#d44":"#ef4444cc",letterSpacing:"0.04em" }}>{text}{text}</div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────
export default function Dashboard() {
  const [settings, setSettings] = useState({ bgColor:"#080809", fontSize:"中", fredApiKey:"", lineToken:"", alertEmail:"", alertThreshold:60, browserNotify:false });
  const [showSettings, setShowSettings] = useState(false);
  const [time, setTime] = useState("");

  useEffect(() => { storeGet("dash_settings_v2",null).then(s=>{if(s)setSettings(p=>({...p,...s}));}); }, []);
  const updateSetting = (key, val) => setSettings(prev => { const u={...prev,[key]:val}; storeSet("dash_settings_v2",u); return u; });
  const fs = FONT_SCALES[settings.fontSize]||1;
  const isLight = settings.bgColor==="#f0f2f5";
  const t=isLight?"#1a1a1a":"#e0e0e0", s=isLight?"#888":"#555", bdr=isLight?"#ddd":"rgba(255,255,255,0.07)";

  useEffect(() => { const tick=()=>setTime(new Date().toLocaleString("zh-TW",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})); tick(); const id=setInterval(tick,1000); return()=>clearInterval(id); }, []);

  const { data:fredData, loading:fredLoading, error:fredError, lastUpdated:fredUpdated, refresh:fredRefresh } = useFRED(settings.fredApiKey);

  // Merge FRED into indicators
  const indicators = JSON.parse(JSON.stringify(MOCK_INDICATORS));
  const hyInd = indicators.layer2.find(i=>i.id==="hy_spread");
  if (hyInd && fredData?.BAMLH0A0HYM2?.length) {
    const latest = fredData.BAMLH0A0HYM2.slice(-1)[0].v;
    const ma52 = fredData.BAMLH0A0HYM2.slice(-252).reduce((s,d)=>s+d.v,0) / Math.min(fredData.BAMLH0A0HYM2.length,252);
    hyInd.value = `${latest.toFixed(0)} bps`;
    hyInd.numericValue = latest;
    hyInd.spark = fredData.BAMLH0A0HYM2.slice(-30);
    hyInd.status = latest>=700?"critical":latest>=500?"warning":latest>=350?"caution":"safe";
    hyInd.detail = `FRED 實時：${latest.toFixed(2)} bps（52週均值 ${ma52.toFixed(0)} bps）。${latest>ma52?"已突破均值":"低於均值"}，差距 ${(latest-ma52).toFixed(0)} bps。`;
  }

  const allInds = Object.values(indicators).flat();
  const rawScore = allInds.reduce((s,i)=>s+STATUS_CONFIG[i.status].score,0);
  const compositeScore = Math.round((rawScore/(allInds.length*3))*100);

  useNotifications(compositeScore, settings.alertThreshold, settings);

  return (
    <div style={{ minHeight:"100vh", background:settings.bgColor, color:t, fontFamily:"'DM Sans',sans-serif", transition:"background 0.3s" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`* { box-sizing: border-box; } input[type=range]{ accent-color:#f97316; }`}</style>

      {/* Header */}
      <div style={{ padding:`${13*fs}px ${22*fs}px`, borderBottom:`1px solid ${bdr}`, display:"flex", alignItems:"center", justifyContent:"space-between", background:isLight?"rgba(0,0,0,0.015)":"rgba(255,255,255,0.015)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:30*fs, height:30*fs, background:"linear-gradient(135deg,#ef4444,#f97316)", borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13*fs, color:"#fff", fontWeight:700, flexShrink:0 }}>⚠</div>
          <div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13*fs, fontWeight:700, letterSpacing:"0.05em", color:t }}>IRON RISK MONITOR</div>
            <div style={{ fontSize:9*fs, color:s, letterSpacing:"0.08em", textTransform:"uppercase" }}>多層金融壓力警報系統 · v2.0</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9*fs, color:"#22c55e", letterSpacing:"0.1em" }}>● LIVE</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11*fs, color:s }}>{time}</div>
          </div>
          <button onClick={()=>setShowSettings(true)} style={{ background:"none", border:`1px solid ${bdr}`, color:s, borderRadius:8, padding:`${7*fs}px ${10*fs}px`, cursor:"pointer", fontSize:14*fs, lineHeight:1 }}>⚙</button>
        </div>
      </div>

      <Ticker isLight={isLight} />

      <div style={{ padding:`0 ${22*fs}px` }}>
        {/* FRED status */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:`${7*fs}px ${12*fs}px`, background:isLight?"rgba(0,0,0,0.03)":"rgba(255,255,255,0.02)", border:`1px solid ${bdr}`, borderRadius:8, marginBottom:16, fontSize:11*fs, fontFamily:"monospace", flexWrap:"wrap", gap:12 }}>
          <span style={{ color:s }}>FRED API</span>
          {!settings.fredApiKey ? <span style={{ color:"#f97316" }}>⚠ 未設定 API Key — 點右上 ⚙ 設定（免費）</span>
            : fredLoading ? <span style={{ color:"#60a5fa" }}>⟳ 載入中…</span>
            : fredError ? <span style={{ color:"#ef4444" }}>✕ {fredError}</span>
            : <>
                <span style={{ color:"#22c55e" }}>✓ 已連線</span>
                {fredData?.BAMLH0A0HYM2?.length && <span style={{ color:t }}>HY Spread: <b style={{ color:"#f97316" }}>{fredData.BAMLH0A0HYM2.slice(-1)[0].v.toFixed(2)} bps</b></span>}
                {fredData?.STLFSI4?.length && <span style={{ color:t }}>STLFSI4: <b style={{ color:fredData.STLFSI4.slice(-1)[0].v>1?"#ef4444":fredData.STLFSI4.slice(-1)[0].v>0?"#f97316":"#22c55e" }}>{fredData.STLFSI4.slice(-1)[0].v.toFixed(3)}</b></span>}
                {fredUpdated && <span style={{ color:s }}>更新：{fredUpdated}</span>}
              </>
          }
          <button onClick={fredRefresh} style={{ marginLeft:"auto", background:"none", border:`1px solid ${bdr}`, color:s, borderRadius:4, padding:`${3*fs}px ${8*fs}px`, cursor:"pointer", fontSize:10*fs }}>↻ 刷新</button>
        </div>

        <Gauge score={compositeScore} allInds={allInds} threshold={settings.alertThreshold} fs={fs} isLight={isLight} />

        {/* Filter logic bar */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:18, padding:`${7*fs}px ${12*fs}px`, background:isLight?"rgba(0,0,0,0.03)":"rgba(255,255,255,0.02)", border:`1px solid ${bdr}`, borderRadius:8, fontSize:10*fs, fontFamily:"monospace", flexWrap:"wrap" }}>
          <span style={{ color:s }}>過濾邏輯：</span>
          {[["Layer1 觸發","#22c55e"],["Layer2 確認","#f97316"],["Layer3 驗證","#f97316"],["Layer4 結構確認","#ef4444"]].map(([l,c],i)=>(
            <span key={i} style={{ display:"flex", alignItems:"center", gap:4 }}>{i>0&&<span style={{ color:isLight?"#aaa":"#444" }}>→</span>}<span style={{ color:c }}>{l}</span></span>
          ))}
          <span style={{ marginLeft:"auto", color:"#ef4444", fontWeight:700 }}>▲ 3/4 層同時亮燈</span>
        </div>

        {Object.entries(indicators).map(([k,v])=><LayerSection key={k} layerKey={k} indicators={v} fs={fs} isLight={isLight} />)}

        <PrivateCreditTracker fs={fs} isLight={isLight} />

        <div style={{ borderTop:`1px solid ${bdr}`, paddingTop:12, display:"flex", justifyContent:"space-between", fontSize:10*fs, color:s, fontFamily:"monospace" }}>
          <span>資料來源：FRED API · OFR FSI · CME（點擊指標卡展開走勢圖）</span>
          <span>設定與私募記錄已自動儲存至本機</span>
        </div>
      </div>

      {showSettings && <>
        <div onClick={()=>setShowSettings(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:999 }} />
        <SettingsPanel settings={settings} onChange={updateSetting} onClose={()=>setShowSettings(false)} compositeScore={compositeScore} isLight={isLight} />
      </>}
    </div>
  );
}
