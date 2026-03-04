import { useRef, useState } from 'react';
import { AiOutlineCloudUpload } from 'react-icons/ai';

const UploadSection = ({ onFiles }) => {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const emitFiles = (fileList) => {
    const files = Array.isArray(fileList) ? fileList : Array.from(fileList || []);
    if (!files.length) return;
    onFiles(files);
  };

  return (
    <section
      className={`upload-section${dragOver ? ' drag-over' : ''}`}
      onClick={() => inputRef.current && inputRef.current.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        emitFiles(e.dataTransfer.files);
      }}
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
          <AiOutlineCloudUpload size={28} />
        </div>
        <h3>拖拽或点击上传</h3>
        <p>支持 PDF、OFD、JPG、PNG</p>
      </div>
    </section>
  );
};

export default UploadSection;
