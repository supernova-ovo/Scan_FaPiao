import { useMemo } from 'react';
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

const SkeletonRow = () => (
  <tr className="skeleton-row">
    <td>
      <input type="checkbox" disabled />
    </td>
    <td>
      <div className="skeleton-icon-wrapper">
         <div className="skeleton-circle"></div>
         <div>
            <div className="skeleton-text w-120"></div>
            <div className="skeleton-text w-80 mt-1"></div>
         </div>
      </div>
    </td>
    <td><div className="skeleton-text w-80"></div></td>
    <td><div className="skeleton-text w-80"></div></td>
    <td><div className="skeleton-tag w-60"></div></td>
    <td><div className="skeleton-text w-120"></div></td>
    <td><div className="skeleton-tag w-60"></div></td>
    <td><div className="skeleton-tag w-80 badge-skeleton"></div></td>
    <td>
      <div className="skeleton-text w-60"></div>
    </td>
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
        <span className="tag tag-company" title={record.seller}>{record.seller}</span>
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
  isLoading,
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
  onBatchExport,
  isExporting
}) => {
  const trimmedQuery = String(displayQuery || '').trim();
  const selectableRecords = records.filter(r => r.status !== 'processing');
  const allSelected = selectableRecords.length > 0 && selectableRecords.every(r => selectedKeys.includes(r.key));
  const someSelected = selectedKeys.length > 0;

  // Calculate total amount for selected invoices
  const selectedTotal = useMemo(() => {
    if (!someSelected) return 0;
    return records
      .filter(r => selectedKeys.includes(r.key))
      .reduce((sum, r) => {
        const amt = parseFloat(String(r.amount).replace(/[^0-9.-]+/g, ''));
        return sum + (isNaN(amt) ? 0 : amt);
      }, 0);
  }, [records, selectedKeys, someSelected]);

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
          <div className="search-group">
            <input
              type="text"
              value={query}
              placeholder="智能搜索: 号码/销方/金额/状态..."
              className="omni-search-input"
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
            {isLoading ? (
               // 渲染5行骨架屏占位图
               Array.from({ length: 5 }).map((_, idx) => <SkeletonRow key={`skeleton-${idx}`} />)
            ) : records.length === 0 ? (
              <tr>
                <td colSpan="9">
                  {trimmedQuery ? (
                    <div className="empty-search-state">
                      未找到与 <span className="highlight-query">"{trimmedQuery}"</span> 匹配的发票记录
                    </div>
                  ) : '暂无记录'}
                </td>
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

      {someSelected && (
        <div className="floating-action-bar active">
          <div className="floating-action-bar-inner">
            <div className="floating-info">
              <span className="selected-count">已选择 {selectedKeys.length} 项</span>
              <span className="divider"></span>
              <span className="selected-amount">共计 <span className="font-mono font-bold">¥ {selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
            </div>
            <div className="floating-actions">
              <button className={`btn-pill btn-export ${isExporting ? 'exporting' : ''}`} onClick={onBatchExport} disabled={isExporting}>
                {isExporting ? (
                  <svg className="loading-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                )}
                {isExporting ? '导出中...' : '批量导出'}
              </button>
              <button className="btn-pill btn-delete" onClick={onBatchDelete}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                批量删除
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default InvoiceTable;
