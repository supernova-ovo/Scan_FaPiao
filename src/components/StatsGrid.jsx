import { AiOutlineCheckCircle, AiOutlineCloseCircle, AiOutlineFileSearch } from 'react-icons/ai';

const formatValue = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString() : String(value || 0);
};

const StatsGrid = ({ total, success, fail }) => (
  <section className="stats-grid">
    <div className="stat-card">
      <div className="stat-icon blue-bg">
        <AiOutlineFileSearch size={22} />
      </div>
      <div className="stat-info">
        <span className="stat-label">累计识别</span>
        <span className="stat-value" data-stat="total">
          {formatValue(total)}
        </span>
      </div>
    </div>
    <div className="stat-card">
      <div className="stat-icon green-bg">
        <AiOutlineCheckCircle size={22} />
      </div>
      <div className="stat-info">
        <span className="stat-label">查验成功</span>
        <span className="stat-value" data-stat="success">
          {formatValue(success)}
        </span>
      </div>
    </div>
    <div className="stat-card">
      <div className="stat-icon orange-bg">
        <AiOutlineCloseCircle size={22} />
      </div>
      <div className="stat-info">
        <span className="stat-label">查验失败</span>
        <span className="stat-value" data-stat="fail">
          {formatValue(fail)}
        </span>
      </div>
    </div>
  </section>
);

export default StatsGrid;
