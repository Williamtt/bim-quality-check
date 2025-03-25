// Autodesk Forge 檢視器處理類別
class ForgeViewer {
    constructor() {
      this.viewer = null;
      this.documentId = null;
      this.currentUrn = null;
      this.annotations = [];
      this.selectedPosition = null;
      this.selectedElement = null;
    }
  
    // 初始化檢視器
    async initialize() {
      try {
        // 獲取檢視器令牌
        const response = await fetch('/api/forge/token');
        if (!response.ok) {
          throw new Error('無法獲取檢視器令牌');
        }
        
        const { access_token } = await response.json();
        
        // 選取容器元素
        const container = document.getElementById('forgeViewer');
        
        // 初始化檢視器選項
        const options = {
          env: 'AutodeskProduction',
          accessToken: access_token,
          api: 'derivativeV2'
        };
        
        // 創建檢視器
        const viewer = new Autodesk.Viewing.GuiViewer3D(container, { 
          extensions: ['Autodesk.DocumentBrowser', 'Autodesk.Viewing.MarkupsCore']
        });
        
        // 初始化檢視器
        Autodesk.Viewing.Initializer(options, () => {
          viewer.start();
          this.viewer = viewer;
          
          // 為檢視器添加事件監聽器
          this.setupEventListeners();
          
          // 顯示歡迎消息或加載上次的模型
          this.showWelcomeMessage();
        });
      } catch (error) {
        console.error('初始化檢視器時發生錯誤:', error);
        alert('初始化檢視器時發生錯誤，請刷新頁面重試');
      }
    }
    
