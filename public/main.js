console.log("Main JS loaded");

let pdfDoc = null;
let pageNum = 1;
let numPages = 0;
let labelBox = null;
let invoiceBox = null;
let isDragging = null;
let startX, startY;
let uploadedFilename = null;
let isProcessing = false;

const canvas = document.getElementById('pdfCanvas');
const ctx = canvas.getContext('2d');
const labelBoxElement = document.getElementById('labelBox');
const invoiceBoxElement = document.getElementById('invoiceBox');
const uploadForm = document.getElementById('uploadForm');
const setLabelBtn = document.getElementById('setLabel');
const setInvoiceBtn = document.getElementById('setInvoice');
const resetLabelBtn = document.getElementById('resetLabel');
const resetInvoiceBtn = document.getElementById('resetInvoice');
const processBtn = document.getElementById('processPDF');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const loading = document.getElementById('loading');

function showLoading(show) {
  loading.style.display = show ? 'block' : 'none';
  uploadForm.querySelector('button').disabled = show;
  processBtn.disabled = show || !(labelBox && invoiceBox);
}

function renderPage(num) {
  pdfDoc.getPage(num).then(page => {
    const viewport = page.getViewport({ scale: 1.0 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const renderContext = { canvasContext: ctx, viewport: viewport };
    page.render(renderContext).promise.then(() => {
      pageInfo.textContent = `Page ${num} of ${numPages}`;
      prevPageBtn.disabled = num === 1;
      nextPageBtn.disabled = num === numPages;
    });
  });
}

function updateCropBox(element, box) {
  if (box) {
    element.style.left = `${box.x}px`;
    element.style.top = `${box.y}px`;
    element.style.width = `${box.width}px`;
    element.style.height = `${box.height}px`;
    element.style.display = 'block';
  } else {
    element.style.display = 'none';
  }
}

canvas.addEventListener('mousedown', (e) => {
  if (!isDragging || isProcessing) return;
  const rect = canvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDragging || isProcessing) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const box = {
    x: Math.min(startX, x),
    y: Math.min(startY, y),
    width: Math.abs(x - startX),
    height: Math.abs(y - startY),
  };
  if (isDragging === 'label') {
    labelBox = box;
    updateCropBox(labelBoxElement, labelBox);
  } else if (isDragging === 'invoice') {
    invoiceBox = box;
    updateCropBox(invoiceBoxElement, invoiceBox);
  }
  processBtn.disabled = !(labelBox && invoiceBox) || isProcessing;
});

canvas.addEventListener('mouseup', () => {
  isDragging = null;
});

setLabelBtn.addEventListener('click', () => {
  if (!isProcessing) isDragging = 'label';
});

setInvoiceBtn.addEventListener('click', () => {
  if (!isProcessing) isDragging = 'invoice';
});

resetLabelBtn.addEventListener('click', () => {
  labelBox = null;
  updateCropBox(labelBoxElement, null);
  processBtn.disabled = !(labelBox && invoiceBox) || isProcessing;
});

resetInvoiceBtn.addEventListener('click', () => {
  invoiceBox = null;
  updateCropBox(invoiceBoxElement, null);
  processBtn.disabled = !(labelBox && invoiceBox) || isProcessing;
});

prevPageBtn.addEventListener('click', () => {
  if (pageNum > 1 && !isProcessing) {
    pageNum--;
    renderPage(pageNum);
  }
});

nextPageBtn.addEventListener('click', () => {
  if (pageNum < numPages && !isProcessing) {
    pageNum++;
    renderPage(pageNum);
  }
});

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isProcessing) return;
  showLoading(true);
  isProcessing = true;
  try {
    const formData = new FormData(uploadForm);
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });
    const { filename } = await response.json();
    uploadedFilename = filename;
    const file = uploadForm.querySelector('input[type="file"]').files[0];
    const arrayBuffer = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
    numPages = pdfDoc.numPages;
    pageNum = 1;
    renderPage(pageNum);
  } catch (error) {
    console.error('Upload failed:', error);
    alert('Failed to upload PDF. Please try again.');
  } finally {
    showLoading(false);
    isProcessing = false;
  }
});

processBtn.addEventListener('click', async () => {
  if (!labelBox || !invoiceBox || !uploadedFilename || isProcessing) return;
  showLoading(true);
  isProcessing = true;
  try {
    const response = await fetch('/crop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: uploadedFilename, labelBox, invoiceBox }),
    });
    const { outputUrl } = await response.json();
    const link = document.createElement('a');
    link.href = outputUrl;
    link.download = 'cropped_output.pdf';
    link.click();
  } catch (error) {
    console.error('Processing failed:', error);
    alert('Failed to process PDF. Please try again.');
  } finally {
    showLoading(false);
    isProcessing = false;
  }
});
