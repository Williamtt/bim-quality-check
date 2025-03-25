const Document = require('../models/document');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 設定檔案存儲
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/uploads');
    // 確保上傳目錄存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一檔名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// 設定檔案過濾
const fileFilter = (req, file, cb) => {
  // 允許的檔案類型
  const allowedTypes = [
    'image/jpeg', 
    'image/png', 
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支援的檔案類型'), false);
  }
};

// 設定 multer 上傳
exports.upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 限制 10MB
  }
}).single('document');

// 儲存品質檢查文件
exports.saveDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上傳檔案' });
    }
    
    // 創建相對路徑，用於存儲在資料庫中
    const filePath = `/uploads/${req.file.filename}`;
    
    // 從請求中獲取資料
    const {
      title,
      description,
      modelUrn,
      position,
      elementId,
      elementDbId,
      inspector,
      status
    } = req.body;
    
    // 解析位置座標
    const positionObj = typeof position === 'string'
      ? JSON.parse(position)
      : position;
      
    // 創建新文件記錄
    const newDocument = new Document({
      title,
      description,
      filePath,
      fileType: req.file.mimetype,
      modelUrn,
      position: positionObj,
      elementId: elementId || null,
      elementDbId: elementDbId || null,
      inspector,
      status: status || 'pending'
    });
    
    // 儲存至資料庫
    await newDocument.save();
    
    res.status(201).json({
      message: '文件上傳成功',
      document: newDocument
    });
  } catch (err) {
    console.error('儲存文件錯誤:', err);
    res.status(500).json({ error: err.message });
  }
};

// 獲取與特定模型相關的所有文件
exports.getDocumentsByModel = async (req, res) => {
  try {
    const { modelUrn } = req.params;
    
    const documents = await Document.find({ modelUrn });
    
    res.status(200).json(documents);
  } catch (err) {
    console.error('獲取文件錯誤:', err);
    res.status(500).json({ error: err.message });
  }
};

// 獲取單一文件資訊
exports.getDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({ error: '找不到文件' });
    }
    
    res.status(200).json(document);
  } catch (err) {
    console.error('獲取文件錯誤:', err);
    res.status(500).json({ error: err.message });
  }
};

// 更新文件資訊
exports.updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const document = await Document.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!document) {
      return res.status(404).json({ error: '找不到文件' });
    }
    
    res.status(200).json(document);
  } catch (err) {
    console.error('更新文件錯誤:', err);
    res.status(500).json({ error: err.message });
  }
};

// 刪除文件
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({ error: '找不到文件' });
    }
    
    // 刪除實體檔案
    const filePath = path.join(__dirname, '../../public', document.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // 從資料庫中刪除記錄
    await Document.findByIdAndDelete(id);
    
    res.status(200).json({ message: '文件已刪除' });
  } catch (err) {
    console.error('刪除文件錯誤:', err);
    res.status(500).json({ error: err.message });
  }
};

// 新增評論
exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { user, content } = req.body;
    
    if (!user || !content) {
      return res.status(400).json({ error: '使用者名稱和內容為必填項' });
    }
    
    const document = await Document.findById(id);
    
    if (!document) {
      return res.status(404).json({ error: '找不到文件' });
    }
    
    document.comments.push({ user, content });
    await document.save();
    
    res.status(200).json(document);
  } catch (err) {
    console.error('新增評論錯誤:', err);
    res.status(500).json({ error: err.message });
  }
};