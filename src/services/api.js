import SparkMD5 from 'spark-md5';
import { appConfig } from '../config';
import { buildWhereFromQuery, normalizeInvoiceData } from '../utils/invoice';

const joinUrl = (base, path) => `${String(base).replace(/\/+$/, '')}${path}`;

const formatDateTime = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

const normalizeDateTime = (value) => {
  if (!value) return '';
  if (value instanceof Date) return formatDateTime(value);
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : formatDateTime(d);
  }
  const text = String(value).trim();
  if (!text) return '';
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  const d = new Date(text);
  if (!Number.isNaN(d.getTime())) {
    return formatDateTime(d);
  }
  return text;
};

const base64Encode = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const createGuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const toNullableValue = (value) => {
  if (value === '' || value === undefined || value === null) return null;
  return value;
};

const toNullableNumber = (value) => {
  if (value === '' || value === undefined || value === null) return null;
  const text = String(value).replace(/,/g, '');
  const num = Number(text);
  return Number.isNaN(num) ? value : num;
};

const trimText = (value) => String(value || '').trim();

const getCurrentGongHao = () => {
  const candidates = [
    appConfig.GongHao,
    appConfig.gonghao,
    appConfig.userId,
    appConfig.userID,
    appConfig.USERID
  ];
  const picked = candidates.find((value) => String(value || '').trim() !== '');
  return picked ? String(picked).trim() : '';
};

const fetchCompanyAllowList = async () => {
  const id = appConfig.companyAllowSectionId;
  if (!id) return [];
  const result = await querySection(id, { where: {}, pageIndex: 1, pageSize: 200 });
  if (!result || result.STATUS !== 'Success') return [];
  const rows = Array.isArray(result.ROWS) ? result.ROWS : [];
  return rows
    .map((r) => ({
      nsrsbh: trimText(r.NaShuiRSBH || r.nsrsbh || r.NSRSBH || ''),
      name: trimText(r.DanWeiMC || r.name || r.DanWeiMc || '')
    }))
    .filter((x) => x.nsrsbh && x.name);
};

const isInvoiceAllowedForCompany = async (payload) => {
  const list = await fetchCompanyAllowList();
  const scanNSBH = trimText(payload && (payload.gfNsrsbh || payload.gfnsrsbh || payload.gfsh || ''));
  const scanName = trimText(payload && (payload.gfMc || payload.gfmc || payload.company || ''));
  if (!scanNSBH || !scanName || !list.length) return false;
  for (let i = 0; i < list.length; i += 1) {
    if (scanNSBH === list[i].nsrsbh && scanName === list[i].name) {
      return true;
    }
  }
  return false;
};

const readFileAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('文件读取失败'));
        return;
      }
      const base64 = result.split(',')[1] || '';
      resolve({ base64, dataUrl: result });
    };
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });

const readFileAsArrayBuffer = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });

const computeMd5 = async (file) => {
  const buffer = await readFileAsArrayBuffer(file);
  return SparkMD5.ArrayBuffer.hash(buffer);
};

const parseJsonValue = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      return null;
    }
  }
  return null;
};

const findCachedByMd5AndUser = async (md5Value, gonghao) => {
  if (!md5Value) return null;
  const where = gonghao ? { QRCodeStr: md5Value, GongHao: gonghao } : { QRCodeStr: md5Value };
  const result = await querySection(appConfig.invoiceScanLogSectionId, {
    where,
    pageIndex: 1,
    pageSize: 3
  });
  if (!result || result.STATUS !== 'Success') {
    return null;
  }
  const rows = Array.isArray(result.ROWS) ? result.ROWS : [];
  if (!rows.length) return null;
  const row = rows.find((item) => String(item.QRCodeStr || '') === md5Value);
  if (!row) return null;
  const json = parseJsonValue(row.json);
  if (!json) return null;
  return { row, json };
};

const getRowId = (row) => {
  if (!row) return '';
  return row.ID || row.Id || row.id || row._id || '';
};

const queryByWhere = async (id, where, pageSize = 5) => {
  const result = await querySection(id, { where, pageIndex: 1, pageSize });
  if (!result || result.STATUS !== 'Success') return [];
  return Array.isArray(result.ROWS) ? result.ROWS : [];
};