    // 設置事件監聽器
    setupEventListeners() {
      // 點擊事件
      this.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event) => this.onSelectionChanged(event));
      
      // 模型加載完成事件
      this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => this.onModelLoaded());
      
      // 摩轉頁
      window.addEventListener('resize', () => {
        if (this.viewer) {
          this.viewer.resize();
        }
      });
    }
    
    // 顯示歡迎消息
    showWelcomeMessage() {
      this.viewer.setBackgroundColor(240, 240, 240, 240, 240, 240);
      
      const messageContainer = document.createElement('div');
      messageContainer.id = 'welcomeMessage';
      messageContainer.style.position = 'absolute';
      messageContainer.style.top = '50%';
      messageContainer.style.left = '50%';
      messageContainer.style.transform = 'translate(-50%, -50%)';
      messageContainer.style.textAlign = 'center';
      messageContainer.style.color = '#333';
      messageContainer.style.fontFamily = 'Arial, sans-serif';
      
      messageContainer.innerHTML = `
        <h3>歡迎使用 BIM 品質檢查系統</h3>
        <p>請上傳 BIM 模型或選擇已有的模型來開始工作</p>
        <button id="welcomeUploadBtn" class="btn btn-primary mt-3">上傳 BIM 模型</button>
      `;
      
      document.getElementById('forgeViewer').appendChild(messageContainer);
      
      // 為上傳按鈕添加事件
      document.getElementById('welcomeUploadBtn').addEventListener('click', () => {
        const uploadModelModal = new bootstrap.Modal(document.getElementById('uploadModelModal'));
        uploadModelModal.show();
      });
    }
    
    // 載入模型
    async loadModel(urn) {
      try {
        // 移除歡迎消息
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage) {
          welcomeMessage.remove();
        }
        
        this.currentUrn = urn;
        
        // 獲取檢視器令牌
        const response = await fetch('/api/forge/token');
        if (!response.ok) {
          throw new Error('無法獲取檢視器令牌');
        }
        
        const { access_token } = await response.json();
        
        // 設定檢視器令牌
        this.viewer.getApiClient().setAccessToken(access_token);
        
        // 加載模型
        const documentId = 'urn:' + urn;
        this.documentId = documentId;
        
        Autodesk.Viewing.Document.load(
          documentId,
          (doc) => this.onDocumentLoadSuccess(doc),
          (error) => this.onDocumentLoadFailure(error)
        );
      } catch (error) {
        console.error('載入模型時發生錯誤:', error);
        alert('載入模型時發生錯誤，請重試');
      }
    }
    
    // 文件加載成功處理
    onDocumentLoadSuccess(doc) {
      const defaultViewable = doc.getRoot().getDefaultGeometry();
      
      if (defaultViewable) {
        this.viewer.loadDocumentNode(doc, defaultViewable);
      } else {
        console.error('沒有可用的默認幾何圖形');
        alert('此模型沒有可查看的 3D 數據');
      }
    }
    
    // 文件加載失敗處理
    onDocumentLoadFailure(error) {
      console.error('載入文件時發生錯誤:', error);
      alert('載入文件時發生錯誤，請重試');
    }
    
    // 模型加載完成處理
    async onModelLoaded() {
      console.log('模型加載完成');
      
      // 設置初始相機位置和視角
      this.viewer.navigation.setView([0, 0, 0], [1, 1, 1]);
      this.viewer.navigation.setLookAt([0, 0, 0], [0, 0, 0]);
      
      // 顯示全部模型
      this.viewer.fitToView();
      
      // 啟用點擊選擇
      this.viewer.setSelectionMode(Autodesk.Viewing.SelectionMode.REGULAR);
      
      // 加載相關的品質檢查文件標註
      await this.loadAnnotations();
      
      // 啟用新增文件按鈕
      document.getElementById('addDocumentBtn').disabled = false;
    }
    
    // 元素選擇變更處理
    onSelectionChanged(event) {
      const selection = this.viewer.getSelection();
      
      // 清除之前的選擇
      this.selectedElement = null;
      
      if (selection.length > 0) {
        const dbId = selection[0];
        
        // 獲取選中元素的屬性
        this.viewer.getProperties(dbId, (props) => {
          this.selectedElement = {
            dbId: dbId,
            id: props.externalId || null,
            props: props
          };
          
          // 獲取選中元素的中心點
          this.getElementCenter(dbId);
        });
      } else {
        // 如果沒有選中元素，則清空位置信息
        this.selectedPosition = null;
        
        // 更新文檔面板
        this.updateDocumentPanel();
      }
    }
    
    // 獲取元素中心點
    getElementCenter(dbId) {
      this.viewer.select([]);
      
      const instanceTree = this.viewer.model.getInstanceTree();
      const fragList = this.viewer.model.getFragmentList();
      
      let bounds = new THREE.Box3();
      let boxCenter = new THREE.Vector3();
      
      instanceTree.enumNodeFragments(dbId, (fragId) => {
        let box = new THREE.Box3();
        fragList.getWorldBounds(fragId, box);
        bounds.union(box);
      });
      
      bounds.getCenter(boxCenter);
      
      this.selectedPosition = {
        x: boxCenter.x,
        y: boxCenter.y,
        z: boxCenter.z
      };
      
      // 更新文檔面板
      this.updateDocumentPanel();
      
      // 重新選中元素（以恢復視覺效果）
      this.viewer.select([dbId]);
    }
    
    // 手動設置一個 3D 位置（用於點擊空白區域）
    setPosition(position) {
      this.selectedPosition = position;
      this.selectedElement = null;
      
      // 更新文檔面板
      this.updateDocumentPanel();
    }
    
    // 更新文檔面板
    async updateDocumentPanel() {
      // 如果沒有選中位置，則顯示提示信息
      if (!this.selectedPosition) {
        document.getElementById('noDocumentsMessage').style.display = 'block';
        document.getElementById('documentList').innerHTML = '<div class="text-center pt-5" id="noDocumentsMessage"><p>請在模型中選擇位置以查看或上傳檢查文件</p></div>';
        document.getElementById('documentDetail').style.display = 'none';
        return;
      }
      
      document.getElementById('noDocumentsMessage').style.display = 'none';
      
      try {
        // 顯示加載中動畫
        document.getElementById('documentList').innerHTML = `
          <div class="loading-container">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">加載中...</span>
            </div>
          </div>
        `;
        
        // 獲取當前位置或元素相關的文件
        const documents = await this.getDocumentsForPosition(this.selectedPosition, this.selectedElement);
        
        // 更新文檔列表
        this.renderDocumentList(documents);
      } catch (error) {
        console.error('獲取文件時發生錯誤:', error);
        document.getElementById('documentList').innerHTML = '<div class="alert alert-danger">載入文件時發生錯誤，請重試</div>';
      }
    }
    
    // 獲取與位置相關的文件
    async getDocumentsForPosition(position, element) {
      if (!this.currentUrn) {
        return [];
      }
      
      try {
        const response = await fetch(`/api/models/${encodeURIComponent(this.currentUrn)}/documents`);
        if (!response.ok) {
          throw new Error('無法獲取文件');
        }
        
        let documents = await response.json();
        
        // 如果有位置信息，則過濾距離較近的文件
        if (position) {
          documents = documents.filter(doc => {
            // 計算 3D 距離
            const dx = doc.position.x - position.x;
            const dy = doc.position.y - position.y;
            const dz = doc.position.z - position.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            // 如果距離小於閾值或元素ID匹配，則顯示
            return distance < 5.0 || (element && doc.elementDbId === element.dbId);
          });
        }
        
        return documents;
      } catch (error) {
        console.error('獲取文件時發生錯誤:', error);
        return [];
      }
    }
    
    // 渲染文檔列表
    renderDocumentList(documents) {
      const documentList = document.getElementById('documentList');
      
      if (documents.length === 0) {
        documentList.innerHTML = `
          <div class="alert alert-info">
            <p>此位置沒有品質檢查文件</p>
            <p>點擊下方的新增按鈕來上傳檢查文件</p>
          </div>
        `;
        return;
      }
      
      let html = '<div class="list-group">';
      
      documents.forEach(doc => {
        const statusClass = `status-${doc.status}`;
        const statusText = {
          'pending': '待處理',
          'passed': '通過',
          'failed': '不通過',
          'needs-review': '需複查'
        }[doc.status] || '未知';
        
        html += `
          <div class="document-item" data-id="${doc._id}">
            <h6>${doc.title}</h6>
            <div class="document-meta">
              <div><span class="document-status ${statusClass}">${statusText}</span></div>
              <div>檢查人員: ${doc.inspector}</div>
              <div>上傳時間: ${new Date(doc.uploadDate).toLocaleString()}</div>
            </div>
          </div>
        `;
      });
      
      html += '</div>';
      documentList.innerHTML = html;
      
      // 添加點擊事件監聽器
      documentList.querySelectorAll('.document-item').forEach(item => {
        item.addEventListener('click', () => {
          this.showDocumentDetail(item.getAttribute('data-id'));
        });
      });
    }
    
    // 顯示文件詳情
    async showDocumentDetail(documentId) {
      try {
        // 顯示加載中狀態
        document.getElementById('documentDetail').style.display = 'block';
        document.getElementById('documentDetail').innerHTML = `
          <div class="loading-container">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">加載中...</span>
            </div>
          </div>
        `;
        
        // 獲取文件詳情
        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) {
          throw new Error('無法獲取文件詳情');
        }
        
        const document = await response.json();
        
        // 獲取文件類型圖標
        const fileIcon = this.getFileTypeIcon(document.fileType);
        
        // 獲取狀態標籤
        const statusClass = `status-${document.status}`;
        const statusText = {
          'pending': '待處理',
          'passed': '通過',
          'failed': '不通過',
          'needs-review': '需複查'
        }[document.status] || '未知';
        
        // 渲染文件詳情
        const html = `
          <h5>${document.title}</h5>
          <div class="mb-3">
            <span class="document-status ${statusClass}">${statusText}</span>
          </div>
          
          <div class="mb-3">
            ${document.description ? `<p>${document.description}</p>` : ''}
            <p><strong>檢查人員:</strong> ${document.inspector}</p>
            <p><strong>上傳時間:</strong> ${new Date(document.uploadDate).toLocaleString()}</p>
          </div>
          
          <div class="mb-3">
            <div class="card">
              <div class="card-body d-flex align-items-center">
                <div class="me-3">
                  <i class="${fileIcon} fa-2x"></i>
                </div>
                <div>
                  <h6 class="mb-0">檢查文件</h6>
                  <small>${document.filePath.split('/').pop()}</small>
                </div>
              </div>
            </div>
          </div>
          
          <div class="document-actions">
            <button class="btn btn-primary" id="previewBtn">預覽文件</button>
            <button class="btn btn-danger" id="deleteDocBtn">刪除</button>
          </div>
          
          <hr>
          
          <div class="document-comments">
            <h6>評論 (${document.comments.length})</h6>
            
            ${document.comments.length > 0 ? document.comments.map(comment => `
              <div class="comment-item">
                <div class="comment-user">${comment.user}</div>
                <div class="comment-text">${comment.content}</div>
                <div class="comment-date">${new Date(comment.date).toLocaleString()}</div>
              </div>
            `).join('') : '<p>暫無評論</p>'}
            
            <div class="mt-3">
              <div class="mb-2">
                <input type="text" class="form-control" id="commentUser" placeholder="您的名字">
              </div>
              <div class="mb-2">
                <textarea class="form-control" id="commentContent" rows="2" placeholder="添加評論..."></textarea>
              </div>
              <button class="btn btn-sm btn-primary" id="addCommentBtn">添加評論</button>
            </div>
          </div>
        `;
        
        document.getElementById('documentDetail').innerHTML = html;
        
        // 添加事件監聽器
        document.getElementById('previewBtn').addEventListener('click', () => {
          this.previewDocument(document);
        });
        
        document.getElementById('deleteDocBtn').addEventListener('click', () => {
          this.deleteDocument(document._id);
        });
        
        document.getElementById('addCommentBtn').addEventListener('click', () => {
          this.addComment(document._id);
        });
      } catch (error) {
        console.error('顯示文件詳情時發生錯誤:', error);
        document.getElementById('documentDetail').innerHTML = '<div class="alert alert-danger">載入文件詳情時發生錯誤，請重試</div>';
      }
    }
    
    // 獲取檔案類型圖標
    getFileTypeIcon(fileType) {
      if (fileType.includes('image')) {
        return 'fas fa-image';
      } else if (fileType.includes('pdf')) {
        return 'fas fa-file-pdf';
      } else if (fileType.includes('word')) {
        return 'fas fa-file-word';
      } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
        return 'fas fa-file-excel';
      } else {
        return 'fas fa-file';
      }
    }
    
    // 預覽文件
    previewDocument(document) {
      const modal = new bootstrap.Modal(document.getElementById('previewDocumentModal'));
      const modalTitle = document.getElementById('previewDocumentTitle');
      const modalBody = document.getElementById('previewDocumentBody');
      const downloadBtn = document.getElementById('downloadDocumentBtn');
      
      modalTitle.textContent = document.title;
      downloadBtn.href = document.filePath;
      
      // 根據文件類型顯示不同的預覽
      if (document.fileType.includes('image')) {
        modalBody.innerHTML = `<img src="${document.filePath}" class="img-fluid" alt="${document.title}">`;
      } else if (document.fileType.includes('pdf')) {
        modalBody.innerHTML = `<iframe src="${document.filePath}" width="100%" height="500" style="border: none;"></iframe>`;
      } else {
        modalBody.innerHTML = `
          <div class="text-center">
            <i class="${this.getFileTypeIcon(document.fileType)} fa-5x mb-3"></i>
            <p>無法直接預覽此類型文件，請點擊下方的下載按鈕進行查看</p>
          </div>
        `;
      }
      
      modal.show();
    }
    
    // 刪除文件
    async deleteDocument(documentId) {
      if (!confirm('確定要刪除此文件嗎？此操作無法撤銷。')) {
        return;
      }
      
      try {
        const response = await fetch(`/api/documents/${documentId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          throw new Error('刪除文件失敗');
        }
        
        alert('文件已成功刪除');
        
        // 刷新文件列表
        document.getElementById('documentDetail').style.display = 'none';
        this.updateDocumentPanel();
        
        // 重新加載標註
        this.loadAnnotations();
      } catch (error) {
        console.error('刪除文件時發生錯誤:', error);
        alert('刪除文件時發生錯誤，請重試');
      }
    }
    
    // 添加評論
    async addComment(documentId) {
      const user = document.getElementById('commentUser').value.trim();
      const content = document.getElementById('commentContent').value.trim();
      
      if (!user || !content) {
        alert('請輸入名字和評論內容');
        return;
      }
      
      try {
        const response = await fetch(`/api/documents/${documentId}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user, content })
        });
        
        if (!response.ok) {
          throw new Error('添加評論失敗');
        }
        
        // 重新加載文件詳情
        this.showDocumentDetail(documentId);
      } catch (error) {
        console.error('添加評論時發生錯誤:', error);
        alert('添加評論時發生錯誤，請重試');
      }
    }
    
    // 獲取並顯示標註
    async loadAnnotations() {
      if (!this.currentUrn) {
        return;
      }
      
      try {
        // 清除現有標註
        this.clearAnnotations();
        
        // 獲取所有與當前模型相關的文件
        const response = await fetch(`/api/models/${encodeURIComponent(this.currentUrn)}/documents`);
        if (!response.ok) {
          throw new Error('無法獲取文件');
        }
        
        const documents = await response.json();
        
        // 為每個文件創建標註
        documents.forEach(doc => {
          this.createAnnotation(doc);
        });
      } catch (error) {
        console.error('加載標註時發生錯誤:', error);
      }
    }
    
    // 清除標註
    clearAnnotations() {
      this.annotations.forEach(annotation => {
        if (annotation.element) {
          annotation.element.remove();
        }
      });
      
      this.annotations = [];
    }
    
    // 創建標註
    createAnnotation(document) {
      const viewer = this.viewer;
      const position = document.position;
      
      // 使用 worldToClient 將 3D 座標轉換為屏幕座標
      const screenPoint = viewer.worldToClient(
        new THREE.Vector3(position.x, position.y, position.z)
      );
      
      // 如果點不在可見範圍內，則跳過
      if (!screenPoint) {
        return;
      }
      
      // 創建標註元素
      const annotationElement = document.createElement('div');
      annotationElement.className = 'annotation';
      annotationElement.setAttribute('data-document-id', document._id);
      annotationElement.setAttribute('data-toggle', 'tooltip');
      annotationElement.setAttribute('title', document.title);
      annotationElement.style.left = `${screenPoint.x}px`;
      annotationElement.style.top = `${screenPoint.y}px`;
      
      // 根據狀態設置不同顏色
      const statusColors = {
        'pending': 'rgba(255, 193, 7, 0.8)',
        'passed': 'rgba(40, 167, 69, 0.8)',
        'failed': 'rgba(220, 53, 69, 0.8)',
        'needs-review': 'rgba(108, 117, 125, 0.8)'
      };
      
      annotationElement.style.backgroundColor = statusColors[document.status] || 'rgba(255, 0, 0, 0.6)';
      
      // 添加點擊事件
      annotationElement.addEventListener('click', () => {
        // 顯示文件詳情
        document.getElementById('documentDetail').style.display = 'block';
        this.showDocumentDetail(document._id);
        
        // 如果有元素 ID，則選中該元素
        if (document.elementDbId) {
          viewer.select(document.elementDbId);
          viewer.fitToView([document.elementDbId]);
        }
      });
      
      // 添加至檢視器容器
      document.getElementById('forgeViewer').appendChild(annotationElement);
      
      // 初始化工具提示
      new bootstrap.Tooltip(annotationElement);
      
      // 保存標註
      this.annotations.push({
        document: document,
        element: annotationElement,
        screenPoint: screenPoint,
        worldPoint: new THREE.Vector3(position.x, position.y, position.z)
      });
      
      // 添加相機變更事件，以便在相機移動時更新標註位置
      viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, () => this.updateAnnotationPositions());
    }
    
    // 更新所有標註的位置
    updateAnnotationPositions() {
      this.annotations.forEach(annotation => {
        const screenPoint = this.viewer.worldToClient(annotation.worldPoint);
        
        // 如果點不在可見範圍內，隱藏標註
        if (!screenPoint) {
          annotation.element.style.display = 'none';
          return;
        }
        
        // 更新位置並顯示
        annotation.element.style.display = 'block';
        annotation.element.style.left = `${screenPoint.x}px`;
        annotation.element.style.top = `${screenPoint.y}px`;
      });
    }
    
    // 打開上傳文件對話框
    openUploadDocumentDialog() {
      if (!this.currentUrn || !this.selectedPosition) {
        alert('請先在模型中選擇一個位置');
        return;
      }
      
      // 設置隱藏欄位
      document.getElementById('modelUrn').value = this.currentUrn;
      document.getElementById('positionX').value = this.selectedPosition.x;
      document.getElementById('positionY').value = this.selectedPosition.y;
      document.getElementById('positionZ').value = this.selectedPosition.z;
      
      // 如果選中了元素，則設置元素 ID
      if (this.selectedElement) {
        document.getElementById('elementId').value = this.selectedElement.id || '';
        document.getElementById('elementDbId').value = this.selectedElement.dbId || '';
      } else {
        document.getElementById('elementId').value = '';
        document.getElementById('elementDbId').value = '';
      }
      
      // 顯示對話框
      const modal = new bootstrap.Modal(document.getElementById('uploadDocumentModal'));
      modal.show();
    }
  }
  
  // 頁面加載時初始化檢視器
  document.addEventListener('DOMContentLoaded', () => {
    // 創建全局檢視器對象
    window.forgeViewer = new ForgeViewer();
    window.forgeViewer.initialize();
  });