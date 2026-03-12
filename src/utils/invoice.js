const formatDateYMD = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const formatDateTime = (date) => {
  const ymd = formatDateYMD(date);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${ymd} ${hh}:${mm}:${ss}`;
};

const parseInvoiceDate = (value) => {
  if (!value) return '';
  if (value instanceof Date) return formatDateYMD(value);
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : formatDateYMD(d);
  }
  const str = String(value).trim();
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? str : formatDateYMD(d);
};

const formatAmount = (value) => {
  if (value === undefined || value === null || value === '') return '';
  const num = Number(String(value).replace(/,/g, ''));
  if (Number.isFinite(num)) return `¥ ${num.toLocaleString()}`;
  return String(value);
};

export const normalizeInvoiceData = (raw, file) => {
  const now = new Date();
  const code = raw && raw.fpdm ? String(raw.fpdm) : '';
  const number = raw && raw.fphm ? String(raw.fphm) : '';
  const invoiceDate = raw ? parseInvoiceDate(raw.kprq || raw.kpsj || raw.date) : '';
  const amount = raw ? formatAmount(raw.sumamount || raw.goodsamount || raw.taxamount) : '';
  const buyer = raw ? (raw.gfMc || raw.gfmc || raw.company || '') : '';
  const seller = raw ? (raw.xfMc || raw.xfmc || '') : '';
  const type = raw ? (raw.fplxName || raw.fplx || raw.fpzlmc || raw.fpzl || raw.invoiceType || '') : '';
  return {
    code: code || '—',
    id: number || '—',
    uploadTime: formatDateTime(now),
    invoiceDate: invoiceDate || '—',
    amount: amount || '—',
    buyer: buyer || '—',
    seller: seller || '—',
    type: type || '—',
    fileName: file && file.name ? file.name : '文件',
    raw: raw || {}
  };
};

export const buildWhereFromQuery = (query) => {
  const trimmed = String(query || '').trim();
  if (!trimmed) return {};
  return { where_FaPiaoHM: trimmed };
};

const extractFileNameFromUrl = (url) => {
  if (!url) return '历史扫描';
  try {
    const u = new URL(url, window.location.origin);
    const name = u.pathname.split('/').pop();
    return name || '历史扫描';
  } catch (e) {
    const parts = String(url).split('/');
    const last = parts.pop();
    return last || '历史扫描';
  }
};

export const createProcessingRecord = (file, key) => ({
  key,
  status: 'processing',
  code: '—',
  id: '—',
  uploadTime: '—',
  invoiceDate: '—',
  amount: '—',
  buyer: '—',
  seller: '—',
  type: '—',
  fileName: file && file.name ? file.name : '文件',
  preview: {},
  message: ''
});

export const mapLogToRecord = (log) => {
  const parsed = (() => {
    if (!log || !log.json) return {};
    if (typeof log.json === 'object') return log.json || {};
    try {
      return JSON.parse(log.json);
    } catch (e) {
      return {};
    }
  })();
  const raw = parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
  const fileName = extractFileNameFromUrl(log && log.Url ? log.Url : '');
  const data = normalizeInvoiceData(raw, { name: fileName });
  if (data.code === '—' && log && log.FaPiaoDM) data.code = String(log.FaPiaoDM);
  if (data.id === '—' && log && log.FaPiaoHM) data.id = String(log.FaPiaoHM);
  if (log && log.SaoMiaoSJ) {
    const d = new Date(log.SaoMiaoSJ);
    data.uploadTime = Number.isNaN(d.getTime()) ? String(log.SaoMiaoSJ) : formatDateTime(d);
  }
  const ok = log && (log.success === 1 || log.success === true || String(log.success).toLowerCase() === 'true');
  const message = parsed && parsed.message ? parsed.message : '查验失败';
  return {
    ...data,
    status: ok ? 'success' : 'fail',
    preview: {
      dataUrl: '',
      isImage: false,
      fileUrl: log && log.Url ? String(log.Url) : ''
    },
    message,
    raw
  };
};