const findScanLogByInvoice = async (fpdm, fphm) => {
  const sectionId = appConfig.invoiceScanLogSectionId;
  if (!sectionId) return null;
  const rows1 = await queryByWhere(sectionId, { FaPiaoDM: fpdm || '', FaPiaoHM: fphm || '' }, 5);
  const hit1 = rows1.find((r) => String(r.FaPiaoHM || '') === String(fphm || ''));
  if (hit1) return hit1;
  const rows2 = await queryByWhere(sectionId, { fpdm: fpdm || '', fphm: fphm || '' }, 5);
  const hit2 = rows2.find((r) => String(r.fphm || '') === String(fphm || ''));
  return hit2 || null;
};

const parseResponseJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    return { STATUS: 'ERROR', MSG: text };
  }
};

const postSectionDataset = async (id, dataset) => {
  if (!id) {
    return { STATUS: 'Error', MESSAGE: '区块ID不能为空' };
  }
  const formData = new FormData();
  formData.append('id', id);
  formData.append('mode', 'update');
  formData.append('_p_data', base64Encode(dataset));
  const headers = {};
  if (appConfig.jetopAuthToken) {
    headers['X-JetopDebug-User'] = appConfig.jetopAuthToken;
  }
  const response = await fetch(joinUrl(appConfig.jetopApiBaseUrl, '/ks/sectionHandler.ashx'), {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include'
  });
  const raw = await parseResponseJson(response);
  if (raw && raw.STATUS === 'OK') {
    return { ...raw, STATUS: 'Success', MESSAGE: raw.MSG || '' };
  }
  if (raw && raw.STATUS === 'ERROR') {
    return { ...raw, STATUS: 'Error', MESSAGE: raw.MSG || '' };
  }
  return raw;
};

export const markScanLogDeleted = async (rowId) => {
  if (!rowId) return null;
  const res = await updateSectionRow(appConfig.invoiceScanLogSectionId, { ID: rowId }, {
    isdelete: true,
    DelDate: formatDateTime(new Date())
  });
  console.log('[delete scanlog]', { rowId, res });
  return res;
};

export const markScanLogBatchDeleted = async (rowIds) => {
  if (!rowIds || !rowIds.length) return null;
  const now = formatDateTime(new Date());
  const updatedRows = rowIds.map((id) => ({
    ID: String(id),
    isdelete: true,
    DelDate: now
  }));
  const res = await updateSectionRows(appConfig.invoiceScanLogSectionId, updatedRows);
  console.log('[batch delete scanlog]', { count: rowIds.length, res });
  return res;
};

export const markScanLogDeletedByInvoice = async (fpdm, fphm) => {
  if (!fpdm || !fphm) return null;
  const row = await findScanLogByInvoice(fpdm, fphm);
  if (!row) return null;
  return updateSectionRow(appConfig.invoiceScanLogSectionId, row, { isdelete: true });
};

const insertSectionRows = async (id, rows) => postSectionDataset(id, { inserted: rows, updated: [], deleted: [] });

const updateSectionRows = async (id, rows) => postSectionDataset(id, { inserted: [], updated: rows, deleted: [] });

const parseJsonFromResponse = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

const updateSectionRow = async (id, row, fields) => {
  if (!id || !row || !fields) return null;
  const rowId = getRowId(row);
  if (!rowId) return null;
  const updatedRow = { ID: String(rowId) };
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined) return;
    if (key === 'ID') return;
    updatedRow[key] = (typeof value === 'boolean' || typeof value === 'number') ? value : String(value);
  });
  return updateSectionRows(id, [updatedRow]);
};

export const querySection = async (id, options = {}) => {
  if (!id) {
    return { STATUS: 'Error', MESSAGE: '区块ID不能为空', TOTAL: 0, ROWS: [] };
  }
  const where = options.where || {};
  const pageIndex = options.pageIndex || 1;
  const pageSize = options.pageSize || 10;
  const formData = new FormData();
  formData.append('id', id);
  formData.append('mode', 'query');
  formData.append('_pageindex', String(pageIndex));
  formData.append('_pagesize', String(pageSize));
  Object.entries(where).forEach(([key, value]) => {
    if (value === undefined) return;
    if (key.startsWith('_p_')) {
      formData.append(key, String(value));
    } else if (key.startsWith('where_')) {
      formData.append(`_p_${key.slice(6)}`, String(value));
    } else {
      formData.append(`_p_${key}`, String(value));
    }
  });
  const headers = {};
  if (appConfig.jetopAuthToken) {
    headers['X-JetopDebug-User'] = appConfig.jetopAuthToken;
  }
  const response = await fetch(joinUrl(appConfig.jetopApiBaseUrl, '/ks/sectionHandler.ashx'), {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include'
  });
  const raw = await parseResponseJson(response);
  if (raw && raw.STATUS === 'OK') {
    return { ...raw, STATUS: 'Success', MESSAGE: raw.MSG || '' };
  }
  if (raw && raw.STATUS === 'ERROR') {
    return { ...raw, STATUS: 'Error', MESSAGE: raw.MSG || '' };
  }
  return raw;
};

