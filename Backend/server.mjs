//server.mjs
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { userQuery, createChatCompletion } from '../../workerFunctions.js';
import cors from 'cors';
import fs from 'fs';
import path from 'path';


dotenv.config();

// Create Express app and HTTP server
const app = express();
const server = createServer(app);
// const __dirname = path.dirname(new URL(import.meta.url).pathname);
const dataFilePath = path.join(process.cwd(), 'data.json');

function writeToDataFile(data, callback) {
  fs.writeFile(dataFilePath, JSON.stringify(data), (err) => {
    if (err) {
      console.error('Error writing data file:', err);
      callback(err);
    } else {
      console.log('Data appended to data.json file');
      callback(null);
    }
  });
}

app.use(bodyParser.json());
app.use(cors({ origin: 'http://localhost:5173' }));

const secretKey = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

if (!process.env.JWT_SECRET) {
  fs.writeFileSync('.env', `JWT_SECRET=${secretKey}\n`, { flag: 'a' });
  console.log(`Generated and saved JWT secret key: ${secretKey}`);
} else {
  console.log(`Using JWT secret key from environment variables.`);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// app.post('/signup', (req, res) => {
//   // Extract data from the request body
//   const { email, gitlabId, slackId } = req.body;

//   // Validate email presence
//   if (!(email && gitlabId && slackId)) {
//     alert("Data missing");
//     return res.status(400).send('Data is missing');
//   }

//   // Read existing data from the data.json file
//   fs.readFile(dataFilePath, 'utf8', (err, data) => {
//     if (err) {
//       console.error('Error reading data file:', err);
//       return res.status(500).send('Failed to store user information');
//     }

//     let users = {};
//     if (data) {
//       // If data exists in the file, parse it
//       users = JSON.parse(data);
//     }

//     // Add new user information to the users object
//     users[email] = { email, gitlabId, slackId };

//     // Write the updated data back to the data.json file
//     writeToDataFile(users, (err) => {
//       if (err) {
//         return res.status(500).send('Failed to store user information');
//       }
//       // Send success response
//       console.log("User information stored");
//       return res.status(200).send('User information stored');
//     });
//   });
// });

app.post('/signup', (req, res) => {
  // Extract data from the request body
  const { email, gitlabId, slackId } = req.body;

  // Validate email presence
  if (!(email && gitlabId && slackId)) {
    alert("Data missing");
    return res.status(400).send('Data is missing');
  }

  // Read existing data from the data.json file
  fs.readFile(dataFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading data file:', err);
      return res.status(500).send('Failed to store user information');
    }

    let users = {};
    if (data) {
      // If data exists in the file, parse it
      users = JSON.parse(data);
    }

    // Add new user information to the users object
    if (!users[email]) {
      // If the user doesn't exist, create a new entry
      users[email] = {};
    }
    // Add gitlabId and slackId to the user's object
    users[email][gitlabId] = slackId;

    // Write the updated data back to the data.json file
    writeToDataFile(users, (err) => {
      if (err) {
        return res.status(500).send('Failed to store user information');
      }
      // Send success response
      console.log("User information stored");
      return res.status(200).send('User information stored');
    });
  });
});


