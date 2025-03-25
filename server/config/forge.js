const { AuthClientTwoLegged } = require('forge-apis');

// 設定 Forge 認證
const FORGE_CLIENT_ID = process.env.FORGE_CLIENT_ID;
const FORGE_CLIENT_SECRET = process.env.FORGE_CLIENT_SECRET;
const FORGE_CALLBACK_URL = process.env.FORGE_CALLBACK_URL;

// 設定 API 權限範圍
const scopes = [
  'data:read',
  'data:write',
  'data:create',
  'bucket:create',
  'bucket:read'
];

// 建立 Forge 認證物件
const getClient = () => {
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
    const credentials = await client.authenticate();
    return credentials.access_token;
  } catch (err) {
    console.error('Error getting public token:', err);
    throw err;
  }
};

// 生成內部令牌（需認證）
const getInternalToken = async () => {
  const client = getClient();
  try {
    const credentials = await client.authenticate();
    return credentials;
  } catch (err) {
    console.error('Error getting internal token:', err);
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