import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './ChatMessages.css';

const renderers = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }
};

function ChatMessages({ messages }) {
  return (
    <div className="chat">
      {/* <h3 style={{ textAlign: 'center' }}>Chat Messages</h3> */}
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`chat-message ${msg.sender === 'You' ? 'right' : 'left'}`}
        >
          <div className={`chat-sender ${msg.sender === 'You' ? 'you' : 'assistant'}`}>{msg.sender} </div>
          <div className="chat-text">
            <ReactMarkdown components={renderers}>{msg.text}</ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}

ChatMessages.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      text: PropTypes.string.isRequired,
      sender: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default ChatMessages;