app.post('/register', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).send('Email is required');
  }

  const token = jwt.sign({ email }, secretKey, { expiresIn: '24h' });
  const verificationLink = `http://localhost:5173/verify?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Email Verification',
    html: `Click <a href="${verificationLink}">here</a> to verify your email.`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending verification email:', error);
      return res.status(500).send('Failed to send verification email');
    } else {
      console.log('Verification email sent:', info.response);
      return res.status(200).send('Verification email sent');
    }
  });
});

app.get('/verify', (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).send('Token is required');
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    const email = decoded.email;
    res.send({ success: true });
  } catch (error) {
    console.error('VERIFY: Invalid or expired token:', error);
    res.status(400).send({ error: 'Invalid or expired token' });
  }
});

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173'
  }
});

// socket middleware
function tokenVerification(socket, next) {
  const authorization = socket.handshake.auth;
  console.log("AUTHORIZATION: ", authorization);
  if (!authorization || !authorization.token) {
    socket.emit("no-token");
    return;
  }
  const token = authorization.token;
  try { 
    const decoded = jwt.verify(token, secretKey);
    console.log('User authenticated:', decoded.email);
    next();
  } catch (error) {
    console.error('TOKEN VERIFICATION: Invalid or expired token:', error);
    console.log("Going to emit from the server ........")
    socket.emit("invalid-token");
    console.log('Emitted token-expired event to client.');
    // setTimeout(() => socket.disconnect(true), 100); // Give client some time to handle the event
  }
}

// Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log('New client connected');
  socket.emit('connected');
  // Use middleware for the specific socket
  tokenVerification(socket, (err) => {
    if (err) {
      console.error('Token verification error:', err);
      return;
    }

    socket.on('message', async ({ userMessage, config, conversation }) => {
      console.log('Message and config received from client:', userMessage);

      

      try {
        if(conversation.length >= 2){
          console.log("Conversation length is greater than 2.");
          const summaryResponse = await createChatCompletion(`Summarize the above conversation with important points that can be used for prompting. In the end add "My ask : ${userMessage}"`,"", config, conversation);
          console.log('Compressed History : ', summaryResponse.choices[0].message.content);

          const response = await userQuery(summaryResponse.choices[0].message.content, config, conversation);
          console.log('Response sending is:', response);
          socket.emit('response', response);

        }
        else{
          const response = await userQuery(userMessage, config, conversation);
          console.log('Response sending is:', response);
          socket.emit('response', response);
        }

      } catch (error) {
        console.error('Error processing user query:', error);
        socket.emit('response', 'Error: Unable to process the query.');
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));















































// import express from 'express';
// import { createServer } from 'http';
// import { Server } from 'socket.io';
// import nodemailer from 'nodemailer';
// import crypto from 'crypto';
// import jwt from 'jsonwebtoken';
// import dotenv from 'dotenv';
// import bodyParser from 'body-parser';
// import { userQuery } from '../../workerFunctions.js';
// import cors from 'cors';
// import fs from 'fs';

// dotenv.config();

// // Create Express app and HTTP server
// const app = express();
// const server = createServer(app);

// app.use(bodyParser.json());
// app.use(cors({ origin: 'http://localhost:5173' }));

// const secretKey = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// if (!process.env.JWT_SECRET) {
//   fs.writeFileSync('.env', `JWT_SECRET=${secretKey}\n`, { flag: 'a' });
//   console.log(`Generated and saved JWT secret key: ${secretKey}`);
// } else {
//   console.log(`Using JWT secret key from environment variables.`);
// }

// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   }
// });

// app.post('/register', (req, res) => {
//   const { email } = req.body;
//   if (!email) {
//     return res.status(400).send('Email is required');
//   }

//   const token = jwt.sign({ email }, secretKey, { expiresIn: '24h' });
//   const verificationLink = `http://localhost:5173/verify?token=${token}`;

//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to: email,
//     subject: 'Email Verification',
//     html: `Click <a href="${verificationLink}">here</a> to verify your email.`,
//   };

//   transporter.sendMail(mailOptions, (error, info) => {
//     if (error) {
//       console.error('Error sending verification email:', error);
//       return res.status(500).send('Failed to send verification email');
//     } else {
//       console.log('Verification email sent:', info.response);
//       return res.status(200).send('Verification email sent');
//     }
//   });
// });

// app.get('/verify', (req, res) => {
//   const token = req.query.token;
//   if (!token) {
//     return res.status(400).send('Token is required');
//   }

//   try {
//     const decoded = jwt.verify(token, secretKey);
//     const email = decoded.email;
//     res.send({ success: true });
//   } catch (error) {
//     console.error('VERIFY: Invalid or expired token:', error);
//     res.status(400).send({ error: 'Invalid or expired token' });
//   }
// });

// // Create Socket.IO server
// const io = new Server(server, {
//   cors: {
//     origin: 'http://localhost:5173'
//   }
// });

// // socket middleware
// function tokenVerification(socket, next) {
//   const authorization = socket.handshake.auth;
//   console.log("AUTHORIZATION: ",authorization);
//   if (!authorization || !authorization.token) {
//     socket.emit("no-token", () => {
//       socket.disconnect(true);
//     });
//     return;
//   }
//   const token = authorization.token;
//   try {
//     const decoded = jwt.verify(token, secretKey);
//     console.log('User authenticated:', decoded.email);
//     next();
//   } catch (error) {
//     console.error('TOKEN VERIFICATION: Invalid or expired token:', error);
//     console.log("Going to emit from the server ........")
//     socket.emit("token-expired", () => {
//       console.log('Emitted token-expired event to client.');
//       socket.disconnect(true);
//     });
//   }
// }

// // Use middleware for Socket.IO connections


// io.on('connection', (socket) => {
//   console.log('New client connected');
//   io.use(tokenVerification(socket));
//   socket.on('message', async ({ userMessage, config, conversation }) => {
//     console.log('Message and config received from client:', userMessage, config);

//     try {
//       const response = await userQuery(userMessage, config, conversation);
//       console.log('Response sending is:', response);
//       socket.emit('response', response);
//     } catch (error) {
//       console.error('Error processing user query:', error);
//       socket.emit('response', 'Error: Unable to process the query.');
//     }
//   });

//   socket.on('disconnect', () => {
//     console.log('Client disconnected');
//   });
// });

// // Start the server
// const PORT = process.env.PORT || 4000;
// server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


















































//server.mjs
// import express from 'express';
// import { createServer } from 'http';
// import { Server } from 'socket.io';
// import nodemailer from 'nodemailer';
// import crypto from 'crypto';
// import jwt from 'jsonwebtoken';
// import dotenv from 'dotenv';
// import bodyParser from 'body-parser';
// import { userQuery } from '../../workerFunctions.js';
// import cors from 'cors';
// import fs from "fs";

// dotenv.config();

