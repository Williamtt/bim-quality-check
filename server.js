const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// 載入環境變數
dotenv.config();
// 測試環境變數是否正確載入
console.log('Forge Client ID:', process.env.FORGE_CLIENT_ID ? '已設定' : '未設定');
console.log('Forge Client Secret:', process.env.FORGE_CLIENT_SECRET ? '已設定' : '未設定');
// 初始化 Express 應用程式
const app = express();
const PORT = process.env.PORT || 3000;

// 中間件設定
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 資料庫連線
require('./server/config/db');

// 路由設定
const forgeRoutes = require('./server/routes/forge');
const apiRoutes = require('./server/routes/api');

app.use('/api/forge', forgeRoutes);
app.use('/api', apiRoutes);

// 處理前端路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;