export const fetchScanLogs = async (pageIndex, pageSize, query) => {
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    const where = buildWhereFromQuery(query);
    const result = await querySection(appConfig.invoiceScanLogSectionId, {
      where,
      pageIndex,
      pageSize
    });
    if (!result || result.STATUS !== 'Success') {
      return { rows: [], total: 0, where };
    }
    const rows = Array.isArray(result.ROWS) ? result.ROWS : [];
    const total = Number(result.TOTAL || rows.length || 0);
    return { rows, total, where };
  }
  const matchInvoiceNo = (row, invoiceNo) => {
    if (!row || !invoiceNo) return false;
    const direct = [
      row.FaPiaoHM,
      row.fphm,
      row.FPHM,
      row.FaPiaoHm,
      row.fphmStr,
      row.FaPiaoHMStr
    ];
    const json = parseJsonValue(row.json);
    if (json && typeof json === 'object') {
      direct.push(json.fphm, json.number, json.id, json.FaPiaoHM, json.FaPiaoHm, json.fpHm, json.fpHM);
    }
    return direct.some((value) => value !== undefined && value !== null && String(value).trim() === invoiceNo);
  };
  const scanPageSize = Math.max(pageSize, 200);
  const maxPages = 20;
  let currentPage = 1;
  let totalPages = 1;
  const collected = [];
  while (currentPage <= totalPages && currentPage <= maxPages) {
    const result = await querySection(appConfig.invoiceScanLogSectionId, {
      where: {},
      pageIndex: currentPage,
      pageSize: scanPageSize
    });
    if (!result || result.STATUS !== 'Success') {
      break;
    }
    const rows = Array.isArray(result.ROWS) ? result.ROWS : [];
    const total = Number(result.TOTAL || rows.length || 0);
    totalPages = Math.max(1, Math.ceil(total / scanPageSize));
    rows.forEach((row) => {
      if (matchInvoiceNo(row, trimmed)) collected.push(row);
    });
    currentPage += 1;
  }
  const map = new Map();
  collected.forEach((row, index) => {
    const key = row && (row.ID || row.Id || row.id || row._id || row.sys_id);
    const fallback = `${row && (row.FaPiaoHM || row.fphm || '')}-${row && (row.SaoMiaoSJ || '')}-${index}`;
    const finalKey = key ? String(key) : fallback;
    if (!map.has(finalKey)) map.set(finalKey, row);
  });
  const allRows = Array.from(map.values());
  const total = allRows.length;
  const start = Math.max(0, (pageIndex - 1) * pageSize);
  const rows = allRows.slice(start, start + pageSize);
  return { rows, total, where: { query: trimmed } };
};

export const fetchStats = async (where) => {
  const statsPageSize = 200;
  let pageIndex = 1;
  let total = 0;
  let success = 0;
  while (true) {
    const result = await querySection(appConfig.invoiceScanLogSectionId, {
      where,
      pageIndex,
      pageSize: statsPageSize
    });
    if (!result || result.STATUS !== 'Success') {
      break;
    }
    const rows = Array.isArray(result.ROWS) ? result.ROWS : [];
    if (pageIndex === 1) {
      total = Number(result.TOTAL || rows.length || 0);
    }
    rows.forEach((log) => {
      const ok = log && (log.success === 1 || log.success === true || String(log.success).toLowerCase() === 'true');
      if (ok) success += 1;
    });
    const totalPages = Math.max(1, Math.ceil((total || 0) / statsPageSize));
    if (pageIndex >= totalPages) break;
    pageIndex += 1;
  }
  return { total, success };
};

