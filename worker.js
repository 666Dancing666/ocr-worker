export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // ---------- 根路径返回前端页面 ----------
    if (path === '/' && request.method === 'GET') {
      return new Response(getHTML(), {
        headers: { 'Content-Type': 'text/html;charset=utf-8' },
      });
    }

    // ---------- OCR 接口（无需登录） ----------
    if (path === '/ocr' && request.method === 'POST') {
      return handleOCR(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};

// ---------- OCR 核心逻辑（保持不变） ----------
async function handleOCR(request, env) {
  try {
    const { image, imageUrl } = await request.json();
    if (!image && !imageUrl) {
      return new Response(JSON.stringify({ error: '请提供 image 或 imageUrl' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const TOKEN = env.PADDLEOCR_TOKEN;
    if (!TOKEN) {
      return new Response(JSON.stringify({ error: '未配置 PADDLEOCR_TOKEN' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const JOB_URL = 'https://paddleocr.aistudio-app.com/api/v2/ocr/jobs';

    let jobId;
    if (imageUrl) {
      const payload = {
        fileUrl: imageUrl,
        model: 'PaddleOCR-VL-1.6',
        optionalPayload: {
          useDocOrientationClassify: false,
          useDocUnwarping: false,
          useChartRecognition: false,
        },
      };
      const resp = await fetch(JOB_URL, {
        method: 'POST',
        headers: {
          'Authorization': `bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error('提交任务失败: ' + JSON.stringify(data));
      jobId = data.data?.jobId;
      if (!jobId) throw new Error('未获取到 jobId');
    } else {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const formData = new FormData();
      formData.append('model', 'PaddleOCR-VL-1.6');
      formData.append('optionalPayload', JSON.stringify({
        useDocOrientationClassify: false,
        useDocUnwarping: false,
        useChartRecognition: false,
      }));
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      formData.append('file', blob, 'image.jpg');

      const resp = await fetch(JOB_URL, {
        method: 'POST',
        headers: { 'Authorization': `bearer ${TOKEN}` },
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error('提交任务失败: ' + JSON.stringify(data));
      jobId = data.data?.jobId;
      if (!jobId) throw new Error('未获取到 jobId');
    }

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const resultResp = await fetch(`${JOB_URL}/${jobId}`, {
        headers: { 'Authorization': `bearer ${TOKEN}` },
      });
      const resultData = await resultResp.json();
      const state = resultData.data?.state;
      if (state === 'done') {
        let resultUrlData = resultData.data?.resultUrl;
        if (typeof resultUrlData === 'string') {
          resultUrlData = JSON.parse(resultUrlData);
        }
        const jsonUrl = resultUrlData?.jsonUrl;
        if (!jsonUrl) throw new Error('未获取到 resultUrl');
        const textResp = await fetch(jsonUrl);
        const textData = await textResp.json();
        const text = textData.result?.layoutParsingResults?.[0]?.markdown?.text || '';
        return new Response(JSON.stringify({ success: true, text }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      } else if (state === 'failed') {
        throw new Error('识别失败: ' + JSON.stringify(resultData));
      }
    }
    throw new Error('识别超时');
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

// ---------- HTML（移除登录界面，直接展示 OCR 工具） ----------
function getHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OCR 文字识别</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #e6edf3; min-height: 100vh; display: flex; justify-content: center; align-items: center; }
    .container { max-width: 500px; width: 100%; padding: 20px; }
    .app-box { background: #161b22; border: 1px solid #30363d; border-radius: 16px; padding: 32px; }
    .app-box h1 { font-size: 24px; margin-bottom: 8px; text-align: center; }
    .app-box .sub { text-align: center; color: #8b949e; margin-bottom: 24px; }
    .upload-area { border: 2px dashed #30363d; border-radius: 12px; padding: 30px; text-align: center; cursor: pointer; transition: border-color 0.3s; background: #0d1117; margin-top: 16px; }
    .upload-area:hover { border-color: #58a6ff; }
    .upload-area.dragover { border-color: #58a6ff; background: #1c2333; }
    .upload-area .hint { color: #8b949e; font-size: 14px; }
    #fileInput { display: none; }
    .preview { margin-top: 16px; display: none; text-align: center; }
    .preview img { max-width: 100%; max-height: 200px; border-radius: 8px; }
    .btn { background: #238636; color: white; border: none; padding: 8px 20px; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 8px; }
    .btn:hover { background: #2ea043; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .result { margin-top: 20px; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 16px; display: none; }
    .result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .copy-btn { background: #21262d; border: 1px solid #30363d; color: #8b949e; padding: 2px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .copy-btn:hover { background: #30363d; }
    .result-content { white-space: pre-wrap; word-wrap: break-word; font-size: 14px; line-height: 1.7; max-height: 300px; overflow-y: auto; }
    .loading { display: none; text-align: center; padding: 20px; color: #8b949e; }
    .loading .spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid #30363d; border-top-color: #58a6ff; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
<div class="container">
  <div class="app-box" id="appBox">
    <h1>📄 OCR 识别</h1>
    <div class="sub">上传图片自动识别文字</div>
    <div class="upload-area" id="dropZone">
      <div id="uploadPlaceholder">
        <div style="font-size:48px;margin-bottom:8px;">🖼️</div>
        <p>点击或拖拽上传图片</p>
        <p class="hint">JPG / PNG / BMP / WebP</p>
      </div>
      <div class="preview" id="previewArea">
        <img id="previewImg" src="" alt="预览">
      </div>
      <input type="file" id="fileInput" accept="image/*">
    </div>
    <button class="btn" id="recognizeBtn" style="width:100%;margin-top:12px;" disabled>🔍 识别文字</button>
    <div class="loading" id="loading"><div class="spinner"></div><p style="margin-top:8px;">识别中...</p></div>
    <div class="result" id="result">
      <div class="result-header"><span>📝 识别结果</span><button class="copy-btn" id="copyBtn">📋 复制</button></div>
      <div class="result-content" id="resultContent"></div>
    </div>
  </div>
</div>
<script>
// ----- DOM 引用 -----
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const previewArea = document.getElementById('previewArea');
const previewImg = document.getElementById('previewImg');
const recognizeBtn = document.getElementById('recognizeBtn');
const loading = document.getElementById('loading');
const result = document.getElementById('result');
const resultContent = document.getElementById('resultContent');
const copyBtn = document.getElementById('copyBtn');

// ----- 状态 -----
let selectedFile = null;
let imageBase64 = null;

// ----- 文件上传 -----
dropZone.onclick = (e) => {
  if (e.target.closest('.preview') || e.target.closest('button')) return;
  fileInput.click();
};
dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
dropZone.ondragleave = () => dropZone.classList.remove('dragover');
dropZone.ondrop = (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    handleFile(files[0]);
  }
};
fileInput.onchange = (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
  fileInput.value = '';
};

function handleFile(file) {
  if (!file.type.startsWith('image/')) { alert('请上传图片文件'); return; }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    imageBase64 = e.target.result;
    previewImg.src = imageBase64;
    uploadPlaceholder.style.display = 'none';
    previewArea.style.display = 'block';
    recognizeBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

// ----- 识别 -----
recognizeBtn.onclick = async () => {
  if (!selectedFile) return;
  recognizeBtn.disabled = true;
  loading.style.display = 'block';
  result.style.display = 'none';

  try {
    const resp = await fetch('/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 })
    });
    const data = await resp.json();
    if (data.success) {
      resultContent.textContent = data.text;
      result.style.display = 'block';
    } else {
      resultContent.textContent = '❌ 错误: ' + (data.error || '未知');
      result.style.display = 'block';
    }
  } catch (e) {
    resultContent.textContent = '❌ 网络错误: ' + e.message;
    result.style.display = 'block';
  }
  loading.style.display = 'none';
  recognizeBtn.disabled = false;
};

// ----- 复制 -----
copyBtn.onclick = () => {
  const text = resultContent.textContent;
  if (!text) {
    copyBtn.textContent = '⚠️ 无内容';
    setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 1500);
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => {
        copyBtn.textContent = '✅ 已复制';
        setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 2000);
      })
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
};

function fallbackCopy(text) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    copyBtn.textContent = success ? '✅ 已复制' : '❌ 复制失败';
    setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 2000);
  } catch (e) {
    copyBtn.textContent = '❌ 复制失败';
    setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 2000);
  }
}
</script>
</body>
</html>`;
}
