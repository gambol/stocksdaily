const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9821;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 确保data目录存在
const dataDir = path.join(__dirname, 'data');
fs.ensureDirSync(dataDir);

// 配置multer用于文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, dataDir)
    },
    filename: function (req, file, cb) {
        // 保存为带时间戳的文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        cb(null, `stock-data-${timestamp}.json`)
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传JSON文件'));
        }
    }
});

// 获取指定日期的股市数据
app.get('/api/data/:date?', async (req, res) => {
    try {
        let targetDate = req.params.date;
        
        // 如果没有指定日期，使用今天的日期
        if (!targetDate) {
            const today = new Date();
            targetDate = today.toISOString().split('T')[0]; // 格式：YYYY-MM-DD
        }
        
        const dataPath = path.join(dataDir, `${targetDate}.json`);
        
        // 检查是否存在指定日期的数据文件
        if (await fs.pathExists(dataPath)) {
            const data = await fs.readJson(dataPath);
            res.json(data);
        } else {
            // 如果没有指定日期的数据，返回示例数据
            const sampleData = await fs.readJson(path.join(__dirname, 'sample-data.json'));
            res.json(sampleData);
        }
    } catch (error) {
        console.error('获取数据失败:', error);
        res.status(500).json({ error: '获取数据失败' });
    }
});

// 上传新的JSON数据
app.post('/api/upload-data', upload.single('jsonFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        // 读取上传的JSON文件
        const uploadedData = await fs.readJson(req.file.path);
        
        // 验证JSON格式
        if (!uploadedData.date || !uploadedData.indices || !uploadedData.marketAnalysis || !uploadedData.importantEvents) {
            await fs.remove(req.file.path); // 删除无效文件
            return res.status(400).json({ error: 'JSON格式不正确，缺少必要字段：date, indices, marketAnalysis, importantEvents' });
        }

        // 添加时间戳
        uploadedData.lastUpdated = new Date().toISOString();

        // 根据日期保存数据文件
        const dateFileName = `${uploadedData.date}.json`;
        const dateDataPath = path.join(dataDir, dateFileName);
        await fs.writeJson(dateDataPath, uploadedData, { spaces: 2 });

        // 删除临时上传文件
        await fs.remove(req.file.path);

        res.json({ 
            message: '数据上传成功',
            date: uploadedData.date,
            filename: dateFileName,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('上传数据失败:', error);
        res.status(500).json({ error: '上传数据失败: ' + error.message });
    }
});

// 获取可用日期列表
app.get('/api/available-dates', async (req, res) => {
    try {
        const files = await fs.readdir(dataDir);
        const dateFiles = files
            .filter(file => file.match(/^\d{4}-\d{2}-\d{2}\.json$/))
            .map(file => {
                const date = file.replace('.json', '');
                const filePath = path.join(dataDir, file);
                const stats = fs.statSync(filePath);
                return {
                    date: date,
                    filename: file,
                    lastModified: stats.mtime.toISOString(),
                    size: stats.size
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(dateFiles);
    } catch (error) {
        console.error('获取可用日期失败:', error);
        res.status(500).json({ error: '获取可用日期失败' });
    }
});



// 直接通过API更新数据（不需要文件上传）
app.post('/api/update-data', async (req, res) => {
    try {
        const newData = req.body;
        
        // 验证数据格式
        if (!newData.date || !newData.indices || !newData.marketAnalysis || !newData.importantEvents) {
            return res.status(400).json({ error: 'JSON格式不正确，缺少必要字段：date, indices, marketAnalysis, importantEvents' });
        }

        // 添加时间戳
        newData.lastUpdated = new Date().toISOString();

        // 根据日期保存数据文件
        const dateFileName = `${newData.date}.json`;
        const dateDataPath = path.join(dataDir, dateFileName);
        await fs.writeJson(dateDataPath, newData, { spaces: 2 });

        res.json({ 
            message: '数据更新成功',
            date: newData.date,
            filename: dateFileName,
            timestamp: newData.lastUpdated
        });
    } catch (error) {
        console.error('更新数据失败:', error);
        res.status(500).json({ error: '更新数据失败: ' + error.message });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`美股信息网站服务器运行在 http://localhost:${PORT}`);
    console.log(`主页面: http://localhost:${PORT}/index.html`);
    console.log(`API接口:`);
    console.log(`  获取今天数据: http://localhost:${PORT}/api/data`);
    console.log(`  获取指定日期数据: http://localhost:${PORT}/api/data/YYYY-MM-DD`);
    console.log(`  上传数据: POST http://localhost:${PORT}/api/upload-data`);
    console.log(`  更新数据: POST http://localhost:${PORT}/api/update-data`);
}); 