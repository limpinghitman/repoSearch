//Searchbar.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import './SearchBar.css';
import PropTypes from 'prop-types';
import { useSocket } from '../SocketContext';
import sendIcon from "../assets/send.png";
import asstIcon from "../assets/assistant.png";
import userIcon from "../assets/user.png"


function SearchBar({ addMessage, selectedText}) {
  const socket = useSocket();
  const [message, setMessage] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const systemConfig = localStorage.getItem('systemConfig') || '';
  const conversationRef = useRef([]);
  const asst = (
    <span>
      Assistant <img src={asstIcon} alt="Assistant Icon" style={{ width: '20px', height: '20px' }} />
    </span>
  );
  const user = (
    <span>
      You <img src={asstIcon} alt="User Icon" style={{ width: '20px', height: '20px' }} />
    </span>
  );

  const sendMessage = () => {
    if (message.trim()) {
      console.log('Sending message:', message);
      if (socket) {
        conversationRef.current.push({ role: 'user', content: message });
        console.log("Prompt is : ", message);
        socket.emit('message', { userMessage: message, config: systemConfig, conversation: conversationRef.current });
      }
      addMessage(message, "You");
      setMessage('');
      setIsWaiting(true);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isWaiting) {
      sendMessage();
    }
  };

  const handleResponse = useCallback((response) => {
    console.log('Message received from server:', response);
    addMessage(response, asst);
    setIsWaiting(false);
    conversationRef.current.push({ role: 'assistant', content: response });
  }, [addMessage]);

  useEffect(() => {
    if (socket) {
      socket.on('response', handleResponse);
      return () => {
        socket.off('response', handleResponse);
      };
    }
  }, [socket, handleResponse]);

  useEffect(() => {
    if (selectedText) {
      setMessage(selectedText);
    }
  }, [selectedText]);

  return (
    <div className="search-bar" style={{ backgroundColor: '#141010' }}>
      <input
        type="text"
        placeholder="Ask anything. What are you stuck on?"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyPress}
        disabled={isWaiting}
      />
      <button type="button" onClick={sendMessage} disabled={isWaiting}>
        <img src={sendIcon} alt="Send" style={{ width: '20px', height: '20px' }} />
      </button>
    </div>
  );
}

SearchBar.propTypes = {
  addMessage: PropTypes.func.isRequired,
  selectedText: PropTypes.string,
};

export default SearchBar;
