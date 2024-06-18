import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Verify = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [verificationStatus, setVerificationStatus] = useState('pending');
  
    useEffect(() => {
      const queryParams = new URLSearchParams(location.search);
      const token = queryParams.get('token');
  
      if (token) {
        fetch(`http://localhost:4000/verify?token=${token}`)
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              setVerificationStatus('success');
              // Redirect to desired URL after a short delay for visibility
              localStorage.setItem('verificationToken', token);
              setTimeout(() => navigate('/'), 5000);
            } else {
              setVerificationStatus(data.error || 'error'); // Handle potential errors
            }
          })
          .catch(error => {
            console.error('Error verifying email:', error);
            setVerificationStatus('error');
          });
      } else {
        // No token provided
        setVerificationStatus('no-token');
      }
    }, [location]);
  
    let message;
    switch (verificationStatus) {
      case 'pending':
        message = 'Verifying your email...';
        break;
      case 'success':
        message = 'Email verified successfully!';
        break;
      case 'failure':
        message = 'Verification failed. Invalid or expired token.';
        break;
      case 'error':
        message = 'Verification failed. Please try again.';
        break;
      case 'no-token':
        message = 'No token provided.';
        break;
      default:
        message = '';
    }
  
    return <div>{message}</div>;
  };
  
  export default Verify;
