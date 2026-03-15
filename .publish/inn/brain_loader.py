import json
import glob
import os

def load_and_format_for_ai():
    # 1. 尋找最新的知識庫文件
    list_of_files = glob.glob('knowledge_base_*.jsonl')
    if not list_of_files:
        return "❌ 找不到任何知識庫文件，請先運行 frontier_observer.py"
    
    latest_file = max(list_of_files, key=os.path.getctime)
    
    data = []
    with open(latest_file, 'r', encoding='utf-8') as f:
        for line in f:
            data.append(json.loads(line))
    
    # 2. 依據品質分數排序，取前 3 名
    top_entries = sorted(
        data, 
        key=lambda x: x['quality']['score'], 
        reverse=True
    )[:3]
    
    # 3. 格式化為 AI 友好的掛載指令
    prompt = f"--- 🧠 2026 前沿知識掛載請求 (來源: {latest_file}) ---\n"
    prompt += "以下是今日偵測到最高質量的技術突破，請分析其邏輯並將其整合至你的當前認知中：\n\n"
    
    for i, entry in enumerate(top_entries, 1):
        prompt += f"【突破項目 {i}】\n"
        prompt += f"標題: {entry['title']}\n"
        prompt += f"標籤: {', '.join(entry['tags'])}\n"
        prompt += f"品質判定: {entry['quality']['label']} (分數: {entry['quality']['score']})\n"
        prompt += f"專家分析: {entry['quality']['advice']}\n"
        prompt += f"摘要內容: {entry.get('summary', '無摘要')}\n"
        prompt += f"參考來源: {entry.get('url', 'N/A')}\n"
        prompt += "-------------------------------------------\n"
    
    prompt += "\n請確認收到，並簡述這幾項技術如何影響我們目前的 AI 演進方案。"
    return prompt

if __name__ == "__main__":
    formatted_text = load_and_format_for_ai()
    print(formatted_text)
    
    # 自動將結果複製到剪貼簿 (需要安裝 pip install pyperclip)
    try:
        import pyperclip
        pyperclip.copy(formatted_text)
        print("\n✨ 內容已自動複製到剪貼簿！請直接貼給 Gemini。")
    except ImportError:
        print("\n💡 提示：安裝 pyperclip 可實現自動複製功能。")