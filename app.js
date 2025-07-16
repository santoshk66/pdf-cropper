import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';
import { PDFDocument } from 'pdf-lib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Ensure uploads and outputs directories exist
await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true });
await fs.mkdir(path.join(__dirname, 'outputs'), { recursive: true });

app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    res.json({ filename: req.file.filename });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload PDF' });
  }
});

app.post('/crop', async (req, res) => {
  try {
    const { filename, labelBox, invoiceBox } = req.body;
    const filePath = path.join(__dirname, 'uploads', filename);
    const data = await fs.readFile(filePath);
    const srcPdf = await PDFDocument.load(data);

    const outputPdf = await PDFDocument.create();

    for (let i = 0; i < srcPdf.getPageCount(); i++) {
      const [sourcePage] = await outputPdf.copyPages(srcPdf, [i]);
      const { height } = sourcePage.getSize();

      // Create label page
      const labelPage = outputPdf.addPage([labelBox.width, labelBox.height]);
      const labelContent = await outputPdf.embedPage(sourcePage, {
        left: labelBox.x,
        bottom: height - labelBox.y - labelBox.height,
        right: labelBox.x + labelBox.width,
        top: height - labelBox.y,
      });
      labelPage.drawPage(labelContent, { x: 0, y: 0 });

      // Create invoice page
      const invoicePage = outputPdf.addPage([invoiceBox.width, invoiceBox.height]);
      const invoiceContent = await outputPdf.embedPage(sourcePage, {
        left: invoiceBox.x,
        bottom: height - invoiceBox.y - invoiceBox.height,
        right: invoiceBox.x + invoiceBox.width,
        top: height - invoiceBox.y,
      });
      invoicePage.drawPage(invoiceContent, { x: 0, y: 0 });
    }

    const outputBytes = await outputPdf.save();
    const outputPath = path.join(__dirname, 'outputs', `output-${filename}`);
    await fs.writeFile(outputPath, outputBytes);

    // Clean up uploaded file
    await fs.unlink(filePath).catch(err => console.warn('Failed to delete uploaded file:', err));

    res.json({ outputUrl: `/outputs/output-${filename}` });
  } catch (error) {
    console.error('Crop error:', error);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
});

app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// Periodic cleanup of output files (every 10 minutes)
setInterval(async () => {
  try {
    const files = await fs.readdir(path.join(__dirname, 'outputs'));
    for (const file of files) {
      const filePath = path.join(__dirname, 'outputs', file);
      const stats = await fs.stat(filePath);
      if (Date.now() - stats.mtimeMs > 30 * 60 * 1000) { // Delete files older than 30 minutes
        await fs.unlink(filePath);
      }
    }
  } catch (error) {
    console.warn('Cleanup error:', error);
  }
}, 10 * 60 * 1000);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`PDF cropper running on port ${port}`));
