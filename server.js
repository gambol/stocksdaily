const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 9821;

// JWT 密钥（生产环境应该使用环境变量）
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 管理员账户（生产环境应该使用数据库）
const ADMIN_CREDENTIALS = {
    username: 'briefAdmin',
    password: 'Admin@898989' // 生产环境应该使用加密密码
};

// 存储验证码（生产环境应该使用Redis）
const captchaStore = new Map();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 专门处理 favicon.ico
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// 确保data目录存在
const dataDir = path.join(__dirname, 'data');
fs.ensureDirSync(dataDir);

// 生成验证码
function generateCaptcha() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let captcha = '';
    for (let i = 0; i < 4; i++) {
        captcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return captcha;
}

// JWT 认证中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: '访问令牌缺失' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '访问令牌无效' });
        }
        req.user = user;
        next();
    });
}

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

// 获取验证码
app.get('/api/admin/captcha', (req, res) => {
    const captcha = generateCaptcha();
    const sessionId = Date.now().toString();
    
    // 存储验证码，5分钟有效期
    captchaStore.set(sessionId, {
        code: captcha,
        timestamp: Date.now()
    });
    
    // 5分钟后自动删除
    setTimeout(() => {
        captchaStore.delete(sessionId);
    }, 5 * 60 * 1000);
    
    res.json({
        sessionId,
        captcha: captcha
    });
});

// 管理员登录
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password, captcha, sessionId } = req.body;
        
        // 验证验证码
        const storedCaptcha = captchaStore.get(sessionId);
        if (!storedCaptcha) {
            return res.status(400).json({ error: '验证码已过期，请重新获取' });
        }
        
        // 检查验证码是否过期（5分钟）
        if (Date.now() - storedCaptcha.timestamp > 5 * 60 * 1000) {
            captchaStore.delete(sessionId);
            return res.status(400).json({ error: '验证码已过期，请重新获取' });
        }
        
        // 验证验证码
        if (captcha.toUpperCase() !== storedCaptcha.code) {
            return res.status(400).json({ error: '验证码错误' });
        }
        
        // 验证用户名和密码
        if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
            // 删除已使用的验证码
            captchaStore.delete(sessionId);
            
            const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ 
                message: '登录成功',
                token,
                username
            });
        } else {
            res.status(401).json({ error: '用户名或密码错误' });
        }
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: '登录失败' });
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
            // 使用文件名中的日期，而不是JSON中的日期
            data.date = targetDate;
            res.json(data);
        } else {
            // 如果没有指定日期的数据，查找上一个可用的数据
            try {
                const files = await fs.readdir(dataDir);
                const dateFiles = files
                    .filter(file => file.match(/^\d{4}-\d{2}-\d{2}\.json$/))
                    .map(file => file.replace('.json', ''))
                    .sort((a, b) => new Date(b) - new Date(a)); // 按日期降序排序
                
                if (dateFiles.length > 0) {
                    // 找到最新的可用数据
                    const latestDate = dateFiles[0];
                    const latestDataPath = path.join(dataDir, `${latestDate}.json`);
                    const data = await fs.readJson(latestDataPath);
                    
                    // 返回最新数据，但保持请求的日期
                    data.date = targetDate;
                    data.originalDate = latestDate; // 添加原始日期信息
                    res.json(data);
                } else {
                    // 如果没有任何数据文件，返回404
                    res.status(404).json({ 
                        error: '没有找到任何可用数据',
                        message: '系统中暂无任何股市数据'
                    });
                }
            } catch (error) {
                console.error('查找可用数据失败:', error);
                res.status(500).json({ error: '查找可用数据失败' });
            }
        }
    } catch (error) {
        console.error('获取数据失败:', error);
        res.status(500).json({ error: '获取数据失败' });
    }
});

