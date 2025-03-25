const forge = require('../config/forge');
const { BucketsApi, ObjectsApi, DerivativesApi } = require('forge-apis');
const fs = require('fs');
const path = require('path');

// 建立一個新的 Bucket（用於存儲模型檔案）
exports.createBucket = async (req, res) => {
  try {
    const { bucketKey } = req.body;
    
    if (!bucketKey) {
      return res.status(400).json({ error: '缺少必要的 bucketKey 參數' });
    }
    
    console.log(`嘗試創建 Bucket: ${bucketKey}`);
    
    // 檢查環境變量
    console.log('環境變量檢查:');
    console.log('FORGE_CLIENT_ID 是否設置:', process.env.FORGE_CLIENT_ID ? '是' : '否');
    console.log('FORGE_CLIENT_SECRET 是否設置:', process.env.FORGE_CLIENT_SECRET ? '是' : '否');
    
    // 獲取令牌
    console.log('正在獲取內部令牌...');
    const credentials = await forge.getInternalToken();
    console.log('成功獲取內部令牌');
    
    // 創建 Bucket API 實例
    console.log('創建 BucketsApi 實例...');
    
    // 直接構造 JSON 字符串，確保格式正確
    const bucketDataJson = `{"bucketKey":"${bucketKey}","policyKey":"persistent"}`;
    console.log('Bucket 數據 (JSON):', bucketDataJson);
    
    // 解析回對象
    const bucketData = JSON.parse(bucketDataJson);
    
    console.log('發送創建 Bucket 請求...');
    
    // 實現重試機制
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;
    const axios = require('axios');
    
    while (retryCount < maxRetries) {
      try {
        console.log(`創建 Bucket 嘗試 ${retryCount + 1}/${maxRetries}...`);
        
        // 正確傳遞 OAuth 參數
        console.log('使用令牌:', credentials.access_token ? '令牌存在' : '令牌缺失');
        console.log('令牌類型:', credentials.token_type);
        console.log('令牌前10個字符:', credentials.access_token.substring(0, 10) + '...');
        
        // 設置請求頭
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `${credentials.token_type} ${credentials.access_token}`,
          'x-ads-region': 'US'
        };
        
        console.log('請求頭:', {
          'Content-Type': headers['Content-Type'],
          'Authorization': `${credentials.token_type} ${credentials.access_token.substring(0, 10)}...`,
          'x-ads-region': headers['x-ads-region']
        });
        
        // 直接使用axios發送請求
        const response = await axios.post(
          'https://developer.api.autodesk.com/oss/v2/buckets',
          bucketData,
          { 
            headers,
            timeout: 60000 // 增加超時時間到 1 分鐘
          }
        );
        
        console.log('Bucket 創建成功:', response.data);
        return res.status(200).json({ 
          message: 'Bucket created successfully',
          bucketDetails: response.data
        });
      } catch (apiErr) {
        lastError = apiErr;
        console.error(`創建 Bucket 嘗試 ${retryCount + 1} 失敗:`, apiErr.message);
        
        // 檢查是否為 409 錯誤（Bucket 已存在）- 這不是錯誤，可以繼續
        if (apiErr.response && apiErr.response.status === 409) {
          console.log('Bucket 已存在，繼續處理');
          return res.status(200).json({ message: 'Bucket already exists' });
        }
        
        // 檢查是否為 401 錯誤（未授權）- 這種情況不需要重試
        if (apiErr.response && apiErr.response.status === 401) {
          console.error('認證錯誤 (401)。請檢查 Forge API 憑證是否有效。');
          console.error('錯誤詳情:', JSON.stringify(apiErr.response.data));
          
          return res.status(401).json({ 
            error: '認證錯誤。請檢查 Forge API 憑證是否有效。',
            details: apiErr.response.data
          });
        }
        
        // 檢查是否為 503 錯誤（服務不可用）- 這種情況需要重試
        if (apiErr.response && apiErr.response.status === 503) {
          console.log('Forge 服務暫時不可用 (503)，準備重試...');
          retryCount++;
          
          if (retryCount < maxRetries) {
            // 等待一段時間再重試 (指數退避策略)
            const waitTime = Math.pow(2, retryCount) * 1000;
            console.log(`等待 ${waitTime}ms 後重試...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // 其他錯誤或重試次數已用完
        break;
      }
    }
    
    // 所有重試都失敗了
    console.error('創建 Bucket 失敗，已達到最大重試次數:', lastError);
    
    // 檢查是否為 503 錯誤
    if (lastError.response && lastError.response.status === 503) {
      return res.status(503).json({ 
        error: 'Forge 服務暫時不可用，請稍後再試。',
        details: '服務器暫時過載或正在維護。這通常是暫時性問題，請等待幾分鐘後再嘗試。',
        retryAfter: '300' // 建議 5 分鐘後重試
      });
    }
    
    // 其他錯誤
    const statusCode = lastError.response ? lastError.response.status : 500;
    const errorDetails = lastError.response ? lastError.response.data : lastError.message;
    
    console.error('錯誤詳情:', JSON.stringify(errorDetails));
    res.status(statusCode).json({ 
      error: lastError.message,
      details: errorDetails
    });
  } catch (err) {
    console.error('創建 Bucket 過程中發生錯誤:', err);
    
    // 檢查是否為網絡錯誤
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: '網絡連接問題，無法連接到 Forge 服務。',
        details: '請檢查您的網絡連接，或者 Forge 服務可能暫時不可用。',
        retryAfter: '300' // 建議 5 分鐘後重試
      });
    }
    
    res.status(500).json({ error: '創建 Bucket 時發生錯誤: ' + err.message });
  }
};

    // 上傳模型檔案到 Bucket
exports.uploadModel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上傳檔案' });
    }
    
    console.log('開始上傳模型檔案...');
    console.log('檔案資訊:', {
      originalname: req.file.originalname,
      path: req.file.path,
      size: req.file.size
    });
    
    // 獲取認證令牌
    console.log('正在獲取內部令牌...');
    const credentials = await forge.getInternalToken();
    console.log('成功獲取內部令牌');
    console.log('令牌類型:', credentials.token_type);
    console.log('令牌前10個字符:', credentials.access_token.substring(0, 10) + '...');
    
    const objectsApi = new ObjectsApi();
    const bucketKey = req.params.bucketKey;
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    
    // 獲取檔案大小
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    console.log('檔案大小:', fileSize, '位元組');
    
    // 檢查檔案大小是否超過限制 (50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (fileSize > MAX_FILE_SIZE) {
      fs.unlinkSync(filePath); // 清理暫存檔案
      return res.status(400).json({ 
        error: '檔案大小超過限制',
        details: `檔案大小 ${(fileSize / (1024 * 1024)).toFixed(2)}MB 超過了最大限制 50MB`
      });
    }
    
    // 創建檔案流
    let fileStream = fs.createReadStream(filePath);
    
    console.log('開始上傳檔案到 Forge...');
    console.log('Bucket:', bucketKey);
    console.log('檔案名稱:', fileName);
    
    // 實現重試機制
    const maxRetries = 5; // 增加重試次數
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`上傳嘗試 ${retryCount + 1}/${maxRetries}...`);
        
        // 統一認證參數傳遞方式
        const response = await objectsApi.uploadObject(
          bucketKey,
          fileName,
          fileSize,
          fileStream,
          { 
            autoRefresh: true, 
            credentials: {
              client_id: process.env.FORGE_CLIENT_ID,
              client_secret: process.env.FORGE_CLIENT_SECRET,
              token_type: credentials.token_type,
              access_token: credentials.access_token,
              expires_in: credentials.expires_in
            },
            timeout: 300000 // 增加超時時間到 5 分鐘
          },
          {}  // 移除額外的 access_token 參數
        );
        
        console.log('檔案上傳成功:', response.body.objectId);
        
        // 清理暫存檔案
        fs.unlinkSync(filePath);
        console.log('已清理暫存檔案:', filePath);
        
        return res.status(200).json({
          objectId: response.body.objectId,
          bucketKey: bucketKey,
          objectKey: fileName
        });
      } catch (apiErr) {
        lastError = apiErr;
        console.error(`上傳嘗試 ${retryCount + 1} 失敗:`, apiErr.message);
        
        // 檢查是否為 401 錯誤（未授權）- 這種情況不需要重試
        if (apiErr.statusCode === 401) {
          console.error('認證錯誤 (401)。請檢查 Forge API 憑證是否有效。');
          console.error('錯誤詳情:', JSON.stringify(apiErr.response ? apiErr.response.body : apiErr.message));
          
          // 清理暫存檔案
          try { fs.unlinkSync(filePath); } catch (e) { console.error('清理檔案失敗:', e); }
          
          return res.status(401).json({ 
            error: 'Forge API 認證錯誤 (401)。請檢查 API 密鑰是否有效，或者是否已過期。',
            details: '認證錯誤。請檢查 Forge API 憑證是否有效。'
          });
        }
        
        // 檢查是否為網絡錯誤或服務不可用 - 這種情況需要重試
        if (apiErr.statusCode === 503 || 
            apiErr.code === 'ECONNRESET' || 
            apiErr.code === 'ETIMEDOUT' || 
            apiErr.code === 'ECONNREFUSED' ||
            apiErr.message.includes('socket hang up') ||
            (apiErr.response && apiErr.response.status === 503)) {
          console.log(`網絡錯誤或Forge服務暫時不可用 (${apiErr.code || apiErr.statusCode || apiErr.message})，準備重試...`);
          retryCount++;
          
          if (retryCount < maxRetries) {
            // 等待一段時間再重試 (指數退避策略)
            const waitTime = Math.pow(2, retryCount) * 2000; // 增加等待時間
            console.log(`等待 ${waitTime}ms 後重試...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // 重新創建檔案流，因為前一個可能已經關閉
            try {
              if (fileStream) {
                fileStream.destroy();
              }
              fileStream = fs.createReadStream(filePath);
              console.log('已重新創建檔案流');
            } catch (streamErr) {
              console.error('重新創建檔案流時發生錯誤:', streamErr);
              // 嘗試再次創建
              fileStream = fs.createReadStream(filePath);
            }
            
            continue;
          }
        }
        
        // 其他錯誤或重試次數已用完
        break;
      }
    }
    
    // 所有重試都失敗了
    console.error('上傳檔案失敗，已達到最大重試次數:', lastError);
    
    // 清理暫存檔案
    try { fs.unlinkSync(filePath); } catch (e) { console.error('清理檔案失敗:', e); }
    
    // 檢查是否為網絡錯誤或服務不可用
    if (lastError.statusCode === 503 || 
        lastError.code === 'ECONNRESET' || 
        lastError.code === 'ETIMEDOUT' || 
        lastError.code === 'ECONNREFUSED' ||
        lastError.message.includes('socket hang up') ||
        (lastError.response && lastError.response.status === 503)) {
      console.error('詳細錯誤信息:', lastError);
      return res.status(503).json({ 
        error: '網絡連接問題或Forge服務暫時不可用，請稍後再試。',
        details: '可能是網絡連接不穩定、服務器暫時過載或正在維護。這通常是暫時性問題，請等待幾分鐘後再嘗試上傳。',
        retryAfter: '300', // 建議 5 分鐘後重試
        errorCode: lastError.code || '',
        errorMessage: lastError.message || ''
      });
    }
    
    // 其他錯誤
    res.status(lastError.statusCode || 500).json({ 
      error: '上傳模型時發生錯誤: ' + lastError.message,
      details: lastError.response ? lastError.response.body : null
    });
  } catch (err) {
    console.error('上傳檔案過程中發生錯誤:', err);
    
    // 嘗試清理暫存檔案
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path); } catch (e) { console.error('清理檔案失敗:', e); }
    }
    
    // 檢查是否為網絡錯誤
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: '網絡連接問題，無法連接到 Forge 服務。',
        details: '請檢查您的網絡連接，或者 Forge 服務可能暫時不可用。',
        retryAfter: '300' // 建議 5 分鐘後重試
      });
    }
    
    res.status(500).json({ error: '上傳模型時發生錯誤: ' + err.message });
  }
};

