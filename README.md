# 美股信息网站

一个基于日期的美股信息展示网站，支持每日数据管理和查看。

## 功能特点

- 📊 展示标普500和纳斯达克指数数据
- 📅 按日期管理和查看数据
- ⬅️➡️ 前一天/后一天导航功能
- 📈 市场分析展示
- 📰 重要事件列表
- 📱 响应式设计，手机友好

## 安装和运行

1. 安装依赖：
```bash
npm install
```

2. 启动服务器：
```bash
npm start
```

3. 开发模式（自动重启）：
```bash
npm run dev
```

4. 访问网站：
   - 主页面: http://localhost:3000/index.html
   - API测试: http://localhost:3000/api/data

## JSON数据格式

每个日期的数据文件应该包含以下格式：

```json
{
  "date": "2024-12-30",
  "indices": [
    {
      "name": "标普500",
      "value": "5847.87",
      "change": "+1.23",
      "changePercent": "+2.15%"
    },
    {
      "name": "纳斯达克",
      "value": "18952.33",
      "changePercent": "-0.85%",
      "change": "-162.44"
    }
  ],
  "marketAnalysis": [
    "标普500指数今日上涨<span class=\"highlight\">2.15%</span>，主要受益于科技和医疗保健板块的强劲表现。",
    "纳斯达克指数下跌<span style=\"color: rgb(255, 59, 48); font-weight: 500;\">0.85%</span>，主要原因是几家大型科技公司财报不及预期。"
  ],
  "importantEvents": [
    "美联储宣布维持当前利率不变，暗示年内可能进一步加息",
    "苹果公司发布季度财报，营收超出分析师预期",
    "特斯拉宣布扩大在亚洲市场的生产规模，股价应声上涨"
  ]
}
```

## 数据管理

### 文件命名规则
- 每日数据文件按日期命名，格式：`YYYY-MM-DD.json`
- 例如：`2024-12-30.json`、`2025-01-01.json`

### 数据存储位置
- 所有数据文件存储在 `data/` 目录下
- 服务器启动时会自动创建此目录

### 上传新数据
可以通过以下方式添加新数据：

1. **文件上传**（通过API）：
```bash
curl -X POST -F "jsonFile=@2024-12-30.json" http://localhost:3000/api/upload-data
```

2. **JSON数据提交**（通过API）：
```bash
curl -X POST -H "Content-Type: application/json" \
  -d @2024-12-30.json \
  http://localhost:3000/api/update-data
```

3. **直接文件放置**：
   - 将符合格式的JSON文件直接放到 `data/` 目录下
   - 文件名必须是 `YYYY-MM-DD.json` 格式

## API接口

- `GET /api/data` - 获取今天的数据
- `GET /api/data/:date` - 获取指定日期的数据（格式：YYYY-MM-DD）
- `POST /api/upload-data` - 上传JSON文件
- `POST /api/update-data` - 提交JSON数据
- `GET /api/available-dates` - 获取可用日期列表

## 使用说明

1. **查看当天数据**：打开网站默认显示当天数据
2. **查看历史数据**：使用页面底部的导航按钮
   - 点击"前一天"查看前一天的数据
   - 点击"后一天"查看后一天的数据（不能超过今天）
   - 点击"今天"回到当天数据
3. **添加新数据**：将JSON文件放入 `data/` 目录或使用API上传
4. **数据格式**：确保JSON文件包含必要字段：date、indices、marketAnalysis、importantEvents

## 技术栈

- **后端**: Node.js + Express.js
- **前端**: 原生HTML/CSS/JavaScript
- **存储**: 文件系统JSON文件
- **字体**: MiSans字体系列
- **图标**: RemixIcon

## 注意事项

- 确保JSON文件格式正确，缺少必要字段会导致上传失败
- 指数只支持标普500和纳斯达克两个
- 市场分析支持HTML标签来高亮显示内容
- 涨跌显示会根据changePercent中的正负号自动判断 