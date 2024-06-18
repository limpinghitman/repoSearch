import { useState } from 'react';
import { useHistory } from 'react-router-dom'; // Import useHistory to redirect after login

function Login() {
  const [email, setEmail] = useState('');
  const history = useHistory(); // Initialize useHistory

  const handleSubmit = (e) => {
    e.preventDefault();
    // Your login logic here...
    // Redirect to main app after successful login
    history.push('/');
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email:</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default Login;
