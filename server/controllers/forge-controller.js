const forge = require('../config/forge');
const { BucketsApi, ObjectsApi, DerivativesApi } = require('forge-apis');
const fs = require('fs');
const path = require('path');

// 建立一個新的 Bucket（用於存儲模型檔案）
exports.createBucket = async (req, res) => {
  try {
    const { bucketKey } = req.body;
    const token = await forge.getInternalToken();
    const bucketApi = new BucketsApi();
    
    const bucketData = {
      bucketKey,
      policyKey: 'persistent' // 可選擇 'temporary' 或 'transient'
    };
    
    await bucketApi.createBucket(bucketData, {}, token);
    res.status(200).json({ message: 'Bucket created successfully' });
  } catch (err) {
    console.error('Error creating bucket:', err);
    res.status(500).json({ error: err.message });
  }
};

// 上傳模型檔案到 Bucket
exports.uploadModel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const token = await forge.getInternalToken();
    const objectsApi = new ObjectsApi();
    const bucketKey = req.params.bucketKey;
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    
    const fileStream = fs.createReadStream(filePath);
    
    const response = await objectsApi.uploadObject(
      bucketKey,
      fileName,
      fileStream.byteLength,
      fileStream,
      {},
      token
    );
    
    // 清理暫存檔案
    fs.unlinkSync(filePath);
    
    res.status(200).json({
      objectId: response.body.objectId,
      bucketKey: bucketKey,
      objectKey: fileName
    });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({ error: err.message });
  }
};

// 轉換模型以供 Viewer 使用
exports.translateModel = async (req, res) => {
  try {
    const { bucketKey, objectName } = req.body;
    const token = await forge.getInternalToken();
    const derivativesApi = new DerivativesApi();
    
    // 建立 URN（Base64 編碼的 ObjectId）
    const objectId = `urn:adsk.objects:os.object:${bucketKey}/${objectName}`;
    const urn = Buffer.from(objectId).toString('base64');
    
    // 設定轉換工作
    const job = {
      input: {
        urn: urn
      },
      output: {
        formats: [
          {
            type: 'svf',
            views: ['2d', '3d']
          }
        ]
      }
    };
    
    // 開始轉換工作
    await derivativesApi.translate(job, {}, token);
    
    res.status(200).json({
      urn: urn,
      message: 'Translation started successfully'
    });
  } catch (err) {
    console.error('Error translating model:', err);
    res.status(500).json({ error: err.message });
  }
};

// 獲取可用於 Viewer 的令牌
exports.getViewerToken = async (req, res) => {
  try {
    const token = await forge.getPublicToken();
    res.status(200).json({
      access_token: token,
      expires_in: 3600
    });
  } catch (err) {
    console.error('Error getting viewer token:', err);
    res.status(500).json({ error: err.message });
  }
};

// 檢查模型轉換狀態
exports.getModelStatus = async (req, res) => {
  try {
    const { urn } = req.params;
    const token = await forge.getInternalToken();
    const derivativesApi = new DerivativesApi();
    
    const manifestResponse = await derivativesApi.getManifest(urn, {}, token);
    
    res.status(200).json(manifestResponse.body);
  } catch (err) {
    console.error('Error checking model status:', err);
    res.status(500).json({ error: err.message });
  }
};