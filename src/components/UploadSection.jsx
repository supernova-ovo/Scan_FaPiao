import { useRef, useState } from 'react';
import { AiOutlineCloudUpload } from 'react-icons/ai';

const UploadSection = ({ onFiles, isCompact }) => {
  const inputRef = useRef(null);

  const emitFiles = (fileList) => {
    const files = Array.isArray(fileList) ? fileList : Array.from(fileList || []);
    if (!files.length) return;
    onFiles(files);
  };

  return (
    <section
      className={`upload-section${isCompact ? ' compact' : ''}`}
      onClick={() => inputRef.current && inputRef.current.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.ofd,image/*"
        style={{ display: 'none' }}
        onChange={(e) => emitFiles(e.target.files)}
      />
      <div className="upload-content">
        <div className="upload-icon-wrapper">
          <AiOutlineCloudUpload size={isCompact ? 20 : 28} />
        </div>
        <div className="text-content">
          <h3>{isCompact ? '点击或拖拽上传发票' : '拖拽或点击上传'}</h3>
          {!isCompact && <p>支持 PDF、OFD、JPG、PNG</p>}
        </div>
      </div>
    </section>
  );
};

export default UploadSection;