// // Create Express app and HTTP server
// const app = express();
// const server = createServer(app);

// app.use(bodyParser.json());
// app.use(cors({ origin: 'http://localhost:5173' }));

// const secretKey = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// if (!process.env.JWT_SECRET) {
//   fs.writeFileSync('.env', `JWT_SECRET=${secretKey}\n`, { flag: 'a' });
//   console.log(`Generated and saved JWT secret key: ${secretKey}`);
// } else {
//   console.log(`Using JWT secret key from environment variables.`);
// }

// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER, // Your Gmail email address
//     pass: process.env.EMAIL_PASS // Your Gmail password or app-specific password
//   }
// });

// app.post('/register', (req, res) => {
//   const { email } = req.body;
//   if (!email) {
//     return res.status(400).send('Email is required');
//   }

//   const token = jwt.sign({ email }, secretKey, { expiresIn: '24h' });
//   console.log("token: ",token);
//   console.log("secretKey: ",secretKey);
//   const verificationLink = `http://localhost:5173/verify?token=${token}`;

//   const mailOptions = {
//     from: process.env.EMAIL_USER,
//     to: email,
//     subject: 'Email Verification',
//     html: `Click <a href="${verificationLink}">here</a> to verify your email.`,
//   };
//   console.log('EMAIL_USER:', process.env.EMAIL_USER);
//   console.log('EMAIL_PASS:', process.env.EMAIL_PASS);

//   transporter.sendMail(mailOptions, (error, info) => {
//     if (error) {
//       console.error('Error sending verification email:', error);
//       return res.status(500).send('Failed to send verification email');
//     } else {
//       console.log('Verification email sent:', info.response);
//       return res.status(200).send('Verification email sent');
//     }
//   });
// });

// app.get('/verify', (req, res) => {
//   const token = req.query.token;
//   // console.log("token is : ",token);
//   // console.log("\nsecret key is : ",secretKey);

//   if (!token) {
//     // console.log("TOKENN IS REQUIRED");
//     return res.status(400).send('Token is required');
//   }

//   try {
//     const decoded = jwt.verify(token, secretKey);
//     // console.log("decoded: ",decoded);
//     const email = decoded.email;
//     // console.log(`Email verified for: ${email}`);
//     res.send({ success: true }); // Send success response to Verify.jsx
    
//   } catch (error) {
//     console.error('VERIFY: Invalid or expired token:', error);
//     res.status(400).send({ error: 'Invalid or expired token' }); // Send error response with details
//   }
// });

// // Create Socket.IO server
// const io = new Server(server, {
//   cors: {
//     origin: 'http://localhost:5173'
//   }
// });

// //socket middleware

// // function tokenVerification (socket, next){
// //   // Check for authorization header
// //   const authorization = socket.handshake.auth;
// //   // console.log("Authorization: ",authorization);
// //   // console.log("secret key: ",secretKey);
// //   if (!authorization || !authorization.token) {
// //     socket.emit("no-token")
// //     return next(new Error('Authorization token required'));
// //   }
// //   const token = authorization.token;
// //   // console.log("token: ",token);
// //   // socket.emit("sending");
// //   try {
// //     const decoded = jwt.verify(token, secretKey);
// //     // console.log('User authenticated:', decoded.email);
// //     next();
// //   } catch (error) {
// //     console.error('TOKEN VERIFICATION: Invalid or expired token:', error);
// //     console.log("------------- token has been expired or invalidated ---------------------------------------");
// //     socket.emit("sending");
// //     return next(new Error('Invalid or expired token'));
// //   }
// // }
// function tokenVerification(socket, next) {
//   const authorization = socket.handshake.auth;
//   if (!authorization || !authorization.token) {
//     socket.emit("no-token");
//     return socket.disconnect(true);
//   }
//   const token = authorization.token;
//   try {
//     const decoded = jwt.verify(token, secretKey);
//     console.log('User authenticated:', decoded.email);
//     next();
//   } catch (error) {
//     console.error('TOKEN VERIFICATION: Invalid or expired token:', error);
//     socket.emit("invalid-token");
//     return socket.disconnect(true);
//   }
// }

// // Use middleware for Socket.IO connections
// io.use((socket, next) => {
//   tokenVerification(socket, next);
// });


// // Handle Socket.IO connections
// io.on('connection', (socket) => {
//   console.log('New client connected');
//   //io.use
//   //socket authentication middleware
//   socket.on('message', async ({ userMessage, config, conversation }) => {
//     console.log('Message and config received from client:', userMessage, config);

//     try {
//       // Process user query
//       const response = await userQuery(userMessage, config, conversation);

//       console.log('Response sending is:', response);

//       // Send response to client
//       socket.emit('response', response);
//     } catch (error) {
//       console.error('Error processing user query:', error);
//       socket.emit('response', 'Error: Unable to process the query.');
//     }
//   });

//   socket.on('disconnect', () => {
//     console.log('Client disconnected');
//   });
// });

// // Start the server
// const PORT = process.env.PORT || 4000;
// server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
