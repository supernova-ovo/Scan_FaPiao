import { useState, useEffect } from 'react';
import { AiOutlineClose, AiOutlineZoomIn, AiOutlineZoomOut } from 'react-icons/ai';

const Drawer = ({ record, onClose }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const isOpen = Boolean(record);

  // Reset zoom when record changes or drawer closes
  useEffect(() => {
    setIsZoomed(false);
  }, [record]);

  const preview = record && record.preview ? record.preview : {};
  const showImage = preview.isImage && preview.dataUrl;
  const fileUrl = preview.fileUrl || '';
  const normalizedFileUrl = String(fileUrl || '').trim();
  const isValidFileUrl = normalizedFileUrl !== '' && normalizedFileUrl !== '/' && normalizedFileUrl !== '#';
  const hasFileUrl = Boolean(isValidFileUrl);
  const previewUrl = preview.dataUrl || (isValidFileUrl ? normalizedFileUrl : '');
  const success = record && record.status === 'success';
  const stampText = success ? '查验通过' : '查验失败';
  const resultTitle = success ? '查验通过' : '查验失败';
  const resultText = success ? '查验通过' : record && record.message ? record.message : '查验失败';

  const toggleZoom = () => setIsZoomed(!isZoomed);

  return (
    <div className={`drawer-overlay${isOpen ? ' active' : ''}`} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <aside className="drawer immersive-drawer">
        <div className="drawer-split-layout">

          {/* Left Pane: Preview */}
          <div className="drawer-preview-pane">
          <div className="preview-container">
            <div className={`invoice-preview${isZoomed ? ' scrollable' : ''}`}>
              {showImage ? (
                <img 
                  className={`preview-img${isZoomed ? ' zoomed' : ''}`} 
                  src={preview.dataUrl} 
                  alt="preview" 
                  onClick={toggleZoom}
                  title={isZoomed ? '点击缩小' : '点击放大查看详情'}
                />
              ) : isValidFileUrl ? (
                <iframe className="preview-iframe" src={normalizedFileUrl} title="preview" />
              ) : (
                <div id="previewPlaceholder">当前文件暂无预览</div>
              )}
              {!isZoomed && (
                <div className={`watermark-stamp${success ? ' show' : ''}`}>
                  <div className="stamp-inner">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>{stampText}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="preview-actions">
              {showImage && (
                <button className="btn-action btn-secondary" onClick={toggleZoom}>
                  {isZoomed ? <><AiOutlineZoomOut style={{ marginRight: 4 }} /> 适应窗口</> : <><AiOutlineZoomIn style={{ marginRight: 4 }} /> 查看原图</>}
                </button>
              )}
              <a className={`btn-action btn-primary${previewUrl ? '' : ' disabled'}`} href={previewUrl || '#'} target="_blank" rel="noreferrer">
                全屏查看
              </a>
              <a className={`btn-action btn-secondary${hasFileUrl ? '' : ' disabled'}`} href={isValidFileUrl ? normalizedFileUrl : '#'} download>
                下载文件
              </a>
            </div>
            </div>
          </div>

          {/* Right Pane: Data */}
          <div className="drawer-data-pane">
            <div className="drawer-header">
              <h3>发票详情对照</h3>
              <button className="close-btn" onClick={onClose}>
                <AiOutlineClose size={16} />
              </button>
            </div>
            <div className="drawer-content">
              <div className="invoice-meta detailed-form">

                {/* Header Summary section */}
                <div className="form-summary">
                  <div className="summary-seller">{record ? record.seller : '—'}</div>
                  <div className="summary-amount">
                    <span className="currency">¥</span>
                    <span className="value">{record && record.amount ? record.amount.replace('¥ ', '') : '—'}</span>
                  </div>
                  <div className="summary-status">
                    <span className={`status-badge ${success ? 'success' : 'fail'}`}>
                      {success ? '查验通过' : '查验异常'}
                    </span>
                  </div>
                </div>

                <div className="meta-row-flex">
                  <div className="meta-group">
                    <label>发票号码</label>
                    <div className="meta-value font-mono font-bold" style={{ fontSize: '18px' }}>{record ? record.id : '—'}</div>
                  </div>
                  <div className="meta-group">
                    <label>发票代码</label>
                    <div className="meta-value font-mono">{record ? record.code : '—'}</div>
                  </div>
                </div>

                <div className="meta-row-flex">
                  <div className="meta-group">
                    <label>开票日期</label>
                    <div className="meta-value">{record ? record.invoiceDate : '—'}</div>
                  </div>
                  <div className="meta-group">
                    <label>发票类型</label>
                    <div className="meta-value">{record ? record.type : '—'}</div>
                  </div>
                </div>
                
                <div className="meta-divider"></div>

                <div className="meta-group full-width">
                  <label>购买方</label>
                  <div className="meta-value">{record ? record.buyer : '—'}</div>
                  {record && record.raw && record.raw.gfNsrsbh && (
                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px', fontFamily: 'monospace' }}>
                      税号: {record.raw.gfNsrsbh}
                    </div>
                  )}
                </div>

                <div className="meta-group full-width">
                  <label>销售方</label>
                  <div className="meta-value">{record ? record.seller : '—'}</div>
                  {record && record.raw && record.raw.xfNsrsbh && (
                    <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px', fontFamily: 'monospace' }}>
                      税号: {record.raw.xfNsrsbh}
                    </div>
                  )}
                </div>

                <div className="meta-row-flex">
                  <div className="meta-group">
                    <label>税额</label>
                    <div className="meta-value">
                      {record && record.raw && record.raw.taxamount 
                        ? `¥ ${Number(String(record.raw.taxamount).replace(/,/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
                        : '—'}
                    </div>
                  </div>
                  {record && record.raw && record.raw.remark && (
                    <div className="meta-group">
                      <label>备注</label>
                      <div className="meta-value remark-text">{record.raw.remark}</div>
                    </div>
                  )}
                </div>
                
                <div className="result-card" style={{ marginTop: '32px' }}>
                  <h4>{resultTitle}</h4>
                  <div className="meta-value">{resultText}</div>
                </div>

          </div>
        </div>
      </div>
    </div>
  </aside>
</div>
  );
};

export default Drawer;
