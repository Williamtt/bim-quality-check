// 使用絕對路徑載入環境變量
const path = require('path');
const fs = require('fs');

// 嘗試從多個可能的位置載入.env文件
const possibleEnvPaths = [
  path.resolve(__dirname, '../../.env'),  // 從config目錄向上兩層 (server/config -> server -> project root)
  path.resolve(process.cwd(), '.env'),    // 從當前工作目錄
  path.resolve(process.cwd(), 'bim-quality-check/.env')  // 從當前工作目錄的子目錄
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log('[INFO] 已從路徑載入.env文件:', envPath);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('[警告] 未找到.env文件，嘗試使用默認配置載入');
  require('dotenv').config();
}

const { AuthClientTwoLegged } = require('forge-apis');

// 環境變量檢查
console.log('[DEBUG] 環境變量檢查:');
console.log('FORGE_CLIENT_ID 存在:', !!process.env.FORGE_CLIENT_ID);
console.log('FORGE_CLIENT_ID 長度:', process.env.FORGE_CLIENT_ID ? process.env.FORGE_CLIENT_ID.length : 0);
console.log('FORGE_CLIENT_SECRET 存在:', !!process.env.FORGE_CLIENT_SECRET);
console.log('FORGE_CLIENT_SECRET 長度:', process.env.FORGE_CLIENT_SECRET ? process.env.FORGE_CLIENT_SECRET.length : 0);

// 清理認證資訊（移除可能的空格和特殊字符）
const sanitizeCredentials = (value) => {
  if (!value) return '';
  // 先移除頭尾空格，再移除可能的引號
  return value.trim().replace(/^["']|["']$/g, '');
};

// 使用清理後的認證資訊
const FORGE_CLIENT_ID = sanitizeCredentials(process.env.FORGE_CLIENT_ID);
const FORGE_CLIENT_SECRET = sanitizeCredentials(process.env.FORGE_CLIENT_SECRET);
const FORGE_CALLBACK_URL = sanitizeCredentials(process.env.FORGE_CALLBACK_URL);

// 檢查環境變量是否已設置
if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET) {
  console.error('[錯誤] Forge API 認證信息未設置。請確保 FORGE_CLIENT_ID 和 FORGE_CLIENT_SECRET 環境變量已正確設置。');
  console.log('當前 FORGE_CLIENT_ID:', FORGE_CLIENT_ID ? `已設置 (${FORGE_CLIENT_ID.substring(0, 5)}...)` : '未設置');
  console.log('當前 FORGE_CLIENT_SECRET:', FORGE_CLIENT_SECRET ? `已設置 (${FORGE_CLIENT_SECRET.substring(0, 5)}...)` : '未設置');
}

// 設定 API 權限範圍
const scopes = [
  'data:read',
  'data:write',
  'data:create',
  'bucket:create',
  'bucket:read',
  'bucket:update',
  'bucket:delete',
  'viewables:read'
];

// 建立 Forge 認證物件
const getClient = () => {
  if (!FORGE_CLIENT_ID || !FORGE_CLIENT_SECRET) {
    throw new Error('Forge API 認證信息未設置。請確保 FORGE_CLIENT_ID 和 FORGE_CLIENT_SECRET 環境變量已正確設置。');
  }
  
  console.log('[INFO] 正在創建 Forge 客戶端，使用 ID:', FORGE_CLIENT_ID.substring(0, 5) + '...');
  
  return new AuthClientTwoLegged(
    FORGE_CLIENT_ID,
    FORGE_CLIENT_SECRET,
    scopes,
    true
  );
};

// 生成公開令牌（無需認證）
const getPublicToken = async () => {
  const client = getClient();
  try {
    console.log('[INFO] 正在獲取公開令牌...');
    const credentials = await client.authenticate();
    return credentials.access_token;
  } catch (err) {
    console.error('[錯誤] 獲取公開令牌時發生錯誤:', err.message);
    if (err.response && err.response.data) {
      console.error('[錯誤] 詳情:', JSON.stringify(err.response.data));
      
      // 特定錯誤處理
      if (err.response.data.errorCode === 'AUTH-001') {
        console.error('[錯誤] 原因: 應用程式未啟用必要的 API 服務。請前往 Forge 開發者門戶啟用 Data Management API 和 Model Derivative API。');
      }
    }
    throw err;
  }
};

// 生成內部令牌（需認證）
const getInternalToken = async () => {
  const client = getClient();
  try {
    console.log('[INFO] 正在獲取內部令牌...');
    const credentials = await client.authenticate();
    console.log('[INFO] 成功獲取內部令牌');
    console.log('[DEBUG] 令牌詳情:');
    console.log('- 令牌類型:', credentials.token_type);
    console.log('- 有效期:', credentials.expires_in, '秒');
    console.log('- 令牌前10個字符:', credentials.access_token.substring(0, 10) + '...');
    
    // 確保返回正確的結構，包含 client 和 token
    return credentials;
  } catch (err) {
    console.error('[錯誤] 獲取內部令牌時發生錯誤:', err.message);
    if (err.response && err.response.data) {
      console.error('[錯誤] 詳情:', JSON.stringify(err.response.data));
    }
    throw err;
  }
};

module.exports = {
  getClient,
  getPublicToken,
  getInternalToken,
  FORGE_CLIENT_ID,
  FORGE_CLIENT_SECRET,
  FORGE_CALLBACK_URL
};
