import arxiv
import feedparser
import json
import datetime
import uuid
import re

class FrontierObserver:
    def __init__(self):
        # 2026 前沿技術權重設定
        self.KEYWORDS = {
            "high": ["Sparse Attention", "Mamba", "SSM", "Ring Attention", "Mixture of Experts", "MoE", "Linear Attention"],
            "medium": ["Reasoning capability", "Chain of Thought", "Autonomous Agents", "World Models", "Multimodal RAG"],
            "low": ["FlashAttention", "vLLM", "Quantization", "LoRA"]
        }
        self.output_file = f"knowledge_base_{datetime.datetime.now().strftime('%Y%m%d')}.jsonl"

    def calculate_score(self, text):
        """計算內容的重要性評分 (0.0 - 1.0)"""
        score = 0.1  # 基礎分
        found_tags = []

        for kw in self.KEYWORDS["high"]:
            if re.search(rf"\b{kw}\b", text, re.IGNORECASE):
                score += 0.4
                found_tags.append(kw)
        for kw in self.KEYWORDS["medium"]:
            if re.search(rf"\b{kw}\b", text, re.IGNORECASE):
                score += 0.2
                found_tags.append(kw)
        for kw in self.KEYWORDS["low"]:
            if re.search(rf"\b{kw}\b", text, re.IGNORECASE):
                score += 0.1
                found_tags.append(kw)

        return min(score, 1.0), list(set(found_tags))

    def fetch_arxiv(self, max_results=10):
        """抓取 ArXiv 最新論文"""
        print("🔍 正在掃描 ArXiv (cs.CL, cs.AI, cs.LG)...")
        search = arxiv.Search(
            query="cat:cs.CL OR cat:cs.AI OR cat:cs.LG",
            max_results=max_results,
            sort_by=arxiv.SortCriterion.SubmittedDate
        )

        results = []
        for result in search.results():
            full_text = f"{result.title} {result.summary}"
            score, tags = self.calculate_score(full_text)

            # 僅保留有價值的發現
            if score > 0.3:
                results.append({
                    "id": str(uuid.uuid5(uuid.NAMESPACE_URL, result.entry_id)),
                    "timestamp": result.published.isoformat(),
                    "source_type": "arxiv",
                    "title": result.title,
                    "url": result.entry_id,
                    "summary": result.summary[:300] + "...",
                    "tags": tags,
                    "importance_score": round(score, 2),
                    "raw_content_snippet": result.summary[:1000]
                })
        return results

    def fetch_hf_daily(self):
        """抓取 Hugging Face Daily Papers (透過 RSS)"""
        print("🔍 正在掃描 Hugging Face Daily Papers...")
        # 2026 年常用的社群 RSS 接口
        feed_url = "https://papers.takara.ai/api/feed"
        feed = feedparser.parse(feed_url)

        results = []
        for entry in feed.entries:
            score, tags = self.calculate_score(f"{entry.title} {entry.summary}")

            if score > 0.2:
                results.append({
                    "id": str(uuid.uuid5(uuid.NAMESPACE_URL, entry.link)),
                    "timestamp": datetime.datetime.now().isoformat(),
                    "source_type": "huggingface",
                    "title": entry.title,
                    "url": entry.link,
                    "summary": entry.summary[:300] + "...",
                    "tags": tags,
                    "importance_score": round(score, 2),
                    "raw_content_snippet": entry.summary[:1000]
                })
        return results

    def run_sync(self):
        """執行同步並保存"""
        all_data = self.fetch_arxiv() + self.fetch_hf_daily()

        with open(self.output_file, 'a', encoding='utf-8') as f:
            for item in all_data:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")

        print(f"✅ 任務完成！已將 {len(all_data)} 條新知識寫入 {self.output_file}")

if __name__ == "__main__":
    observer = FrontierObserver()
    observer.run_sync()