// 轉換模型以供 Viewer 使用
exports.translateModel = async (req, res) => {
  try {
    const { bucketKey, objectName } = req.body;
    
    console.log('開始轉換模型...');
    console.log('Bucket:', bucketKey);
    console.log('物件名稱:', objectName);
    
    // 獲取認證令牌
    console.log('正在獲取內部令牌...');
    const credentials = await forge.getInternalToken();
    console.log('成功獲取內部令牌');
    
    const derivativesApi = new DerivativesApi();
    
    // 建立 URN（Base64 編碼的 ObjectId）
    const objectId = `urn:adsk.objects:os.object:${bucketKey}/${objectName}`;
    const urn = Buffer.from(objectId).toString('base64');
    console.log('生成的 URN:', urn);
    
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
    
    console.log('開始轉換工作...');
    
    // 實現重試機制
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`轉換嘗試 ${retryCount + 1}/${maxRetries}...`);
        
        // 統一認證參數傳遞方式
        await derivativesApi.translate(
          job, 
          { 
            autoRefresh: true, 
            credentials: {
              client_id: process.env.FORGE_CLIENT_ID,
              client_secret: process.env.FORGE_CLIENT_SECRET,
              token_type: credentials.token_type,
              access_token: credentials.access_token,
              expires_in: credentials.expires_in
            },
            timeout: 120000 // 增加超時時間到 2 分鐘
          },
          {}  // 移除額外的 access_token 參數
        );
        
        console.log('轉換工作已成功啟動');
        
        return res.status(200).json({
          urn: urn,
          message: '模型轉換已成功啟動'
        });
      } catch (apiErr) {
        lastError = apiErr;
        console.error(`轉換嘗試 ${retryCount + 1} 失敗:`, apiErr.message);
        
        // 檢查是否為 401 錯誤（未授權）- 這種情況不需要重試
        if (apiErr.statusCode === 401) {
          console.error('認證錯誤 (401)。請檢查 Forge API 憑證是否有效。');
          console.error('錯誤詳情:', JSON.stringify(apiErr.response ? apiErr.response.body : apiErr.message));
          
          return res.status(401).json({ 
            error: 'Forge API 認證錯誤 (401)。請檢查 API 密鑰是否有效，或者是否已過期。',
            details: '認證錯誤。請檢查 Forge API 憑證是否有效。'
          });
        }
        
        // 檢查是否為 503 錯誤（服務不可用）- 這種情況需要重試
        if (apiErr.statusCode === 503 || (apiErr.response && apiErr.response.status === 503)) {
          console.log('Forge 服務暫時不可用 (503)，準備重試...');
          retryCount++;
          
          if (retryCount < maxRetries) {
            // 等待一段時間再重試 (指數退避策略)
            const waitTime = Math.pow(2, retryCount) * 1000;
            console.log(`等待 ${waitTime}ms 後重試...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // 其他錯誤或重試次數已用完
        break;
      }
    }
    
    // 所有重試都失敗了
    console.error('轉換模型失敗，已達到最大重試次數:', lastError);
    
    // 檢查是否為 503 錯誤
    if (lastError.statusCode === 503 || (lastError.response && lastError.response.status === 503)) {
      return res.status(503).json({ 
        error: 'Forge 服務暫時不可用，請稍後再試。',
        details: '服務器暫時過載或正在維護。這通常是暫時性問題，請等待幾分鐘後再嘗試轉換。',
        retryAfter: '300' // 建議 5 分鐘後重試
      });
    }
    
    // 其他錯誤
    res.status(lastError.statusCode || 500).json({ 
      error: '轉換模型時發生錯誤: ' + lastError.message,
      details: lastError.response ? lastError.response.body : null
    });
  } catch (err) {
    console.error('轉換模型過程中發生錯誤:', err);
    
    // 檢查是否為網絡錯誤
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: '網絡連接問題，無法連接到 Forge 服務。',
        details: '請檢查您的網絡連接，或者 Forge 服務可能暫時不可用。',
        retryAfter: '300' // 建議 5 分鐘後重試
      });
    }
    
    res.status(500).json({ error: '轉換模型時發生錯誤: ' + err.message });
  }
};

// 獲取可用於 Viewer 的令牌
exports.getViewerToken = async (req, res) => {
  try {
    console.log('正在獲取 Viewer 令牌...');
    
    // 實現重試機制
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`獲取 Viewer 令牌嘗試 ${retryCount + 1}/${maxRetries}...`);
        
        const token = await forge.getPublicToken();
        console.log('成功獲取 Viewer 令牌');
        
        return res.status(200).json({
          access_token: token,
          expires_in: 3600
        });
      } catch (apiErr) {
        lastError = apiErr;
        console.error(`獲取 Viewer 令牌嘗試 ${retryCount + 1} 失敗:`, apiErr.message);
        
        // 檢查是否為 401 錯誤（未授權）- 這種情況不需要重試
        if (apiErr.statusCode === 401 || (apiErr.response && apiErr.response.statusCode === 401)) {
          console.error('認證錯誤 (401)。請檢查 Forge API 憑證是否有效。');
          
          return res.status(401).json({ 
            error: 'Forge API 認證錯誤 (401)。請檢查 API 密鑰是否有效，或者是否已過期。',
            details: '認證錯誤。請檢查 Forge API 憑證是否有效。'
          });
        }
        
        // 檢查是否為 503 錯誤（服務不可用）- 這種情況需要重試
        if (apiErr.statusCode === 503 || (apiErr.response && apiErr.response.status === 503)) {
          console.log('Forge 服務暫時不可用 (503)，準備重試...');
          retryCount++;
          
          if (retryCount < maxRetries) {
            // 等待一段時間再重試 (指數退避策略)
            const waitTime = Math.pow(2, retryCount) * 1000;
            console.log(`等待 ${waitTime}ms 後重試...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // 其他錯誤或重試次數已用完
        break;
      }
    }
    
    // 所有重試都失敗了
    console.error('獲取 Viewer 令牌失敗，已達到最大重試次數:', lastError);
    
    // 檢查是否為 503 錯誤
    if (lastError.statusCode === 503 || (lastError.response && lastError.response.status === 503)) {
      return res.status(503).json({ 
        error: 'Forge 服務暫時不可用，請稍後再試。',
        details: '服務器暫時過載或正在維護。這通常是暫時性問題，請等待幾分鐘後再嘗試。',
        retryAfter: '60' // 建議 1 分鐘後重試
      });
    }
    
    // 其他錯誤
    res.status(lastError.statusCode || 500).json({ 
      error: '獲取 Viewer 令牌時發生錯誤: ' + lastError.message,
      details: lastError.response ? lastError.response.body : null
    });
  } catch (err) {
    console.error('獲取 Viewer 令牌過程中發生錯誤:', err);
    
    // 檢查是否為網絡錯誤
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: '網絡連接問題，無法連接到 Forge 服務。',
        details: '請檢查您的網絡連接，或者 Forge 服務可能暫時不可用。',
        retryAfter: '60' // 建議 1 分鐘後重試
      });
    }
    
    res.status(500).json({ error: '獲取 Viewer 令牌時發生錯誤: ' + err.message });
  }
};

