import os
import re
from datetime import datetime

class FrontierDashboard:
    def __init__(self, memory_dir="LongTerm_Memory"):
        self.memory_dir = memory_dir
        self.output_file = "Frontier_Briefing.html"

    def _get_stats(self):
        """統計各分類的知識量與平均品質"""
        stats = []
        for filename in os.listdir(self.memory_dir):
            if filename.endswith(".md"):
                with open(os.path.join(self.memory_dir, filename), "r", encoding="utf-8") as f:
                    content = f.read()
                    entries = re.findall(r"Score: (\d+\.\d+)", content)
                    stats.append({
                        "category": filename.replace(".md", ""),
                        "count": len(entries),
                        "avg_score": round(sum(float(s) for s in entries)/len(entries), 2) if entries else 0
                    })
        return stats

    def generate(self):
        stats = self._get_stats()
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        # HTML 模板與 CSS
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>2026 AI Frontier Dashboard</title>
            <style>
                body {{ font-family: 'Inter', sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }}
                .container {{ max-width: 1000px; margin: auto; }}
                h1 {{ color: #38bdf8; border-bottom: 2px solid #1e293b; padding-bottom: 10px; }}
                .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 30px; }}
                .card {{ background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; transition: 0.3s; }}
                .card:hover {{ transform: translateY(-5px); border-color: #38bdf8; }}
                .score {{ font-size: 2em; font-weight: bold; color: #fbbf24; }}
                .category {{ font-size: 1.1em; color: #94a3b8; margin-bottom: 10px; }}
                .footer {{ margin-top: 50px; font-size: 0.8em; color: #64748b; text-align: center; }}
                .tag {{ background: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 2026 前沿技術偵測儀表板</h1>
                <p>最後更新時間：{now} | 數據來源：私人長期記憶庫</p>
                
                <div class="grid">
        """
        
        for s in stats:
            html_content += f"""
                <div class="card">
                    <div class="category">{s['category']}</div>
                    <div class="score">{s['count']} <span style="font-size: 0.4em; color:#64748b;">份文獻</span></div>
                    <p>平均突破分值: <span style="color:#10b981;">{s['avg_score']}</span></p>
                </div>
            """
            
        html_content += """
                </div>
                <div class="footer">系統運作中：已過濾 2026 Hype 噪音 | 使用 Gemini 3 Flash 自我演進架構</div>
            </div>
        </body>
        </html>
        """
        
        with open(self.output_file, "w", encoding="utf-8") as f:
            f.write(html_content)
        return self.output_file

if __name__ == "__main__":
    dashboard = FrontierDashboard()
    path = dashboard.generate()
    print(f"✅ 儀表板已生成：{os.path.abspath(path)}")