const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  // 文件基本資訊
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  filePath: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  
  // BIM 模型參照資訊
  modelUrn: {
    type: String,
    required: true
  },
  // 在 BIM 模型中的位置座標
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true }
  },
  // 被標記的元件 ID，如果有的話
  elementId: {
    type: String,
    default: null
  },
  // 被標記的元件 dbId（Forge 使用）
  elementDbId: {
    type: Number,
    default: null
  },
  
  // 品質檢查相關資訊
  inspector: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'passed', 'failed', 'needs-review'],
    default: 'pending'
  },
  comments: [
    {
      user: String,
      content: String,
      date: {
        type: Date,
        default: Date.now
      }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Document', DocumentSchema);