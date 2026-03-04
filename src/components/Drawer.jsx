import { AiOutlineClose } from 'react-icons/ai';

const Drawer = ({ record, onClose }) => {
  const isOpen = Boolean(record);
  const preview = record && record.preview ? record.preview : {};
  const showImage = preview.isImage && preview.dataUrl;
  const fileUrl = preview.fileUrl || '';
  const success = record && record.status === 'success';
  const stampText = success ? '查验通过' : '查验失败';
  const resultTitle = success ? '查验通过' : '查验失败';
  const resultText = success ? '查验通过' : record && record.message ? record.message : '查验失败';

  return (
    <div className={`drawer-overlay${isOpen ? ' active' : ''}`} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <aside className="drawer">
        <div className="drawer-header">
          <h3>发票详情</h3>
          <button className="close-btn" onClick={onClose}>
            <AiOutlineClose size={16} />
          </button>
        </div>
        <div className="drawer-content">
          <div className="preview-container">
            <div className="invoice-preview">
              {showImage ? (
                <img className="preview-img" src={preview.dataUrl} alt="preview" />
              ) : fileUrl ? (
                <iframe className="preview-iframe" src={fileUrl} title="preview" />
              ) : (
                <div id="previewPlaceholder">当前文件暂无预览</div>
              )}
              <div className={`watermark-stamp${success ? ' show' : ''}`}>
                <div className="stamp-inner">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>{stampText}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="invoice-meta">
            <div className="meta-group">
              <label>发票代码</label>
              <div className="meta-value">{record ? record.code : '—'}</div>
            </div>
            <div className="meta-group">
              <label>发票号码</label>
              <div className="meta-value">{record ? record.id : '—'}</div>
            </div>
            <div className="meta-group">
              <label>开票日期</label>
              <div className="meta-value">{record ? record.invoiceDate : '—'}</div>
            </div>
            <div className="meta-group">
              <label>金额</label>
              <div className="meta-value">{record ? record.amount : '—'}</div>
            </div>
          </div>
          <div className="result-card">
            <h4>{resultTitle}</h4>
            <div className="meta-value">{resultText}</div>
          </div>
        </div>
        <div className="drawer-footer">
          <button className="btn-text" onClick={onClose}>关闭</button>
        </div>
      </aside>
    </div>
  );
};

export default Drawer;
