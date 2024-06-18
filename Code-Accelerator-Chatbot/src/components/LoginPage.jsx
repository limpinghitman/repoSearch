import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';
import Header from './Header';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('http://localhost:4000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      setLoading(false);
      if (response.ok) {
        alert('Verification email sent. Please check your inbox.');
        navigate('/');
      } else {
        alert('Failed to send verification email.');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setLoading(false);
      alert('An error occurred while sending the verification email.');
    }
  };

  return (
    <div>
      <Header/>
      <div className='login-container'>
      <form onSubmit={handleSubmit} className="login-form">
        <label htmlFor="email">Email address</label>
        <div className="input-container">
          {/* <span className="icon">✉️</span> */}
          <input
            type="email"
            id="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading} className="submit-button">
          {loading ? 'Sending...' : 'Continue'}
        </button>
      </form>
    </div>
    </div>
    
  );
};

export default LoginPage;
