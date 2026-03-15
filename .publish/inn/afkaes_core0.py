import arxiv
import json
import datetime
import os
import re
import sys
import glob

# ==========================================
# 1. 品質過濾模組 (Quality Filter)
# ==========================================
class KnowledgeFilter:
    def __init__(self):
        self.breakthrough_signals = {
            "efficiency": [r"linear complexity", r"O\(n\)", r"scaling law", r"memory-efficient"],
            "architecture": [r"novel architecture", r"parameter-efficient", r"state-space model", r"SSM"],
            "performance": [r"outperforms", r"state-of-the-art", r"SOTA", r"benchmarks"]
        }
        self.hype_signals = [r"revolutionary", r"surpasses human", r"the end of transformer"]

    def analyze(self, title, summary, threshold=0.2):
        text = f"{title} {summary}".lower()
        # 計算突破得分
        score = sum(0.3 for patterns in self.breakthrough_signals.values() for p in patterns if re.search(p, text))
        # 扣除噱頭分
        score -= sum(0.5 for p in self.hype_signals if re.search(p, text))
        
        if score >= 0.6: label = "【核心突破】"
        elif score >= threshold: label = "【技術增量】"
        else: label = "【一般資訊】"
        return {"label": label, "score": round(score, 2)}

# ==========================================
# 2. 記憶管理模組 (Memory Manager)
# ==========================================
class MemoryManager:
    def __init__(self, base_dir="LongTerm_Memory"):
        self.base_dir = base_dir
        if not os.path.exists(base_dir): os.makedirs(base_dir)

    def save(self, entry):
        category = entry['tags'][0] if entry['tags'] else "General"
        file_path = os.path.join(self.base_dir, f"{category}.md")
        is_new = not os.path.exists(file_path)
        with open(file_path, "a", encoding="utf-8") as f:
            if is_new: f.write(f"# {category} 技術存檔\n\n")
            f.write(f"### {entry['title']}\n")
            f.write(f"- **品質**: {entry['quality']['label']} ({entry['quality']['score']})\n")
            f.write(f"- **日期**: {entry['date']}\n")
            f.write(f"- **摘要**: {entry['summary']}\n")
            f.write(f"- **連結**: {entry['url']}\n\n---\n")

# ==========================================
# 3. 核心自動化引擎 (AFKAES Engine)
# ==========================================
class AFKAES:
    def __init__(self):
        self.kf = KnowledgeFilter()
        self.mm = MemoryManager()
        self.keywords = ["Mamba", "SSM", "MoE", "Mixture of Experts", "RAG", "Long Context"]

    def run(self, depth=1):
        print(f"📡 [系統] 啟動 2026 前沿掃描 (深度參數: {depth})...")
        
        # 階段 1: 高精度關鍵字搜尋
        query = " OR ".join([f'all:"{k}"' for k in self.keywords])
        results = self._process_search(query, max_res=10*depth, threshold=0.2)

        # 階段 2: 回退機制 (Fallback)
        if not results:
            print("⚠️ [警告] 高質量發現為 0，啟動回退機制：放寬標準並擴大搜尋...")
            results = self._process_search("cat:cs.AI OR cat:cs.CL", max_res=20*depth, threshold=0.1)

        if results:
            self._update_dashboard()
            print(f"✅ [成功] 今日捕獲 {len(results)} 條有價值技術資產。")
            return results
        else:
            print("❌ [結束] 今日無顯著技術更新。")
            return []

    def _process_search(self, query, max_res, threshold):
        search = arxiv.Search(query=query, max_results=max_res, sort_by=arxiv.SortCriterion.SubmittedDate)
        found = []
        for r in search.results():
            q_report = self.kf.analyze(r.title, r.summary, threshold=threshold)
            if q_report['score'] >= threshold:
                data = {
                    "title": r.title, "summary": r.summary[:300] + "...",
                    "quality": q_report, "tags": ["AI_Research"], 
                    "url": r.entry_id, "date": str(r.published.date())
                }
                self.mm.save(data)
                found.append(data)
        return found

    def _update_dashboard(self):
        # 生成簡單的儀表板索引
        files = glob.glob("LongTerm_Memory/*.md")
        html = f"<html><head><meta charset='UTF-8'><style>body{{font-family:sans-serif;background:#0f172a;color:white;padding:40px;}} .card{{background:#1e293b;padding:15px;margin:10px;border-radius:8px;border:1px solid #334155;}}</style></head><body>"
        html += "<h1>🚀 AFKAES 2026 前沿技術儀表板</h1>"
        html += f"<p>最後同步時間: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}</p>"
        for f in files:
            html += f"<div class='card'>📁 類別檔: <b>{os.path.basename(f)}</b></div>"
        html += "</body></html>"
        with open("Frontier_Dashboard.html", "w", encoding="utf-8") as f: f.write(html)

# ==========================================
# 執行與輸出
# ==========================================
if __name__ == "__main__":
    # 支援命令行：python afkaes_core.py 1
    depth_param = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    
    engine = AFKAES()
    discoveries = engine.run(depth=depth_param)

    if discoveries:
        best = max(discoveries, key=lambda x: x['quality']['score'])
        print("\n" + "="*40)
        print("🧠 今日最值得掛載給 AI 的技術：")
        print(f"標題: {best['title']}")
        print(f"分值: {best['quality']['score']} | 標籤: {best['quality']['label']}")
        print(f"建議: 請 Gemini 分析該技術對現有 Transformer 架構的影響。")
        print("="*40)