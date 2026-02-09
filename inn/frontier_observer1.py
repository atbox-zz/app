from LongTerm_Memory.MemoryManager import MemoryManager
import arxiv
import feedparser
import json
import datetime
import uuid
import re

class MemoryManager:
    def __init__(self):
        self.storage = [] # 這裡未來可以對接你的 Pinecone 或 SQLite
        print("MemoryManager 已啟動：長期記憶存儲就緒。")

    def save_context(self, data):
        # 實作你的「將對話轉化為結構化數據」邏輯
        self.storage.append(data)
        
class KnowledgeFilter:
    """品質控制模組：識別技術突破並過濾營銷噱頭"""
    def __init__(self):
        # 識別「技術突破」的強信號
        self.breakthrough_signals = {
            "efficiency": [r"linear complexity", r"O\(n\)", r"scaling law", r"memory-efficient"],
            "architecture": [r"novel architecture", r"parameter-efficient", r"state-space model", r"SSM"],
            "performance": [r"outperforms", r"state-of-the-art", r"SOTA", r"zero-shot bottleneck"]
        }
        # 識別「營銷噱頭」的紅旗信號
        self.hype_signals = [
            r"revolutionary", r"next generation of intelligence", 
            r"surpasses human capabilities", r"the end of transformer"
        ]

    def analyze(self, title, summary):
        text = f"{title} {summary}".lower()
        breakthrough_points = 0
        
        for patterns in self.breakthrough_signals.values():
            for pattern in patterns:
                if re.search(pattern, text):
                    breakthrough_points += 1

        hype_points = sum(1 for pattern in self.hype_signals if re.search(pattern, text))
        quality_score = (breakthrough_points * 0.3) - (hype_points * 0.5)
        
        if quality_score >= 0.6:
            label, advice = "【真正的突破】", "必須掛載：涉及底層架構改進。"
        elif quality_score >= 0.2:
            label, advice = "【增量進步】", "可選閱讀：現有技術的優化。"
        else:
            label, advice = "【疑似噱頭】", "略過：缺乏具體技術數據。"

        return {"label": label, "score": round(quality_score, 2), "advice": advice}

class FrontierObserver:
    def __init__(self):
        # 2026 前沿技術關鍵字
        self.KEYWORDS = {
            "high": ["Sparse Attention", "Mamba", "SSM", "Ring Attention", "MoE", "Linear Attention"],
            "medium": ["Reasoning capability", "Chain of Thought", "Autonomous Agents", "World Models"],
            "low": ["FlashAttention", "vLLM", "Quantization", "LoRA"]
        }
        self.kf = KnowledgeFilter()
        self.output_file = f"knowledge_base_{datetime.datetime.now().strftime('%Y%m%d')}.jsonl"

    def calculate_importance(self, text):
        """基礎關鍵字評分邏輯"""
        score = 0.1
        found_tags = []
        for level, weight in [("high", 0.4), ("medium", 0.2), ("low", 0.1)]:
            for kw in self.KEYWORDS[level]:
                if re.search(rf"\b{kw}\b", text, re.IGNORECASE):
                    score += weight
                    found_tags.append(kw)
        return min(score, 1.0), list(set(found_tags))

    def fetch_arxiv(self, max_results=10):
        print("🔍 正在掃描 ArXiv 並執行品質過濾...")
        search = arxiv.Search(
            query="cat:cs.CL OR cat:cs.AI OR cat:cs.LG",
            max_results=max_results,
            sort_by=arxiv.SortCriterion.SubmittedDate
        )
        results = []
        for result in search.results():
            full_text = f"{result.title} {result.summary}"
            imp_score, tags = self.calculate_importance(full_text)
            
            if imp_score > 0.3:
                # 執行品質過濾層
                q_report = self.kf.analyze(result.title, result.summary)
                results.append({
                    "id": str(uuid.uuid5(uuid.NAMESPACE_URL, result.entry_id)),
                    "timestamp": result.published.isoformat(),
                    "source": "arxiv",
                    "title": result.title,
                    "quality": q_report,
                    "tags": tags,
                    "summary": result.summary[:300] + "..."
                })
        return results

    def fetch_hf_daily(self):
        print("🔍 正在掃描 Hugging Face 並解析架構創新...")
        feed_url = "https://papers.takara.ai/api/feed" # 2026 接口
        feed = feedparser.parse(feed_url)
        results = []
        for entry in feed.entries:
            imp_score, tags = self.calculate_importance(f"{entry.title} {entry.summary}")
            if imp_score > 0.2:
                q_report = self.kf.analyze(entry.title, entry.summary)
                results.append({
                    "id": str(uuid.uuid5(uuid.NAMESPACE_URL, entry.link)),
                    "timestamp": datetime.datetime.now().isoformat(),
                    "source": "huggingface",
                    "title": entry.title,
                    "quality": q_report,
                    "tags": tags,
                    "url": entry.link
                })
        return results

    def run_sync(self):
        """執行同步並保存高品質知識"""
        all_data = self.fetch_arxiv() + self.fetch_hf_daily()
        # 僅保存「增量進步」以上的內容
        filtered_data = [d for d in all_data if d['quality']['score'] > 0.1]
        
        with open(self.output_file, 'a', encoding='utf-8') as f:
            for item in filtered_data:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        print(f"✅ 任務完成！已過濾並寫入 {len(filtered_data)} 條高品質知識。")

#if __name__ == "__main__":
#    FrontierObserver().run_sync()

    # 在 frontier_observer.py 的 run_sync 結尾加入
if __name__ == "__main__":
    observer = FrontierObserver()
    observer.run_sync()
    
    # --- 新增長期記憶同步 ---
    print("🧠 正在將高品質知識寫入長期記憶庫...")
    memory = MemoryManager()
    added_count = memory.sync_all_from_jsonl(observer.output_file)
    print(f"✨ 同步完成！已更新 {added_count} 條技術存檔至 LongTerm_Memory/ 目錄。")