export const verifyInvoice = async (file) => {
  const { base64, dataUrl } = await readFileAsBase64(file);
  const body = new URLSearchParams();
  body.append('pdfBase64', base64);
  const response = await fetch(appConfig.invoiceVerifyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body
  });
  const json = await parseJsonFromResponse(response);
  console.log('[verifyInvoice response]', json);
  return { json, dataUrl, isImage: file.type.startsWith('image/') };
};

const tpcsAsync = async (svrName, data) => {
  const processedData = typeof data === 'string' ? data : JSON.stringify(data);
  const response = await fetch(`https://lolapi.tepc.cn/tpcs/${svrName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: processedData
  });
  if (!response.ok) {
    throw new Error(`TPCS request failed: ${response.statusText}`);
  }
  return response.json();
};

export const verifyImageInvoice = async (file) => {
  const { base64, dataUrl } = await readFileAsBase64(file);
  
  // 1. OCR识别
  const ocrRes = await tpcsAsync('iocrfinance', {
    image: base64,
    url: "",
    pdf_file: "",
    templateSign: "mixed_receipt",
    classifierId: ""
  });
  
  if (!ocrRes.IsSuccess) {
    return { json: { success: false, message: ocrRes.Msg || 'OCR识别失败' }, dataUrl, isImage: true };
  }
  
  const returnData = ocrRes.data || {};
  let obj = {};
  if (returnData.data && returnData.data.ret) {
    returnData.data.ret.forEach(item => {
      if (item.ret) {
        item.ret.forEach(retItem => {
          obj[retItem.word_name] = retItem.word;
        });
      }
    });
  }
  
  let check_code = obj.CheckCode || '';
  if (check_code.length > 6) {
    check_code = check_code.substring(check_code.length - 6);
  }
  
  if (!obj.InvoiceNum) {
     return { json: { success: false, message: '未识别到有效发票信息' }, dataUrl, isImage: true };
  }

  // 还原旧系统的 creatStr (QR Code String) 逻辑
  const getInvoiceType = (fpdm) => {
    if (!fpdm) return "";
    const someCode = ["144031539110", "131001570151", "133011501118", "111001571071"];
    if (someCode.includes(fpdm)) return "10";
    if (fpdm.length === 12) {
        if (fpdm.charAt(0) === '0' && fpdm.substring(10, 12) === '11') return "10";
        if (fpdm.charAt(0) === '0' && fpdm.substring(10, 12) === '12') return "14";
        if (fpdm.charAt(0) === '0' && (fpdm.substring(10, 12) === '04' || fpdm.substring(10, 12) === '05')) return "04";
        if (fpdm.charAt(0) === '0' && (fpdm.substring(10, 12) === '06' || fpdm.substring(10, 12) === '07')) return "11";
        if (fpdm.charAt(0) === '0' && fpdm.substring(10, 12) === '17') return "15";
        if (fpdm.charAt(0) !== '0' && fpdm.substring(7, 8) === '2') return "03";
    }
    if (fpdm.length === 10) {
        const b = fpdm.substring(7, 8);
        if (b === '1' || b === '5') return "01";
        if (b === '6' || b === '3') return "04";
        if (b === '7' || b === '2') return "02";
    }
    return "";
  };

  const invoiceType = getInvoiceType(obj.InvoiceCode);
  const formattedDate = obj.InvoiceDate ? obj.InvoiceDate.replace(/-/g, '') : '';
  const qrCodeStr = `01,${invoiceType},${obj.InvoiceCode},${obj.InvoiceNum},${obj.TotalAmount},${formattedDate},${check_code},,`;

  const key = {
    fpdm: obj.InvoiceCode || "",
    fphm: obj.InvoiceNum || "",
    kprq: obj.InvoiceDate || "",
    noTaxAmount: obj.TotalAmount || "",
    checkCode: check_code,
    jshj: obj.AmountInFiguers || "",
    qrCodeStr,
  };
  
  // 2. 验真请求
  const verifyRes = await tpcsAsync('invoicequery', key);
  
  if (!verifyRes.IsSuccess) {
     return { json: { success: false, message: verifyRes.Msg || '验真失败' }, dataUrl, isImage: true };
  }
  
  let resData = verifyRes.data && verifyRes.data.data ? verifyRes.data.data : {};
  
  const json = {
    success: true,
    data: {
      ...resData,
      fpdm: resData.fpdm || key.fpdm,
      fphm: resData.fphm || key.fphm,
      kprq: resData.kprq || key.kprq,
      sumamount: resData.sumamount || key.jshj,
      amount: resData.sumamount || key.jshj,
      goodsamount: resData.noTaxAmount || key.noTaxAmount,
      checkCode: key.checkCode,
      sellerName: resData.xfmc || resData.xfMc || "",
      buyerName: resData.gfmc || resData.gfMc || "",
      qrCodeStr: key.qrCodeStr, // 传递给持久化层
    }
  };
  return { json, dataUrl, isImage: true };
};

export const uploadFileToServer = async (file) => {
  const formData = new FormData();
  formData.append('imgFile', file);
  const response = await fetch(appConfig.uploadUrl, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    return '';
  }
  const text = await response.text();
  let realRes;
  try {
    realRes = typeof text === 'string' ? JSON.parse(text) : text;
  } catch (e) {
    realRes = {};
  }
  if (!realRes || !realRes.url) {
    return '';
  }
  return realRes.url;
};

const buildDetailRow = (payload, now) => {
  const fpdm = payload && (payload.fpdm || payload.code || payload.fpCode || '');
  const fphm = payload && (payload.fphm || payload.number || payload.id || '');
  const kprq = normalizeDateTime(payload && (payload.kprq || payload.kpsj || payload.date || payload.kprqStr || ''));
  const gfmc = payload && (payload.gfMc || payload.gfmc || payload.buyerName || payload.company || '');
  const xfmc = payload && (payload.xfMc || payload.xfmc || payload.sellerName || '');
  const je = payload && (payload.sumamount || payload.goodsamount || payload.taxamount || payload.amount || '');
  return {
    fpdm: fpdm || '',
    fphm: fphm || '',
    kprq: kprq || '',
    gfmc: gfmc || '',
    xfmc: xfmc || '',
    je: je || '',
    id: createGuid(),
    dateBegin: now
  };
};

const buildGoodsRows = (payload, fpdm, fphm, now) => {
  const goods = payload && Array.isArray(payload.goodsData) ? payload.goodsData : payload && Array.isArray(payload.goods) ? payload.goods : [];
  return goods.map((item) => ({
    fpdm: fpdm || '',
    fphm: fphm || '',
    MingCheng: item.name || item.MingCheng || item.mc || '',
    GuiGe: item.spec || item.GuiGe || item.gg || '',
    DanWei: item.unit || item.DanWei || item.dw || '',
    ShuLiang: toNullableNumber(item.amount ?? item.ShuLiang),
    DanJia: toNullableNumber(item.priceUnit ?? item.DanJia),
    JinE: toNullableNumber(item.priceSum ?? item.JinE),
    ShuiLv: toNullableNumber(item.taxRate ?? item.ShuiLv),
    ShuiE: toNullableNumber(item.taxSum ?? item.ShuiE),
    id: createGuid(),
    dateBegin: now
  }));
};

const buildScanLogRow = (payload, fpdm, fphm, success, fileUrl, md5Value, now, gonghao) => ({
  GongHao: gonghao || null,
  QRCodeStr: md5Value || '',
  FaPiaoDM: fpdm || '',
  FaPiaoHM: fphm || '',
  json: JSON.stringify(payload || {}),
  Url: fileUrl || '',
  success: Boolean(success),
  id: createGuid(),
  SaoMiaoSJ: now
});

const persistInvoiceAfterVerify = async ({ payload, raw, success, fileUrl, md5Value }) => {
  const now = formatDateTime(new Date());
  const detailRow = buildDetailRow(payload, now);
  const tasks = [];
  const meta = {
    fpdm: detailRow.fpdm,
    fphm: detailRow.fphm,
    md5: md5Value || '',
    url: fileUrl || ''
  };
  if (appConfig.invoiceDetailSectionId) {
    tasks.push(
      insertSectionRows(appConfig.invoiceDetailSectionId, [detailRow]).then((res) => ({
        scope: 'detail',
        sectionId: appConfig.invoiceDetailSectionId,
        res
      }))
    );
  }
  if (appConfig.invoiceGoodsSectionId) {
    const goodsRows = buildGoodsRows(payload, detailRow.fpdm, detailRow.fphm, now);
    if (goodsRows.length) {
      tasks.push(
        insertSectionRows(appConfig.invoiceGoodsSectionId, goodsRows).then((res) => ({
          scope: 'goods',
          sectionId: appConfig.invoiceGoodsSectionId,
          count: goodsRows.length,
          res
        }))
      );
    }
  }
  if (appConfig.invoiceScanLogSectionId) {
    const gonghao = getCurrentGongHao();
    const logRow = buildScanLogRow(payload, detailRow.fpdm, detailRow.fphm, success, fileUrl, md5Value, now, gonghao);
    tasks.push(
      (async () => {
        const existed = await findCachedByMd5AndUser(md5Value, gonghao);
        if (existed) {
          const updateFields = {
            GongHao: gonghao || null,
            SaoMiaoSJ: now,
            success: Boolean(success),
            json: JSON.stringify(payload || {}),
            QRCodeStr: md5Value || logRow.QRCodeStr
          };
          if (fileUrl) updateFields.Url = fileUrl;
          const res = await updateSectionRow(appConfig.invoiceScanLogSectionId, existed.row || existed, updateFields);
          return { scope: 'scanLog', sectionId: appConfig.invoiceScanLogSectionId, mode: 'update', res };
        }
        const res = await insertSectionRows(appConfig.invoiceScanLogSectionId, [logRow]);
        return { scope: 'scanLog', sectionId: appConfig.invoiceScanLogSectionId, mode: 'insert', res };
      })()
    );
  }
  if (!tasks.length) return null;
  const results = await Promise.all(tasks);
  console.log('[persist invoice]', meta, results);
  return results;
};

export const verifyInvoiceWithUpload = async (file, options = {}) => {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const fileIsImage = file.type.startsWith('image/');
  const shouldUpload = options.upload !== false && (isPdf || fileIsImage);
  let fileUrl = '';
  const md5Value = await computeMd5(file);
  const cached = await findCachedByMd5AndUser(md5Value, getCurrentGongHao());
  if (cached) {
    if (typeof window !== 'undefined' && typeof window.notifyInvoiceCached === 'function') {
      window.notifyInvoiceCached();
    }
    const { dataUrl } = await readFileAsBase64(file);
    const cachedJson = cached.json;
    console.log('cached invoice json', cachedJson);
    const now = formatDateTime(new Date());
    try {
      await updateSectionRow(appConfig.invoiceScanLogSectionId, cached.row, {
        SaoMiaoSJ: now
      });
    } catch (e) {
      console.warn('update scan time failed', e);
    }
    const success = cached.row && (cached.row.success === 1 || cached.row.success === true || String(cached.row.success).toLowerCase() === 'true');
    const payload = cachedJson && cachedJson.data ? cachedJson.data : cachedJson || {};
    const data = normalizeInvoiceData(payload, file);
    return {
      success,
      data,
      payload,
      preview: {
        dataUrl,
        isImage: file.type.startsWith('image/'),
        fileUrl: cached.row && cached.row.Url ? String(cached.row.Url) : ''
      },
      raw: cachedJson
    };
  }
  let verifyResult;
  if (shouldUpload) {
    const apiCall = file.type.startsWith('image/') ? verifyImageInvoice(file) : verifyInvoice(file);
    const [vResult, url] = await Promise.all([apiCall, uploadFileToServer(file)]);
    verifyResult = vResult;
    fileUrl = url;
  } else {
    verifyResult = file.type.startsWith('image/') ? await verifyImageInvoice(file) : await verifyInvoice(file);
  }
  const { json, dataUrl, isImage } = verifyResult;
  console.log('[verify result]', json);
  const success = json && json.success === true;
  const payload = json && json.data ? json.data : {};
  const data = normalizeInvoiceData(payload, file);
  try {
    const allow = success ? await isInvoiceAllowedForCompany(payload) : false;
    console.log('[company allow check]', {
      nsrsbh: trimText(payload && (payload.gfNsrsbh || payload.gfnsrsbh || payload.gfsh || '')),
      name: trimText(payload && (payload.gfMc || payload.gfmc || payload.company || '')),
      allow
    });
    if (allow) {
      const persistResult = await persistInvoiceAfterVerify({
        payload,
        raw: json || {},
        success,
        fileUrl,
        md5Value: payload.qrCodeStr || md5Value // 图片优先使用生成的qrCodeStr作为唯一标识
      });
      console.log('[persist result]', persistResult);
    } else {
      console.warn('[persist skipped] 非公司发票或验真失败');
    }
  } catch (e) {
    console.warn('[persist invoice failed]', e);
  }
  return {
    success,
    data,
    payload,
    preview: { dataUrl, isImage, fileUrl },
    raw: json || {}
  };
};
