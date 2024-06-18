//App.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import Header from './components/Header';
import ChatMessages from './components/ChatMessages';
import Sidebar from './components/Sidebar';
import { Link } from 'react-router-dom';
import ClickableTexts from './components/ClickableTexts';

 
function App() {
  const navigate = useNavigate()
  const [chat, setChat] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [promptText,setPromptText]=useState('');

  const addMessage = (message, sender = 'You') => {
    setChat((prevChat) => [...prevChat, { text: message, sender }]);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  const handleLogout = () => {
    localStorage.removeItem('verificationToken');
    navigate('/login');
  };

  const handleTextClick = (text) => {
    setPromptText(text);
  };


  return (
    <div className='app-container'>
      <div className='login-btn'>
      <button className="logout-button" onClick={handleLogout}>Log Out</button>
      </div>
      <div className="app">
        <Header />
        <ClickableTexts onTextClick={handleTextClick} />
        <button className="open-sidebar-btn" onClick={toggleSidebar}>Open Sidebar</button>
        <ChatMessages messages={chat} />
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        <SearchBar addMessage={addMessage} selectedText={promptText} />
      </div>
    </div>
    
  );
}

export default App;
