import { AiFillFileImage, AiFillFilePdf, AiFillFileText, AiOutlineCopy } from 'react-icons/ai';

const ProcessingRow = () => (
  <tr className="scanning-row">
    <td>
      <input type="checkbox" disabled />
    </td>
    <td>
      <div className="skeleton-text w-120"></div>
      <div className="skeleton-text w-80 mt-1"></div>
    </td>
    <td><div className="skeleton-text w-80"></div></td>
    <td><div className="skeleton-text w-80"></div></td>
    <td><div className="skeleton-tag w-60"></div></td>
    <td><div className="skeleton-text w-120"></div></td>
    <td><div className="skeleton-tag w-60"></div></td>
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
  return parts.pop().toLowerCase(); //测试git
};

const isImageExt = (ext) => ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);

const getFileIcon = (ext) => {
  if (ext === 'pdf') return <AiFillFilePdf className="type-icon pdf" title="PDF" />;
  if (ext === 'ofd') return <AiFillFileText className="type-icon ofd" title="OFD" />;
  return <AiFillFileImage className="type-icon img" title="图片" />;
};

const InvoiceRow = ({ record, onView, onDelete, isSelected, onSelect, onCopy }) => {
  const ext = getFileExt(record);
  const isSuccess = record.status === 'success';
  const canDelete = Boolean(record.rowId);
  return (
    <tr className={isSelected ? 'selected-row' : ''}>
      <td>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(record.key, e.target.checked)}
          disabled={record.status === 'processing'}
        />
      </td>
      <td>
        <div className="invoice-info-with-icon">
          {getFileIcon(ext)}
          <div className="invoice-numbers">
            <span className="invoice-id">
              {record.code}
              {record.code && (
                <button className="copy-btn" onClick={() => onCopy(record.code)} title="复制发票代码">
                  <AiOutlineCopy />
                </button>
              )}
            </span>
            <span className="invoice-code">
              {record.id}
              {record.id && (
                <button className="copy-btn" onClick={() => onCopy(record.id)} title="复制发票号码">
                  <AiOutlineCopy />
                </button>
              )}
            </span>
          </div>
        </div>
      </td>
      <td>
        <span className="tag tag-date">{record.uploadTime}</span>
      </td>
      <td>
        <span className="tag tag-date">{record.invoiceDate}</span>
      </td>
      <td>
        <span className="tag tag-amount font-mono font-bold amount-text">{record.amount}</span>
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
        <button className="btn-view btn-delete" onClick={() => onDelete(record)} disabled={!canDelete}>
          删除
        </button>
      </td>
    </tr>
  );
};

const InvoiceTable = ({
  records,
  query,
  displayQuery,
  onQueryChange,
  onSearch,
  onClear,
  page,
  totalPages,
  onPrev,
  onNext,
  onView,
  onDelete,
  selectedKeys,
  onSelectRow,
  onSelectAll,
  onBatchDelete,
  onBatchExport
}) => {
  const trimmedQuery = String(displayQuery || '').trim();
  const selectableRecords = records.filter(r => r.status !== 'processing');
  const allSelected = selectableRecords.length > 0 && selectableRecords.every(r => selectedKeys.includes(r.key));
  const someSelected = selectedKeys.length > 0;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // 简单派发自定义事件显示 Toast (或者传入 onCopySuccess)
      const event = new CustomEvent('show-toast', { detail: '复制成功：' + text });
      window.dispatchEvent(event);
    }).catch(err => console.error('复制失败', err));
  };

  return (
    <section className="table-section">
      <div className="section-header">
        <h2>
          最近上传
          {trimmedQuery ? <span className="tag tag-date">查询：{trimmedQuery}</span> : null}
        </h2>
        <div className="actions">
          <div className="batch-actions">
            {someSelected && (
              <>
                <span className="selected-count">已选 {selectedKeys.length} 项</span>
                <button 
                  className="btn-text btn-batch-export" 
                  onClick={onBatchExport}
                >
                  导出选中项
                </button>
                <button className="btn-text btn-batch-delete text-danger" onClick={onBatchDelete}>批量删除</button>
                <div className="divider"></div>
              </>
            )}
          </div>
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
        </div>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th width="40">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  disabled={selectableRecords.length === 0}
                />
              </th>
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
                <td colSpan="9">{trimmedQuery ? `未找到发票号 ${trimmedQuery}` : '暂无记录'}</td>
              </tr>
            ) : (
              records.map((record) =>
                record.status === 'processing' ? (
                  <ProcessingRow key={record.key} />
                ) : (
                  <InvoiceRow
                    key={record.key || `${record.code}-${record.id}-${record.uploadTime}`}
                    record={record}
                    onView={onView}
                    onDelete={onDelete}
                    isSelected={selectedKeys.includes(record.key)}
                    onSelect={onSelectRow}
                    onCopy={handleCopy}
                  />
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
};

export default InvoiceTable;