// 檢查模型轉換狀態
exports.getModelStatus = async (req, res) => {
  try {
    const { urn } = req.params;
    console.log('檢查模型轉換狀態，URN:', urn);
    
    // 獲取認證令牌
    console.log('正在獲取內部令牌...');
    const credentials = await forge.getInternalToken();
    console.log('成功獲取內部令牌');
    
    const derivativesApi = new DerivativesApi();
    
    // 實現重試機制
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`獲取模型狀態嘗試 ${retryCount + 1}/${maxRetries}...`);
        
        // 統一認證參數傳遞方式
        const manifestResponse = await derivativesApi.getManifest(
          urn, 
          { 
            autoRefresh: true, 
            credentials: {
              client_id: process.env.FORGE_CLIENT_ID,
              client_secret: process.env.FORGE_CLIENT_SECRET,
              token_type: credentials.token_type,
              access_token: credentials.access_token,
              expires_in: credentials.expires_in
            },
            timeout: 60000 // 增加超時時間到 1 分鐘
          },
          {}  // 移除額外的 access_token 參數
        );
        
        console.log('成功獲取模型狀態');
        return res.status(200).json(manifestResponse.body);
      } catch (apiErr) {
        lastError = apiErr;
        console.error(`獲取模型狀態嘗試 ${retryCount + 1} 失敗:`, apiErr.message);
        
        // 檢查是否為 401 錯誤（未授權）- 這種情況不需要重試
        if (apiErr.statusCode === 401) {
          console.error('認證錯誤 (401)。請檢查 Forge API 憑證是否有效。');
          console.error('錯誤詳情:', JSON.stringify(apiErr.response ? apiErr.response.body : apiErr.message));
          
          return res.status(401).json({ 
            error: 'Forge API 認證錯誤 (401)。請檢查 API 密鑰是否有效，或者是否已過期。',
            details: '認證錯誤。請檢查 Forge API 憑證是否有效。'
          });
        }
        
        // 檢查是否為 503 錯誤（服務不可用）- 這種情況需要重試
        if (apiErr.statusCode === 503 || (apiErr.response && apiErr.response.status === 503)) {
          console.log('Forge 服務暫時不可用 (503)，準備重試...');
          retryCount++;
          
          if (retryCount < maxRetries) {
            // 等待一段時間再重試 (指數退避策略)
            const waitTime = Math.pow(2, retryCount) * 1000;
            console.log(`等待 ${waitTime}ms 後重試...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // 其他錯誤或重試次數已用完
        break;
      }
    }
    
    // 所有重試都失敗了
    console.error('獲取模型狀態失敗，已達到最大重試次數:', lastError);
    
    // 檢查是否為 503 錯誤
    if (lastError.statusCode === 503 || (lastError.response && lastError.response.status === 503)) {
      return res.status(503).json({ 
        error: 'Forge 服務暫時不可用，請稍後再試。',
        details: '服務器暫時過載或正在維護。這通常是暫時性問題，請等待幾分鐘後再嘗試檢查。',
        retryAfter: '60' // 建議 1 分鐘後重試
      });
    }
    
    // 其他錯誤
    res.status(lastError.statusCode || 500).json({ 
      error: '檢查模型狀態時發生錯誤: ' + lastError.message,
      details: lastError.response ? lastError.response.body : null
    });
  } catch (err) {
    console.error('檢查模型狀態過程中發生錯誤:', err);
    
    // 檢查是否為網絡錯誤
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({ 
        error: '網絡連接問題，無法連接到 Forge 服務。',
        details: '請檢查您的網絡連接，或者 Forge 服務可能暫時不可用。',
        retryAfter: '60' // 建議 1 分鐘後重試
      });
    }
    
    res.status(500).json({ error: '檢查模型狀態時發生錯誤: ' + err.message });
  }
};
