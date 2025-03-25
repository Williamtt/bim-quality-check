// test-forge-auth.js
const { AuthClientTwoLegged } = require('forge-apis');
const path = require('path');
const fs = require('fs');

// 使用絕對路徑載入.env文件
const envPath = path.resolve(__dirname, '.env');
console.log('嘗試載入.env文件路徑:', envPath);
console.log('.env文件存在:', fs.existsSync(envPath));

// 如果.env文件存在，則載入它
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('已從指定路徑載入.env文件');
} else {
  // 嘗試從當前工作目錄載入
  require('dotenv').config();
  console.log('已從當前工作目錄載入.env文件');
}

// 顯示環境變數詳細資訊（安全顯示）
console.log('環境變數檢查:');
console.log('FORGE_CLIENT_ID 存在:', !!process.env.FORGE_CLIENT_ID);
console.log('FORGE_CLIENT_ID 長度:', process.env.FORGE_CLIENT_ID ? process.env.FORGE_CLIENT_ID.length : 0);
console.log('FORGE_CLIENT_SECRET 存在:', !!process.env.FORGE_CLIENT_SECRET);
console.log('FORGE_CLIENT_SECRET 長度:', process.env.FORGE_CLIENT_SECRET ? process.env.FORGE_CLIENT_SECRET.length : 0);

// 嘗試認證
async function testAuth() {
  try {
    // 確保認證資訊存在
    if (!process.env.FORGE_CLIENT_ID || !process.env.FORGE_CLIENT_SECRET) {
      throw new Error('認證資訊缺失：請確保 FORGE_CLIENT_ID 和 FORGE_CLIENT_SECRET 環境變數已正確設置');
    }
    
    // 清理認證資訊（移除可能的空格和特殊字符）
    const clientId = process.env.FORGE_CLIENT_ID.trim();
    const clientSecret = process.env.FORGE_CLIENT_SECRET.trim();
    
    console.log('使用的 Client ID 前5個字符:', clientId.substring(0, 5) + '...');
    
    const client = new AuthClientTwoLegged(
      clientId,
      clientSecret,
      ['data:read', 'data:write', 'bucket:read', 'bucket:create'],
      true
    );
    
    console.log('嘗試認證...');
    const credentials = await client.authenticate();
    console.log('認證成功!');
    console.log('Token 類型:', credentials.token_type);
    console.log('有效期:', credentials.expires_in, '秒');
    return true;
  } catch (error) {
    console.error('認證失敗:');
    console.error(error);
    if (error.response && error.response.data) {
      console.error('錯誤詳情:', error.response.data);
      
      // 特定錯誤處理
      if (error.response.data.errorCode === 'AUTH-001') {
        console.error('錯誤原因: 應用程式未啟用必要的 API 服務。請前往 Forge 開發者門戶啟用 Data Management API 和 Model Derivative API。');
      }
    }
    return false;
  }
}

// 測試創建 Bucket
async function testCreateBucket() {
  try {
    console.log('開始測試創建 Bucket...');
    
    // 確保認證資訊存在
    if (!process.env.FORGE_CLIENT_ID || !process.env.FORGE_CLIENT_SECRET) {
      throw new Error('認證資訊缺失：請確保 FORGE_CLIENT_ID 和 FORGE_CLIENT_SECRET 環境變數已正確設置');
    }
    
    // 清理認證資訊（移除可能的空格和特殊字符）
    const clientId = process.env.FORGE_CLIENT_ID.trim();
    const clientSecret = process.env.FORGE_CLIENT_SECRET.trim();
    
    console.log('使用的 Client ID 前5個字符:', clientId.substring(0, 5) + '...');
    
    const { BucketsApi } = require('forge-apis');
    const { AuthClientTwoLegged } = require('forge-apis');
    
    const client = new AuthClientTwoLegged(
      clientId,
      clientSecret,
      ['data:read', 'data:write', 'bucket:read', 'bucket:create'],
      true
    );
    
    console.log('嘗試認證...');
    const credentials = await client.authenticate();
    console.log('認證成功!');
    console.log('Token 類型:', credentials.token_type);
    console.log('有效期:', credentials.expires_in, '秒');
    
    // 創建 Bucket API 實例
    console.log('創建 BucketsApi 實例...');
    const bucketApi = new BucketsApi();
    
    // 使用正確的 JSON 格式
    const bucketKey = 'test' + Math.floor(Math.random() * 1000); // 隨機 bucket 名稱避免衝突
    console.log(`嘗試創建 Bucket: ${bucketKey}`);
    
    // 直接構造 JSON 字符串，確保格式正確
    const bucketDataJson = `{"bucketKey":"${bucketKey}","policyKey":"persistent"}`;
    console.log('Bucket 數據:', bucketDataJson);
    
    // 解析回對象
    const bucketData = JSON.parse(bucketDataJson);
    
    try {
      // 嘗試使用不同的認證方式
      // 方式3：使用axios直接發送請求，手動設置Authorization header
      console.log('使用axios直接發送請求...');
      
      const axios = require('axios');
      
      // 設置請求頭
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `${credentials.token_type} ${credentials.access_token}`,
        'x-ads-region': 'US'
      };
      
      console.log('請求頭:', headers);
      
      // 直接使用axios發送請求
      const response = await axios.post(
        'https://developer.api.autodesk.com/oss/v2/buckets',
        bucketData,
        { headers }
      );
      
      console.log('Bucket 創建成功:', response.body);
      return true;
    } catch (apiErr) {
      console.error('創建 Bucket API 錯誤:', apiErr);
      
      if (apiErr.response && apiErr.response.body) {
        console.error('錯誤詳情:', apiErr.response.body);
      }
      
      return false;
    }
  } catch (error) {
    console.error('測試創建 Bucket 失敗:');
    console.error(error);
    return false;
  }
}

// 執行測試
async function runTests() {
  console.log('=== 開始測試 Forge API 認證 ===');
  const authResult = await testAuth();
  console.log('認證測試結果:', authResult ? '成功' : '失敗');
  
  console.log('\n=== 開始測試創建 Bucket ===');
  const bucketResult = await testCreateBucket();
  console.log('創建 Bucket 測試結果:', bucketResult ? '成功' : '失敗');
}

runTests().catch(err => {
  console.error('測試過程中發生錯誤:', err);
  process.exit(1);
});
