import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import './ClickableTexts.css';
 
const ClickableTexts = ({ onTextClick }) => {
  const [texts, setTexts] = useState([]);
    
  useEffect(() => {   
    fetch('/defaultPrompt.txt') 
      .then(response => response.text())
      .then(data => setTexts(data.split('\n').filter(line => line.trim() !== '')))
      .catch(error => console.error('Error loading texts:', error));
  }, []);
  
  return (
    <div className="clickable-texts">
      {texts.map((text, index) => (
        <span key={index} onClick={() => onTextClick(text)}>
          {text}
        </span>
      ))}
    </div>
  );
};

ClickableTexts.propTypes = {
  onTextClick: PropTypes.func.isRequired,
};

export default ClickableTexts;
