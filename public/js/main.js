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
        const createBucketResponse = await fetch('/api/forge/buckets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ bucketKey: bucketName })
        });
        
        if (!createBucketResponse.ok && createBucketResponse.status !== 409) {
          // 409 表示桶已存在，這是可以接受的
          const errorData = await createBucketResponse.json();
          throw new Error(errorData.error || '創建存儲桶失敗');
        }
      } catch (error) {
        // 忽略桶已存在的錯誤
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
      
      // 步驟 2: 上傳模型文件
      progressText.textContent = '正在上傳模型文件...';
      progressBar.style.width = '50%';
      
      const formData = new FormData();
      formData.append('model', modelFile);
      
      const uploadResponse = await fetch(`/api/forge/buckets/${bucketName}/objects`, {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || '上傳模型失敗');
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
            throw new Error('檢查轉換狀態失敗');
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
      alert('上傳模型時發生錯誤: ' + error.message);
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