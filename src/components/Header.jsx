import { AiOutlineFileText } from 'react-icons/ai';

const Header = () => (
  <header className="app-header">
    <div className="logo-area">
      <div className="logo-icon">
        <AiOutlineFileText size={20} />
      </div>
      <h1>电子发票智能管理系统</h1>
    </div>
  </header>
);

export default Header;
