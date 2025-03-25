const express = require('express');
const router = express.Router();
const forgeController = require('../controllers/forge-controller');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // 暫存上傳目錄

// 取得 Viewer 令牌
router.get('/token', forgeController.getViewerToken);

// 建立存儲桶
router.post('/buckets', forgeController.createBucket);

// 上傳模型檔案
router.post('/buckets/:bucketKey/objects', upload.single('model'), forgeController.uploadModel);

// 啟動模型轉換
router.post('/models/translate', forgeController.translateModel);

// 檢查模型轉換狀態
router.get('/models/:urn/status', forgeController.getModelStatus);

module.exports = router;