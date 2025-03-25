const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document-controller');

// 上傳品質檢查文件
router.post('/documents', (req, res, next) => {
  documentController.upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, documentController.saveDocument);

// 獲取特定模型的所有文件
router.get('/models/:modelUrn/documents', documentController.getDocumentsByModel);

// 獲取單一文件資訊
router.get('/documents/:id', documentController.getDocument);

// 更新文件資訊
router.put('/documents/:id', documentController.updateDocument);

// 刪除文件
router.delete('/documents/:id', documentController.deleteDocument);

// 為文件新增評論
router.post('/documents/:id/comments', documentController.addComment);

module.exports = router;