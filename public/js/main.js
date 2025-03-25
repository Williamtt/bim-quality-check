// 等待 DOM 加載完成
document.addEventListener('DOMContentLoaded', () => {
    // 綁定上傳模型按鈕
    document.getElementById('uploadModelBtn').addEventListener('click', () => {
      const uploadModelModal = new bootstrap.Modal(document.getElementById('uploadModelModal'));
      uploadModelModal.show();
    });
    
    // 綁定添加文件按鈕
    document.getElementById('addDocumentBtn').addEventListener('click', () => {
      if (window.forgeViewer) {
        window.forgeViewer.openUploadDocumentDialog();
      }
    });
    
    // 綁定說明按鈕
    document.getElementById('helpBtn').addEventListener('click', showHelpDialog);
    
    // 綁定上傳模型表單
    document.getElementById('uploadModelSubmit').addEventListener('click', uploadModel);
    
    // 綁定上傳文件表單
    document.getElementById('uploadDocumentSubmit').addEventListener('click', uploadDocument);
  });
  
  // 顯示說明對話框
  function showHelpDialog() {
    const content = `
      <div class="modal fade" id="helpModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">使用說明</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <h6>基本操作</h6>
              <ul>
                <li>使用滑鼠拖動可旋轉模型視角</li>
                <li>使用滑鼠滾輪可放大/縮小模型</li>
                <li>按住 Shift 鍵並拖動可平移視角</li>
                <li>點擊模型中的元素可選擇它</li>
                <li>點擊模型上的彩色圓點可查看相關的品質檢查文件</li>
              </ul>
              
              <h6>上傳 BIM 模型</h6>
              <p>點擊頂部選單的「上傳模型」按鈕，然後在對話框中選擇 BIM 模型檔案。支援 Revit、AutoCAD、Navisworks、Rhino 和 IFC 檔案。</p>
              
              <h6>上傳品質檢查文件</h6>
              <p>先在模型中選擇一個位置或元素，然後點擊右側面板底部的「新增品質檢查文件」按鈕。填寫相關資訊並上傳檢查文件即可。</p>
              
              <h6>查看文件</h6>
              <p>點擊模型上的彩色圓點標記或在右側面板中的文件列表中點擊文件名稱，即可查看文件詳情。在詳情頁中，您可以預覽、下載文件，以及添加評論。</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // 添加對話框到文檔
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    document.body.appendChild(tempDiv.firstElementChild);
    
    // 顯示對話框
    const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
    helpModal.show();
    
    // 對話框關閉時移除元素
    document.getElementById('helpModal').addEventListener('hidden.bs.modal', function () {
      this.remove();
    });
  }
  
  // 上傳 BIM 模型
  async function uploadModel() {
    const bucketNameInput = document.getElementById('bucketName');
    const modelFileInput = document.getElementById('modelFile');
    
    const bucketName = bucketNameInput.value.trim();
    const modelFile = modelFileInput.files[0];
    
    if (!bucketName || !modelFile) {
      alert('請填寫所有必填欄位');
      return;
    }
    
    // 檢查桶名格式
    const bucketNameRegex = /^[a-z0-9-]+$/;
    if (!bucketNameRegex.test(bucketName)) {
      alert('存儲桶名稱只能包含小寫字母、數字和短橫線');
      return;
    }
    
    try {
      // 顯示上傳進度
      document.getElementById('uploadModelSubmit').disabled = true;
      
      if (!document.querySelector('.progress-container')) {
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        progressContainer.innerHTML = `
          <div class="progress">
            <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%"></div>
          </div>
          <div class="text-center mt-2" id="progressText">正在創建存儲桶...</div>
        `;
        document.querySelector('.modal-body').appendChild(progressContainer);
      }
      
      // 更新進度文字
      const progressText = document.getElementById('progressText');
      const progressBar = document.querySelector('.progress-bar');
      
      // 步驟 1: 創建存儲桶
      progressText.textContent = '正在創建存儲桶...';
      progressBar.style.width = '20%';
      
      try {
        console.log('正在創建存儲桶:', bucketName);
        const createBucketResponse = await fetch('/api/forge/buckets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ bucketKey: bucketName })
        });
        
        // 檢查響應狀態
        console.log('創建存儲桶響應狀態:', createBucketResponse.status);
        
        if (!createBucketResponse.ok) {
          const errorData = await createBucketResponse.json();
          console.error('創建存儲桶錯誤詳情:', errorData);
          
          // 處理特定錯誤
          if (createBucketResponse.status === 409) {
            // 409 表示桶已存在，這是可以接受的
            console.log('存儲桶已存在，繼續處理');
          } else if (createBucketResponse.status === 401) {
            // 401 表示未授權
            throw new Error('Forge API 認證錯誤 (401)。請檢查 API 密鑰是否有效，或者是否已過期。詳情: ' + (errorData.error || '未知錯誤'));
          } else {
            throw new Error(errorData.error || `創建存儲桶失敗 (${createBucketResponse.status})`);
          }
        } else {
          console.log('存儲桶創建成功');
        }
      } catch (error) {
        console.error('創建存儲桶過程中發生錯誤:', error);
        // 忽略桶已存在的錯誤
        if (!error.message.includes('already exists') && !error.message.includes('409')) {
          throw error;
        }
      }
      
      // 步驟 2: 上傳模型文件
      progressText.textContent = '正在上傳模型文件...';
      progressBar.style.width = '50%';
      
      const formData = new FormData();
      formData.append('model', modelFile);
      
      // 設置較長的超時時間
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分鐘超時
      
      try {
        const uploadResponse = await fetch(`/api/forge/buckets/${bucketName}/objects`, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        
        // 清除超時計時器
        clearTimeout(timeoutId);
        
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          
          // 特殊處理 503 錯誤（服務暫時不可用）
          if (uploadResponse.status === 503) {
            const retryAfter = uploadResponse.headers.get('Retry-After') || errorData.retryAfter || '300';
            const retryAfterSeconds = parseInt(retryAfter, 10);
            const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
            
            throw new Error(`Forge 服務暫時不可用 (503)。${errorData.details || '服務器暫時過載或正在維護。'} 請在約 ${retryAfterMinutes} 分鐘後重試。`);
          }
          
          // 處理網絡錯誤
          if (errorData.errorCode || errorData.errorMessage && errorData.errorMessage.includes('socket hang up')) {
            throw new Error(`網絡連接問題: ${errorData.errorMessage || '連接中斷'}。請檢查您的網絡連接並稍後再試。`);
          }
          
          throw new Error(errorData.error || '上傳模型失敗');
        }
      } catch (fetchError) {
        // 處理 AbortController 中止的情況
        if (fetchError.name === 'AbortError') {
          throw new Error('上傳請求超時。請檢查您的網絡連接或嘗試上傳較小的文件。');
        }
        
        // 處理其他網絡錯誤
        if (fetchError.message.includes('NetworkError') || 
            fetchError.message.includes('network') || 
            fetchError.message.includes('socket hang up')) {
          throw new Error(`網絡連接問題: ${fetchError.message}。請檢查您的網絡連接並稍後再試。`);
        }
        
        throw fetchError;
      }
      
      const uploadData = await uploadResponse.json();
      
      // 步驟 3: 轉換模型
      progressText.textContent = '正在轉換模型為可查看格式...';
      progressBar.style.width = '80%';
      
      const translateResponse = await fetch('/api/forge/models/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bucketKey: bucketName,
          objectName: modelFile.name
        })
      });
      
      if (!translateResponse.ok) {
        const errorData = await translateResponse.json();
        
        // 特殊處理 503 錯誤（服務暫時不可用）
        if (translateResponse.status === 503) {
          const retryAfter = translateResponse.headers.get('Retry-After') || errorData.retryAfter || '300';
          const retryAfterSeconds = parseInt(retryAfter, 10);
          const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
          
          throw new Error(`Forge 服務暫時不可用 (503)。${errorData.details || '服務器暫時過載或正在維護。'} 請在約 ${retryAfterMinutes} 分鐘後重試。`);
        }
        
        throw new Error(errorData.error || '轉換模型失敗');
      }
      
      const translateData = await translateResponse.json();
      
      // 步驟 4: 等待轉換完成
      progressText.textContent = '模型轉換中，請稍候...';
      progressBar.style.width = '90%';
      
      // 每 5 秒檢查一次轉換狀態
      let translationComplete = false;
      const checkTranslationStatus = async () => {
        try {
          const statusResponse = await fetch(`/api/forge/models/${translateData.urn}/status`);
          
          if (!statusResponse.ok) {
            const errorData = await statusResponse.json();
            
            // 特殊處理 503 錯誤（服務暫時不可用）
            if (statusResponse.status === 503) {
              const retryAfter = statusResponse.headers.get('Retry-After') || errorData.retryAfter || '60';
              const retryAfterSeconds = parseInt(retryAfter, 10);
              
              console.log(`Forge 服務暫時不可用 (503)，將在 ${retryAfterSeconds} 秒後重試...`);
              progressText.textContent = `模型轉換檢查暫時不可用，將在 ${retryAfterSeconds} 秒後重試...`;
              
              // 等待指定時間後重試
              setTimeout(checkTranslationStatus, retryAfterSeconds * 1000);
              return;
            }
            
            throw new Error(errorData.error || '檢查轉換狀態失敗');
          }
          
          const statusData = await statusResponse.json();
          
          if (statusData.status === 'success') {
            translationComplete = true;
            
            // 更新進度
            progressText.textContent = '模型轉換完成，正在載入...';
            progressBar.style.width = '100%';
            
            // 關閉對話框
            const uploadModelModal = bootstrap.Modal.getInstance(document.getElementById('uploadModelModal'));
            uploadModelModal.hide();
            
            // 載入模型到檢視器
            window.forgeViewer.loadModel(translateData.urn);
            
            // 重置表單
            document.getElementById('uploadModelForm').reset();
            document.getElementById('uploadModelSubmit').disabled = false;
            
            // 移除進度條
            const progressContainer = document.querySelector('.progress-container');
            if (progressContainer) {
              progressContainer.remove();
            }
          } else if (statusData.status === 'failed') {
            throw new Error('模型轉換失敗: ' + (statusData.messages ? statusData.messages.join(', ') : '未知錯誤'));
          } else {
            // 如果仍在處理中，繼續檢查
            setTimeout(checkTranslationStatus, 5000);
          }
        } catch (error) {
          alert('檢查轉換狀態時發生錯誤: ' + error.message);
          document.getElementById('uploadModelSubmit').disabled = false;
          
          // 移除進度條
          const progressContainer = document.querySelector('.progress-container');
          if (progressContainer) {
            progressContainer.remove();
          }
        }
      };
      
      // 開始檢查轉換狀態
      setTimeout(checkTranslationStatus, 5000);
      
    } catch (error) {
      console.error('上傳模型時發生錯誤:', error);
      
      // 根據錯誤類型提供更具體的錯誤信息
      let errorMessage = error.message;
      
      // 處理特定錯誤類型
      if (error.message.includes('socket hang up')) {
        errorMessage = '網絡連接中斷。請檢查您的網絡連接並稍後再試。';
      } else if (error.message.includes('NetworkError') || error.message.includes('network')) {
        errorMessage = '網絡連接問題。請檢查您的網絡連接並稍後再試。';
      } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
        errorMessage = '請求超時。請檢查您的網絡連接或嘗試上傳較小的文件。';
      }
      
      alert('上傳模型時發生錯誤: ' + errorMessage);
      document.getElementById('uploadModelSubmit').disabled = false;
      
      // 移除進度條
      const progressContainer = document.querySelector('.progress-container');
      if (progressContainer) {
        progressContainer.remove();
      }
    }
  }
  
  // 上傳品質檢查文件
  async function uploadDocument() {
    const titleInput = document.getElementById('docTitle');
    const descriptionInput = document.getElementById('docDescription');
    const inspectorInput = document.getElementById('inspector');
    const statusSelect = document.getElementById('status');
    const fileInput = document.getElementById('documentFile');
    
    const modelUrnInput = document.getElementById('modelUrn');
    const positionXInput = document.getElementById('positionX');
    const positionYInput = document.getElementById('positionY');
    const positionZInput = document.getElementById('positionZ');
    const elementIdInput = document.getElementById('elementId');
    const elementDbIdInput = document.getElementById('elementDbId');
    
    // 檢查必填欄位
    if (!titleInput.value.trim() || !inspectorInput.value.trim() || !fileInput.files[0]) {
      alert('請填寫所有必填欄位');
      return;
    }
    
    try {
      // 禁用上傳按鈕
      document.getElementById('uploadDocumentSubmit').disabled = true;
      
      // 建立 FormData 物件
      const formData = new FormData();
      formData.append('title', titleInput.value.trim());
      formData.append('description', descriptionInput.value.trim());
      formData.append('inspector', inspectorInput.value.trim());
      formData.append('status', statusSelect.value);
      formData.append('document', fileInput.files[0]);
      formData.append('modelUrn', modelUrnInput.value);
      
      // 位置資訊
      const position = {
        x: parseFloat(positionXInput.value),
        y: parseFloat(positionYInput.value),
        z: parseFloat(positionZInput.value)
      };
      formData.append('position', JSON.stringify(position));
      
      // 元素資訊（如果有）
      if (elementIdInput.value) {
        formData.append('elementId', elementIdInput.value);
      }
      
      if (elementDbIdInput.value) {
        formData.append('elementDbId', elementDbIdInput.value);
      }
      
      // 發送請求
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '上傳文件失敗');
      }
      
      // 關閉對話框
      const uploadDocumentModal = bootstrap.Modal.getInstance(document.getElementById('uploadDocumentModal'));
      uploadDocumentModal.hide();
      
      // 重置表單
      document.getElementById('uploadDocumentForm').reset();
      
      // 重新加載品質檢查文件和標註
      if (window.forgeViewer) {
        window.forgeViewer.updateDocumentPanel();
        window.forgeViewer.loadAnnotations();
      }
      
      // 顯示成功訊息
      alert('文件上傳成功');
    } catch (error) {
      console.error('上傳文件時發生錯誤:', error);
      alert('上傳文件時發生錯誤: ' + error.message);
    } finally {
      // 啟用上傳按鈕
      document.getElementById('uploadDocumentSubmit').disabled = false;
    }
  }
