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

const md5 = (bytes) => {
  const hexChr = '0123456789abcdef';
  const rhex = (n) => {
    let s = '';
    for (let j = 0; j < 4; j += 1) {
      const byte = (n >>> (j * 8)) & 0xff;
      s += hexChr.charAt((byte >>> 4) & 0x0f) + hexChr.charAt(byte & 0x0f);
    }
    return s;
  };
  const add32 = (a, b) => (a + b) & 0xffffffff;
  const cmn = (q, a, b, x, s, t) => add32(((add32(add32(a, q), add32(x, t)) << s) | (add32(add32(a, q), add32(x, t)) >>> (32 - s))), b);
  const ff = (a, b, c, d, x, s, t) => cmn((b & c) | (~b & d), a, b, x, s, t);
  const gg = (a, b, c, d, x, s, t) => cmn((b & d) | (c & ~d), a, b, x, s, t);
  const hh = (a, b, c, d, x, s, t) => cmn(b ^ c ^ d, a, b, x, s, t);
  const ii = (a, b, c, d, x, s, t) => cmn(c ^ (b | ~d), a, b, x, s, t);
  const words = [];
  for (let i = 0; i < bytes.length; i += 1) {
    words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  }
  const bitLen = bytes.length * 8;
  words[bitLen >> 5] |= 0x80 << (bitLen % 32);
  words[(((bitLen + 64) >>> 9) << 4) + 14] = bitLen;
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;
  for (let i = 0; i < words.length; i += 16) {
    const oldA = a;
    const oldB = b;
    const oldC = c;
    const oldD = d;
    a = ff(a, b, c, d, words[i + 0], 7, -680876936);
    d = ff(d, a, b, c, words[i + 1], 12, -389564586);
    c = ff(c, d, a, b, words[i + 2], 17, 606105819);
    b = ff(b, c, d, a, words[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, words[i + 4], 7, -176418897);
    d = ff(d, a, b, c, words[i + 5], 12, 1200080426);
    c = ff(c, d, a, b, words[i + 6], 17, -1473231341);
    b = ff(b, c, d, a, words[i + 7], 22, -45705983);
    a = ff(a, b, c, d, words[i + 8], 7, 1770035416);
    d = ff(d, a, b, c, words[i + 9], 12, -1958414417);
    c = ff(c, d, a, b, words[i + 10], 17, -42063);
    b = ff(b, c, d, a, words[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, words[i + 12], 7, 1804603682);
    d = ff(d, a, b, c, words[i + 13], 12, -40341101);
    c = ff(c, d, a, b, words[i + 14], 17, -1502002290);
    b = ff(b, c, d, a, words[i + 15], 22, 1236535329);
    a = gg(a, b, c, d, words[i + 1], 5, -165796510);
    d = gg(d, a, b, c, words[i + 6], 9, -1069501632);
    c = gg(c, d, a, b, words[i + 11], 14, 643717713);
    b = gg(b, c, d, a, words[i + 0], 20, -373897302);
    a = gg(a, b, c, d, words[i + 5], 5, -701558691);
    d = gg(d, a, b, c, words[i + 10], 9, 38016083);
    c = gg(c, d, a, b, words[i + 15], 14, -660478335);
    b = gg(b, c, d, a, words[i + 4], 20, -405537848);
    a = gg(a, b, c, d, words[i + 9], 5, 568446438);
    d = gg(d, a, b, c, words[i + 14], 9, -1019803690);
    c = gg(c, d, a, b, words[i + 3], 14, -187363961);
    b = gg(b, c, d, a, words[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, words[i + 13], 5, -1444681467);
    d = gg(d, a, b, c, words[i + 2], 9, -51403784);
    c = gg(c, d, a, b, words[i + 7], 14, 1735328473);
    b = gg(b, c, d, a, words[i + 12], 20, -1926607734);
    a = hh(a, b, c, d, words[i + 5], 4, -378558);
    d = hh(d, a, b, c, words[i + 8], 11, -2022574463);
    c = hh(c, d, a, b, words[i + 11], 16, 1839030562);
    b = hh(b, c, d, a, words[i + 14], 23, -35309556);
    a = hh(a, b, c, d, words[i + 1], 4, -1530992060);
    d = hh(d, a, b, c, words[i + 4], 11, 1272893353);
    c = hh(c, d, a, b, words[i + 7], 16, -155497632);
    b = hh(b, c, d, a, words[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, words[i + 13], 4, 681279174);
    d = hh(d, a, b, c, words[i + 0], 11, -358537222);
    c = hh(c, d, a, b, words[i + 3], 16, -722521979);
    b = hh(b, c, d, a, words[i + 6], 23, 76029189);
    a = hh(a, b, c, d, words[i + 9], 4, -640364487);
    d = hh(d, a, b, c, words[i + 12], 11, -421815835);
    c = hh(c, d, a, b, words[i + 15], 16, 530742520);
    b = hh(b, c, d, a, words[i + 2], 23, -995338651);
    a = ii(a, b, c, d, words[i + 0], 6, -198630844);
    d = ii(d, a, b, c, words[i + 7], 10, 1126891415);
    c = ii(c, d, a, b, words[i + 14], 15, -1416354905);
    b = ii(b, c, d, a, words[i + 5], 21, -57434055);
    a = ii(a, b, c, d, words[i + 12], 6, 1700485571);
    d = ii(d, a, b, c, words[i + 3], 10, -1894986606);
    c = ii(c, d, a, b, words[i + 10], 15, -1051523);
    b = ii(b, c, d, a, words[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, words[i + 8], 6, 1873313359);
    d = ii(d, a, b, c, words[i + 15], 10, -30611744);
    c = ii(c, d, a, b, words[i + 6], 15, -1560198380);
    b = ii(b, c, d, a, words[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, words[i + 4], 6, -145523070);
    d = ii(d, a, b, c, words[i + 11], 10, -1120210379);
    c = ii(c, d, a, b, words[i + 2], 15, 718787259);
    b = ii(b, c, d, a, words[i + 9], 21, -343485551);
    a = add32(a, oldA);
    b = add32(b, oldB);
    c = add32(c, oldC);
    d = add32(d, oldD);
  }
  return rhex(a) + rhex(b) + rhex(c) + rhex(d);
};

const computeMd5 = async (file) => {
  const buffer = await readFileAsArrayBuffer(file);
  const bytes = new Uint8Array(buffer);
  return md5(bytes);
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

const findCachedByMd5 = async (md5Value) => {
  if (!md5Value) return null;
  const result = await querySection('d0855c81-fd6a-7c63-5eb7-e9d5e7b92cf5', {
    where: { QRCodeStr: md5Value },
    pageIndex: 1,
    pageSize: 1
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

const parseResponseJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    return { STATUS: 'ERROR', MSG: text };
  }
};

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
  const formData = new FormData();
  formData.append('id', id);
  formData.append('mode', 'update');
  formData.append('_id', String(rowId));
  formData.append('ID', String(rowId));
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined) return;
    formData.append(`_p_${key}`, String(value));
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
  const where = buildWhereFromQuery(query);
  const result = await querySection('d0855c81-fd6a-7c63-5eb7-e9d5e7b92cf5', {
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
};

export const fetchStats = async (where) => {
  const statsPageSize = 200;
  let pageIndex = 1;
  let total = 0;
  let success = 0;
  while (true) {
    const result = await querySection('d0855c81-fd6a-7c63-5eb7-e9d5e7b92cf5', {
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
  let useBackend = true;
  let backendJson = null;
  try {
    const backendResponse = await fetch(appConfig.scanServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pdfBase64: base64
      })
    });
    if (backendResponse.ok) {
      backendJson = await parseJsonFromResponse(backendResponse);
      if (!backendJson) {
        useBackend = false;
      }
    } else {
      useBackend = false;
    }
  } catch (e) {
    useBackend = false;
  }
  if (useBackend && backendJson) {
    return { json: backendJson, dataUrl, isImage: file.type.startsWith('image/') };
  }
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
  return { json, dataUrl, isImage: file.type.startsWith('image/') };
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

export const verifyInvoiceWithUpload = async (file, options = {}) => {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const shouldUpload = options.upload !== false && isPdf;
  let fileUrl = '';
  const md5Value = await computeMd5(file);
  const cached = await findCachedByMd5(md5Value);
  if (cached) {
    const { dataUrl } = await readFileAsBase64(file);
    const cachedJson = cached.json;
    console.log('cached invoice json', cachedJson);
    const now = formatDateTime(new Date());
    try {
      await updateSectionRow('d0855c81-fd6a-7c63-5eb7-e9d5e7b92cf5', cached.row, {
        SaoMiaoSJ: now
      });
    } catch (e) {
      console.warn('update scan time failed', e);
    }
    const success = cachedJson && cachedJson.success === true;
    const payload = cachedJson && cachedJson.data ? cachedJson.data : {};
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
    const [vResult, url] = await Promise.all([verifyInvoice(file), uploadFileToServer(file)]);
    verifyResult = vResult;
    fileUrl = url;
  } else {
    verifyResult = await verifyInvoice(file);
  }
  const { json, dataUrl, isImage } = verifyResult;
  const success = json && json.success === true;
  const payload = json && json.data ? json.data : {};
  const data = normalizeInvoiceData(payload, file);
  return {
    success,
    data,
    payload,
    preview: { dataUrl, isImage, fileUrl },
    raw: json || {}
  };
};
