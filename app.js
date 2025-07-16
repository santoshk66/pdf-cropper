import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';
import { PDFDocument } from 'pdf-lib';

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

app.post('/upload', upload.single('pdf'), async (req, res) => {
  res.json({ filename: req.file.filename });
});

app.post('/crop', async (req, res) => {
  const { filename, labelBox, invoiceBox } = req.body;
  const filePath = path.join('uploads', filename);
  const data = await fs.readFile(filePath);
  const srcPdf = await PDFDocument.load(data);

  const labelPdf = await PDFDocument.create();
  const invoicePdf = await PDFDocument.create();

  for (let i = 0; i < srcPdf.getPageCount(); i++) {
    const [labelPage] = await labelPdf.copyPages(srcPdf, [i]);
    labelPage.setCropBox(labelBox.x, labelBox.y, labelBox.width, labelBox.height);
    labelPdf.addPage(labelPage);

    const [invoicePage] = await invoicePdf.copyPages(srcPdf, [i]);
    invoicePage.setCropBox(invoiceBox.x, invoiceBox.y, invoiceBox.width, invoiceBox.height);
    invoicePdf.addPage(invoicePage);
  }

  const labelBytes = await labelPdf.save();
  const invoiceBytes = await invoicePdf.save();

  const labelPath = path.join('outputs', `labels-${filename}`);
  const invoicePath = path.join('outputs', `invoices-${filename}`);
  await fs.writeFile(labelPath, labelBytes);
  await fs.writeFile(invoicePath, invoiceBytes);

  res.json({ labelUrl: `/outputs/labels-${filename}`, invoiceUrl: `/outputs/invoices-${filename}` });
});

app.use('/outputs', express.static('outputs'));

app.listen(3000, () => console.log('PDF cropper running on http://localhost:3000'));