// 上传新的JSON数据（需要认证）
app.post('/api/upload-data', authenticateToken, upload.single('jsonFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        // 读取上传的JSON文件
        const uploadedData = await fs.readJson(req.file.path);
        
        // 验证JSON格式
        if (!uploadedData.indices || !uploadedData.marketAnalysis || !uploadedData.importantEvents) {
            await fs.remove(req.file.path); // 删除无效文件
            return res.status(400).json({ error: 'JSON格式不正确，缺少必要字段：indices, marketAnalysis, importantEvents' });
        }

        // 从文件名中提取日期，如果没有则使用JSON中的日期
        let targetDate = uploadedData.date;
        if (!targetDate) {
            const today = new Date();
            targetDate = today.toISOString().split('T')[0];
        }

        // 添加时间戳
        uploadedData.lastUpdated = new Date().toISOString();

        // 根据日期保存数据文件
        const dateFileName = `${targetDate}.json`;
        const dateDataPath = path.join(dataDir, dateFileName);
        await fs.writeJson(dateDataPath, uploadedData, { spaces: 2 });

        // 删除临时上传文件
        await fs.remove(req.file.path);

        res.json({ 
            message: '数据上传成功',
            date: targetDate,
            filename: dateFileName,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('上传数据失败:', error);
        res.status(500).json({ error: '上传数据失败: ' + error.message });
    }
});

// 获取可用日期列表（需要认证）
app.get('/api/available-dates', authenticateToken, async (req, res) => {
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

// 删除指定日期的数据（需要认证）
app.delete('/api/admin/delete-data/:date', authenticateToken, async (req, res) => {
    try {
        const { date } = req.params;
        const dataPath = path.join(dataDir, `${date}.json`);
        
        if (await fs.pathExists(dataPath)) {
            await fs.remove(dataPath);
            res.json({ message: `数据删除成功: ${date}` });
        } else {
            res.status(404).json({ error: '数据文件不存在' });
        }
    } catch (error) {
        console.error('删除数据失败:', error);
        res.status(500).json({ error: '删除数据失败' });
    }
});

// 直接通过API更新数据（需要认证）
app.post('/api/update-data', authenticateToken, async (req, res) => {
    try {
        const newData = req.body;
        
        // 验证数据格式
        if (!newData.indices || !newData.marketAnalysis || !newData.importantEvents) {
            return res.status(400).json({ error: 'JSON格式不正确，缺少必要字段：indices, marketAnalysis, importantEvents' });
        }

        // 从请求中获取日期，如果没有则使用JSON中的日期
        let targetDate = newData.date;
        if (!targetDate) {
            const today = new Date();
            targetDate = today.toISOString().split('T')[0];
        }

        // 添加时间戳
        newData.lastUpdated = new Date().toISOString();

        // 根据日期保存数据文件
        const dateFileName = `${targetDate}.json`;
        const dateDataPath = path.join(dataDir, dateFileName);
        await fs.writeJson(dateDataPath, newData, { spaces: 2 });

        res.json({ 
            message: '数据更新成功',
            date: targetDate,
            filename: dateFileName,
            timestamp: newData.lastUpdated
        });
    } catch (error) {
        console.error('更新数据失败:', error);
        res.status(500).json({ error: '更新数据失败: ' + error.message });
    }
});

// 获取指定日期的AI职位数据
app.get('/api/aijob/:date?', async (req, res) => {
    try {
        let targetDate = req.params.date;
        
        // 如果没有指定日期，使用今天的日期
        if (!targetDate) {
            const today = new Date();
            targetDate = today.toISOString().split('T')[0]; // 格式：YYYY-MM-DD
        }
        
        const dataPath = path.join(dataDir, `aijob-${targetDate}.json`);
        
        // 检查是否存在指定日期的数据文件
        if (await fs.pathExists(dataPath)) {
            const data = await fs.readJson(dataPath);
            // 使用文件名中的日期，而不是JSON中的日期
            data.date = targetDate;
            res.json(data);
        } else {
            // 如果没有指定日期的数据，返回空数据
            res.status(404).json({ error: '没有找到该日期的AI职位数据' });
        }
    } catch (error) {
        console.error('获取AI职位数据失败:', error);
        res.status(500).json({ error: '获取AI职位数据失败' });
    }
});

// 保存AI职位数据（需要认证）
app.post('/api/aijob', authenticateToken, async (req, res) => {
    try {
        const newData = req.body;
        
        // 验证数据格式
        if (!newData.jobs || !Array.isArray(newData.jobs)) {
            return res.status(400).json({ error: 'JSON格式不正确，缺少jobs数组字段' });
        }

        // 从请求中获取日期，如果没有则使用JSON中的日期
        let targetDate = newData.date;
        if (!targetDate) {
            const today = new Date();
            targetDate = today.toISOString().split('T')[0];
        }

        // 添加时间戳
        newData.lastUpdated = new Date().toISOString();

        // 根据日期保存数据文件
        const dateFileName = `aijob-${targetDate}.json`;
        const dateDataPath = path.join(dataDir, dateFileName);
        await fs.writeJson(dateDataPath, newData, { spaces: 2 });

        res.json({ 
            message: 'AI职位数据保存成功',
            date: targetDate,
            filename: dateFileName,
            timestamp: newData.lastUpdated
        });
    } catch (error) {
        console.error('保存AI职位数据失败:', error);
        res.status(500).json({ error: '保存AI职位数据失败: ' + error.message });
    }
});

// 获取AI职位可用日期列表
app.get('/api/aijob-dates', async (req, res) => {
    try {
        const files = await fs.readdir(dataDir);
        const dateFiles = files
            .filter(file => file.match(/^aijob-\d{4}-\d{2}-\d{2}\.json$/))
            .map(file => {
                const date = file.replace('aijob-', '').replace('.json', '');
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
        console.error('获取AI职位可用日期失败:', error);
        res.status(500).json({ error: '获取AI职位可用日期失败' });
    }
});

// 删除指定日期的AI职位数据（需要认证）
app.delete('/api/admin/delete-aijob/:date', authenticateToken, async (req, res) => {
    try {
        const { date } = req.params;
        const dataPath = path.join(dataDir, `aijob-${date}.json`);
        
        if (await fs.pathExists(dataPath)) {
            await fs.remove(dataPath);
            res.json({ message: `AI职位数据删除成功: ${date}` });
        } else {
            res.status(404).json({ error: 'AI职位数据文件不存在' });
        }
    } catch (error) {
        console.error('删除AI职位数据失败:', error);
        res.status(500).json({ error: '删除AI职位数据失败' });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`美股信息网站服务器运行在 http://localhost:${PORT}`);
    console.log(`主页面: http://localhost:${PORT}/index.html`);
    console.log(`AI职位页面: http://localhost:${PORT}/aiJob.html`);
    console.log(`后台管理: http://localhost:${PORT}/admin.html`);
    console.log(`API接口:`);
    console.log(`  获取今天数据: http://localhost:${PORT}/api/data`);
    console.log(`  获取指定日期数据: http://localhost:${PORT}/api/data/YYYY-MM-DD`);
    console.log(`  获取今天AI职位: http://localhost:${PORT}/api/aijob`);
    console.log(`  获取指定日期AI职位: http://localhost:${PORT}/api/aijob/YYYY-MM-DD`);
    console.log(`  获取验证码: GET http://localhost:${PORT}/api/admin/captcha`);
    console.log(`  管理员登录: POST http://localhost:${PORT}/api/admin/login`);
    console.log(`  上传数据: POST http://localhost:${PORT}/api/upload-data`);
    console.log(`  更新数据: POST http://localhost:${PORT}/api/update-data`);
    console.log(`  保存AI职位: POST http://localhost:${PORT}/api/aijob`);
    console.log(`管理员账户: ${ADMIN_CREDENTIALS.username} / ${ADMIN_CREDENTIALS.password}`);
}); 