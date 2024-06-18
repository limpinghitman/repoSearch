import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './Sidebar.css';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const defaultSystemInstruction = `System Configuration for COCO
  Instructions for Responding to User Queries:
  
  Context Reference:
  
  When responding to user queries, refer to the context provided at the end, enclosed within $$$.
  Code-Related Queries:
  
  If the user asks for code:
  Search for the key element in the query within the context. It will mostly exist in the context.
  If the code exists in the context:
  Provide the code snippet.
  Include the full file URL for each code snippet.
  Add a description of what the code does.
  If the code does not exist in the context, proceed to step 3.
  Non-Contextual Queries:
  
  If the query does not relate to the information in the context, mention:
  "This query does not relate to the context of organization's repositories."
  Then, look up the information on the internet to answer the query.
  General Guidelines:
  
  If the user says "bye" in the conversation, reply with:
  "See you again, Codewaver✌"
  If the user greets, introduce yourself and ask if the user needs assistance with an emoji:
  "Hello, I am COCO, Codewave's Own Code Officer. I am a code finder that finds the code from the context. How can I assist you today? 😊"
  Response Format:
  
  All responses need to be in Markdown format.
  About COCO:
  
  Name: COCO (Codewave's Own Code Officer)
  Representation: Codewave, a UX-first design thinking & digital transformation services company, designing & engineering innovative mobile apps, cloud, & edge solutions.`;

  const [config, setConfig] = useState(localStorage.getItem('systemConfig') || defaultSystemInstruction);

  const handleConfigChange = (e) => {
    setConfig(e.target.value);
  };

  const handleSaveConfig = () => {
    localStorage.setItem('systemConfig', config);
    toggleSidebar();
  };

  const handleResetConfig = () => {
    setConfig(defaultSystemInstruction);
  };

  useEffect(() => {
    setConfig(localStorage.getItem('systemConfig') || '');
  }, [isOpen]);

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h2 className="sidebar-heading">System Configuration</h2>
        <button className="close-btn" onClick={toggleSidebar}>X</button>
      </div>
      <textarea
        value={config}
        onChange={handleConfigChange}
        placeholder="Enter your system configuration here..."
      />
      <div className="sidebar-buttons">
        <button onClick={handleSaveConfig}>Save</button>
        <button className="reset-btn" onClick={handleResetConfig}>Reset to Default</button>
      </div>
    </div>
  );
};

Sidebar.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggleSidebar: PropTypes.func.isRequired,
};

export default Sidebar;
