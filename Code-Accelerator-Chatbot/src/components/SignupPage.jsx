// SignupPage.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SignupPage = () => {
  const [email, setEmail] = useState('');
  const [gitlabId, setGitlabId] = useState('');
  const [slackId, setSlackId] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:4000/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, gitlabId, slackId }),
      });
      if (response.ok) {
        alert('Verification email sent. Please check your inbox.');
        navigate('/');
      } else {
        alert('Failed to send verification email.');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('An error occurred while sending the verification email.');
    }
  };

  return (
    <div>
      <h2>Signup Page</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email:</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <br />
        <label htmlFor="gitlabId">GitLab ID:</label>
        <input
          type="text"
          id="gitlabId"
          value={gitlabId}
          onChange={(e) => setGitlabId(e.target.value)}
          required
        />
        <br />
        <label htmlFor="slackId">Slack ID:</label>
        <input
          type="text"
          id="slackId"
          value={slackId}
          onChange={(e) => setSlackId(e.target.value)}
          required
        />
        <br />
        <button type="submit">Signup</button>
      </form>
    </div>
  );
};

export default SignupPage;
