import { AiFillFileImage, AiFillFilePdf, AiFillFileText } from 'react-icons/ai';

const ProcessingRow = () => (
  <tr className="scanning-row">
    <td>
      <div className="thumb-loading">
        <div className="skeleton-img"></div>
        <div className="scan-line"></div>
      </div>
    </td>
    <td>
      <div className="skeleton-text w-120"></div>
      <div className="skeleton-text w-80 mt-1"></div>
    </td>
    <td>
      <div className="skeleton-tag w-60"></div>
      <div className="skeleton-tag w-80 ml-1"></div>
    </td>
    <td>
      <span className="status-badge processing">
        <span className="pulse-dot"></span>
        查验中...
      </span>
    </td>
    <td>-</td>
  </tr>
);

const getFileExt = (record) => {
  const name = record && record.fileName ? String(record.fileName) : '';
  const url = record && record.preview && record.preview.fileUrl ? String(record.preview.fileUrl) : '';
  const source = name || url;
  if (!source) return '';
  const clean = source.split('?')[0].split('#')[0];
  const parts = clean.split('.');
  if (parts.length < 2) return '';
  return parts.pop().toLowerCase();
};

const isImageExt = (ext) => ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);

const InvoiceRow = ({ record, onView }) => {
  const ext = getFileExt(record);
  const preview = record.preview || {};
  const canShowImage = preview.isImage || isImageExt(ext);
  const thumbUrl = preview.dataUrl || (canShowImage ? preview.fileUrl : '');
  const isSuccess = record.status === 'success';
  return (
    <tr>
      <td>
        {thumbUrl ? (
          <div className="thumb-preview thumb-image" style={{ backgroundImage: `url('${thumbUrl}')` }}></div>
        ) : (
          <div className={`thumb-preview thumb-file ${ext === 'pdf' ? 'thumb-pdf' : ext === 'ofd' ? 'thumb-ofd' : 'thumb-image-icon'}`}>
            {ext === 'pdf' ? (
              <>
                <AiFillFilePdf />
                <span className="thumb-label">PDF</span>
              </>
            ) : ext === 'ofd' ? (
              <>
                <AiFillFileText />
                <span className="thumb-label">OFD</span>
              </>
            ) : (
              <>
                <AiFillFileImage />
                <span className="thumb-label">IMG</span>
              </>
            )}
          </div>
        )}
      </td>
      <td>
        <span className="invoice-id">{record.code}</span>
        <span className="invoice-code">{record.id}</span>
      </td>
      <td>
        <span className="tag tag-date">{record.uploadTime}</span>
      </td>
      <td>
        <span className="tag tag-date">{record.invoiceDate}</span>
      </td>
      <td>
        <span className="tag tag-amount">{record.amount}</span>
      </td>
      <td>
        <span className="tag tag-company">{record.seller}</span>
      </td>
      <td>
        <span className="tag tag-date">{record.type}</span>
      </td>
      <td>
        {isSuccess ? (
          <span className="status-badge verified">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            查验完成
          </span>
        ) : (
          <span className="status-badge pending">查验失败</span>
        )}
      </td>
      <td>
        <button className="btn-view" onClick={() => onView(record)}>
          查看
        </button>
      </td>
    </tr>
  );
};

const InvoiceTable = ({
  records,
  query,
  onQueryChange,
  onSearch,
  onClear,
  page,
  totalPages,
  onPrev,
  onNext,
  onView
}) => (
  <section className="table-section">
    <div className="section-header">
      <h2>最近上传</h2>
      <div className="actions">
        <div className="search-group">
          <input
            type="text"
            value={query}
            placeholder="输入发票号码"
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch();
            }}
          />
          <button className="btn-text" onClick={onSearch}>
            查询
          </button>
          <button className="btn-text" onClick={onClear}>
            清空
          </button>
        </div>
        <button className="btn-text">导出记录</button>
      </div>
    </div>
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th width="80">预览</th>
            <th>发票代码/号码</th>
            <th>上传时间</th>
            <th>开票日期</th>
            <th>发票金额</th>
            <th>销方名称</th>
            <th>发票类型</th>
            <th>查验状态</th>
            <th width="100">操作</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan="9">暂无记录</td>
            </tr>
          ) : (
            records.map((record) =>
              record.status === 'processing' ? (
                <ProcessingRow key={record.key} />
              ) : (
                <InvoiceRow key={record.key || `${record.code}-${record.id}-${record.uploadTime}`} record={record} onView={onView} />
              )
            )
          )}
        </tbody>
      </table>
    </div>
    <div className="pagination">
      <button className="btn-text" onClick={onPrev} disabled={page <= 1}>
        上一页
      </button>
      <span className="page-info">第 {page} / {totalPages} 页</span>
      <button className="btn-text" onClick={onNext} disabled={page >= totalPages}>
        下一页
      </button>
    </div>
  </section>
);

export default InvoiceTable;
