import os
import re
from datetime import datetime

class KnowledgeSynthesizer:
    def __init__(self, memory_dir="LongTerm_Memory"):
        self.memory_dir = memory_dir

    def synthesize(self, query_keywords):
        """
        跨文件搜索關鍵字，並總結發展脈絡
        query_keywords: list of strings, e.g., ["MoE", "Performance", "Optimization"]
        """
        found_blocks = []
        
        if not os.path.exists(self.memory_dir):
            return "❌ 記憶庫路徑不存在。"

        # 1. 遍歷所有 Markdown 文件
        for filename in os.listdir(self.memory_dir):
            if filename.endswith(".md"):
                with open(os.path.join(self.memory_dir, filename), "r", encoding="utf-8") as f:
                    content = f.read()
                    
                    # 2. 使用正則表達式切分出每個技術條目 (### 為界)
                    blocks = re.split(r'(?=\n### )', content)
                    
                    for block in blocks:
                        # 檢查塊內是否包含關鍵字
                        if any(kw.lower() in block.lower() for kw in query_keywords):
                            found_blocks.append(block.strip())

        if not found_blocks:
            return f"🤷 在記憶庫中找不到與 {query_keywords} 相關的內容。"

        # 3. 格式化輸出報告
        report = f"# 🔬 技術研究綜述：{', '.join(query_keywords)}\n"
        report += f"生成日期: {datetime.now().strftime('%Y-%m-%d')}\n"
        report += f"偵測到相關條目數: {len(found_blocks)}\n\n"
        report += "---"
        
        # 按內容分塊展示
        for i, block in enumerate(found_blocks, 1):
            report += f"\n\n[相關證據 {i}]\n{block}"
            
        report += "\n\n---\n**💡 綜合分析建議：**\n"
        report += f"請 Gemini 基於以上 {len(found_blocks)} 條證據，總結該領域從 2025 到 2026 的演進趨勢。"
        
        return report

# 使用範例
if __name__ == "__main__":
    synthsizer = KnowledgeSynthesizer()
    # 執行研究：MoE 的效能優化
    research_topic = ["MoE", "Performance", "Optimization"]
    result_report = synthsizer.synthesize(research_topic)
    
    with open("Research_Summary.md", "w", encoding="utf-8") as f:
        f.write(result_report)
    
    print("✅ 研究綜述已生成至 Research_Summary.md，您可以將其貼給 AI 進行深度總結。")