import os
import json
from datetime import datetime

class MemoryManager:
    def __init__(self, base_dir="LongTerm_Memory"):
        self.base_dir = base_dir
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir)
        
    def _get_category_file(self, tags):
        """根據標籤決定寫入哪個 Markdown 文件"""
        # 優先取第一個標籤作為類別，若無則歸類為 General
        category = tags[0] if tags else "General_Research"
        # 移除非法字元
        category = "".join([c for c in category if c.isalnum() or c in (' ', '_')]).strip()
        return os.path.join(self.base_dir, f"{category}.md")

    def update_memory(self, entry):
        """將單條 JSON 條目轉換為 Markdown 並寫入"""
        file_path = self._get_category_file(entry.get('tags', []))
        is_new_file = not os.path.exists(file_path)
        
        with open(file_path, "a", encoding="utf-8") as f:
            if is_new_file:
                f.write(f"# {os.path.basename(file_path).replace('.md', '')} 技術存檔\n")
                f.write(f"建立日期: {datetime.now().strftime('%Y-%m-%d')}\n\n")
            
            # 寫入知識塊
            f.write(f"### {entry['title']}\n")
            f.write(f"- **日期**: {entry['timestamp'][:10]}\n")
            f.write(f"- **品質**: {entry['quality']['label']} (Score: {entry['quality']['score']})\n")
            f.write(f"- **關鍵字**: `{', '.join(entry['tags'])}`\n")
            f.write(f"- **AI 分析**: {entry['quality']['advice']}\n")
            f.write(f"- **核心摘要**: {entry['summary']}\n")
            if 'url' in entry:
                f.write(f"- **原文鏈接**: [點擊跳轉]({entry['url']})\n")
            f.write("\n---\n")

    def sync_all_from_jsonl(self, jsonl_path):
        """從 jsonl 批次更新到長期記憶"""
        count = 0
        with open(jsonl_path, 'r', encoding='utf-8') as f:
            for line in f:
                entry = json.loads(line)
                # 只記錄「增量進步」以上的有價值知識
                if entry['quality']['score'] >= 0.2:
                    self.update_memory(entry)
                    count += 1
        return count